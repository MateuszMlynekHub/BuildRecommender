import { Component, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/services/translation.service';
import { TPipe } from '../../shared/pipes/t.pipe';
import { LolSelectComponent, SelectOption } from '../../shared/components/lol-select.component';
import { MultiSearchResult } from '../../core/models/multisearch.model';
import { Region } from '../../core/models/region.model';

@Component({
  selector: 'app-multisearch',
  standalone: true,
  imports: [FormsModule, TPipe, LolSelectComponent],
  template: `
    <div class="ms-container">
      <h1 class="ms-title">{{ 'multisearch.title' | t }}</h1>
      <p class="ms-subtitle">{{ 'multisearch.subtitle' | t }}</p>

      <div class="ms-input-area">
        <textarea
          class="ms-textarea"
          [(ngModel)]="inputText"
          [placeholder]="'multisearch.placeholder' | t"
          rows="5"
        ></textarea>

        <div class="ms-controls">
          <app-lol-select
            [options]="regionOptions()"
            [value]="selectedRegion"
            (valueChange)="selectedRegion = $event"
            size="sm"
          ></app-lol-select>
          <button class="ms-search-btn" (click)="search()" [disabled]="loading()">
            @if (loading()) {
              <span class="ms-spinner"></span>
            }
            {{ 'multisearch.search' | t }}
          </button>
        </div>
      </div>

      @if (results().length > 0) {
        <div class="ms-results">
          @for (player of results(); track player.gameName + '#' + player.tagLine) {
            <div class="ms-player-card" [class.ms-player-card--not-found]="!player.found">
              @if (player.found) {
                <div class="ms-player-header">
                  @if (player.profileIconUrl) {
                    <img class="ms-player-icon" [src]="player.profileIconUrl"
                      width="48" height="48" loading="lazy" />
                  }
                  <div class="ms-player-info">
                    <div class="ms-player-name">{{ player.gameName }}<span class="ms-player-tag">#{{ player.tagLine }}</span></div>
                    @if (player.rankedEntries && player.rankedEntries.length > 0) {
                      @for (entry of player.rankedEntries; track entry.queueType) {
                        @if (entry.queueType === 'RANKED_SOLO_5x5') {
                          <div class="ms-player-rank">
                            {{ entry.tier }} {{ entry.rank }} — {{ entry.leaguePoints }} LP
                            <span class="ms-player-wl">({{ entry.wins }}W {{ entry.losses }}L)</span>
                          </div>
                        }
                      }
                    } @else {
                      <div class="ms-player-rank ms-player-rank--unranked">Unranked</div>
                    }
                  </div>
                </div>

                @if (player.recentGames && player.recentGames > 0) {
                  <div class="ms-player-recent">
                    <div class="ms-recent-wr"
                      [class.ms-wr-good]="(player.recentWinRate ?? 0) >= 0.55"
                      [class.ms-wr-bad]="(player.recentWinRate ?? 0) < 0.45">
                      {{ ((player.recentWinRate ?? 0) * 100).toFixed(0) }}%
                    </div>
                    <span class="ms-recent-games">{{ player.recentWins }}W {{ (player.recentGames ?? 0) - (player.recentWins ?? 0) }}L ({{ player.recentGames }} {{ 'multisearch.games' | t }})</span>
                  </div>
                }

                @if (player.topChampions && player.topChampions.length > 0) {
                  <div class="ms-player-champs">
                    @for (champ of player.topChampions; track champ.championId) {
                      <div class="ms-champ-mini">
                        <img [src]="champ.championImage" width="28" height="28"
                          class="ms-champ-img" loading="lazy" />
                        <span class="ms-champ-count">{{ champ.games }}</span>
                      </div>
                    }
                  </div>
                }
              } @else {
                <div class="ms-player-header">
                  <div class="ms-player-info">
                    <div class="ms-player-name">{{ player.gameName }}<span class="ms-player-tag">#{{ player.tagLine }}</span></div>
                    <div class="ms-player-rank ms-player-rank--unranked">{{ 'multisearch.notFound' | t }}</div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (errorKey()) {
        <div class="ms-error">{{ errorKey() | t }}</div>
      }
    </div>
  `,
  styles: [`
    .ms-container {
      max-width: 900px; margin: 2rem auto; padding: 0 1rem;
    }
    .ms-title {
      font-size: 1.5rem; font-weight: 700; color: var(--lol-gold-1);
      margin-bottom: 0.25rem;
    }
    .ms-subtitle {
      font-size: 0.85rem; color: var(--lol-text-muted); margin-bottom: 1rem;
    }
    .ms-input-area {
      background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 1rem; margin-bottom: 1.5rem;
    }
    .ms-textarea {
      width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; color: var(--lol-text-primary, #ccc); font-family: monospace;
      font-size: 0.85rem; padding: 0.5rem; resize: vertical;
    }
    .ms-textarea::placeholder { color: var(--lol-text-muted); }
    .ms-controls {
      display: flex; gap: 0.5rem; margin-top: 0.75rem; align-items: center;
    }
    .ms-region-select {
      background: rgba(0,0,0,0.4); color: var(--lol-gold-3); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; padding: 0.4rem 0.6rem; font-size: 0.85rem;
    }
    .ms-search-btn {
      background: linear-gradient(135deg, var(--lol-gold-3), var(--lol-gold-5));
      color: #0a0a0a; border: none; border-radius: 3px; padding: 0.5rem 1.5rem;
      font-weight: 700; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;
    }
    .ms-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ms-spinner {
      display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.2);
      border-top-color: #0a0a0a; border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ms-results {
      display: flex; flex-direction: column; gap: 0.6rem;
    }
    .ms-player-card {
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 0.75rem 1rem;
      display: flex; flex-direction: column; gap: 0.5rem;
    }
    .ms-player-card--not-found { opacity: 0.5; }
    .ms-player-header { display: flex; gap: 0.75rem; align-items: center; }
    .ms-player-icon { border-radius: 50%; border: 2px solid var(--lol-gold-5); }
    .ms-player-info { flex: 1; }
    .ms-player-name { font-size: 1rem; font-weight: 700; color: var(--lol-gold-1); }
    .ms-player-tag { color: var(--lol-text-muted); font-weight: 400; }
    .ms-player-rank { font-size: 0.8rem; color: var(--lol-gold-3); margin-top: 0.15rem; }
    .ms-player-rank--unranked { color: var(--lol-text-muted); }
    .ms-player-wl { color: var(--lol-text-muted); font-size: 0.75rem; }

    .ms-player-recent {
      display: flex; align-items: center; gap: 0.5rem;
    }
    .ms-recent-wr {
      font-size: 1.1rem; font-weight: 700; min-width: 40px;
    }
    .ms-wr-good { color: #4caf50; }
    .ms-wr-bad { color: #f44336; }
    .ms-recent-games { font-size: 0.8rem; color: var(--lol-text-muted); }

    .ms-player-champs { display: flex; gap: 0.35rem; }
    .ms-champ-mini { position: relative; }
    .ms-champ-img { border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .ms-champ-count {
      position: absolute; bottom: -2px; right: -2px; background: rgba(0,0,0,0.8);
      color: var(--lol-gold-3); font-size: 0.6rem; padding: 0 3px; border-radius: 3px;
      font-weight: 700;
    }

    .ms-error {
      color: var(--lol-red, #f44336); padding: 0.5rem; text-align: center;
      font-size: 0.85rem; margin-top: 0.5rem;
    }
  `],
})
export class MultisearchComponent {
  private readonly api = inject(ApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  inputText = '';
  selectedRegion = 'euw1';
  readonly loading = signal(false);
  readonly results = signal<MultiSearchResult[]>([]);
  readonly regions = signal<Region[]>([]);
  readonly regionOptions = computed<SelectOption[]>(() =>
    this.regions().map(r => ({ value: r.id, label: r.name }))
  );
  readonly errorKey = signal('');

  ngOnInit() {
    this.api.getRegions().subscribe({
      next: (r) => this.regions.set(r),
    });
  }

  search() {
    const text = this.inputText.trim();
    if (!text) return;

    this.loading.set(true);
    this.errorKey.set('');
    this.results.set([]);

    this.api.multiSearch(text, this.selectedRegion).subscribe({
      next: (res) => {
        this.results.set(res.players);
        this.loading.set(false);
      },
      error: () => {
        this.errorKey.set('multisearch.error');
        this.loading.set(false);
      },
    });
  }
}
