import { Component, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/services/translation.service';
import { TPipe } from '../../shared/pipes/t.pipe';
import { LolSelectComponent, SelectOption } from '../../shared/components/lol-select.component';
import { Region } from '../../core/models/region.model';
import { environment } from '../../../environments/environment';

interface LeaderboardEntry {
  summonerId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  profileIconUrl: string;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [FormsModule, TPipe, LolSelectComponent],
  template: `
    <div class="lb-container">
      <h1 class="lb-title">{{ 'leaderboard.title' | t }}</h1>

      <div class="lb-controls">
        <app-lol-select
          [options]="regionOptions()"
          [value]="selectedRegion"
          (valueChange)="selectedRegion = $event; load()"
          size="sm"
        ></app-lol-select>
        <app-lol-select
          [options]="tierOptions"
          [value]="selectedTier"
          (valueChange)="selectedTier = $event; load()"
          size="sm"
        ></app-lol-select>
      </div>

      @if (loading()) {
        <div class="lb-loading">Loading...</div>
      }

      @if (entries().length > 0) {
        <div class="lb-table">
          <div class="lb-header">
            <span class="lb-col lb-col-rank">#</span>
            <span class="lb-col lb-col-player">{{ 'leaderboard.player' | t }}</span>
            <span class="lb-col lb-col-lp">{{ 'leaderboard.lp' | t }}</span>
            <span class="lb-col lb-col-wr">{{ 'leaderboard.winRate' | t }}</span>
            <span class="lb-col lb-col-games">{{ 'leaderboard.games' | t }}</span>
          </div>
          @for (entry of entries(); track entry.summonerId; let i = $index) {
            <div class="lb-row">
              <span class="lb-col lb-col-rank lb-rank-num">{{ i + 1 }}</span>
              <div class="lb-col lb-col-player lb-player-cell">
                @if (entry.profileIconUrl) {
                  <img class="lb-player-icon" [src]="entry.profileIconUrl" width="32" height="32" loading="lazy" />
                }
                <span class="lb-player-name">{{ entry.gameName || entry.summonerId }}<span class="lb-player-tag">{{ entry.tagLine ? '#' + entry.tagLine : '' }}</span></span>
              </div>
              <span class="lb-col lb-col-lp lb-lp-value">{{ entry.leaguePoints }} LP</span>
              <span class="lb-col lb-col-wr"
                [class.lb-wr-good]="winRate(entry) >= 55"
                [class.lb-wr-bad]="winRate(entry) < 50">
                {{ winRate(entry).toFixed(1) }}%
              </span>
              <span class="lb-col lb-col-games">{{ entry.wins + entry.losses }}</span>
            </div>
          }
        </div>
      } @else if (!loading()) {
        <div class="lb-empty">{{ 'leaderboard.noData' | t }}</div>
      }
    </div>
  `,
  styles: [`
    .lb-container { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    .lb-title {
      font-size: 1.5rem; font-weight: 700; color: var(--lol-gold-1); margin-bottom: 1rem;
    }
    .lb-controls { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .lb-select {
      background: rgba(0,0,0,0.4); color: var(--lol-gold-3); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; padding: 0.4rem 0.6rem; font-size: 0.85rem;
    }
    .lb-loading { text-align: center; color: var(--lol-text-muted); padding: 2rem; }
    .lb-empty { text-align: center; color: var(--lol-text-muted); padding: 2rem; }

    .lb-table {
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5); border-radius: 4px;
      overflow: hidden;
    }
    .lb-header {
      display: flex; padding: 0.5rem 0.75rem; background: rgba(200,170,110,0.1);
      border-bottom: 1px solid var(--lol-gold-5); font-size: 0.75rem; font-weight: 700;
      color: var(--lol-gold-3); text-transform: uppercase; letter-spacing: 0.05em;
    }
    .lb-row {
      display: flex; align-items: center; padding: 0.4rem 0.75rem;
      border-bottom: 1px solid rgba(200,170,110,0.08); font-size: 0.85rem;
    }
    .lb-row:hover { background: rgba(200,170,110,0.05); }
    .lb-col { min-width: 0; }
    .lb-col-rank { width: 40px; text-align: center; }
    .lb-col-player { flex: 1; }
    .lb-col-lp { width: 80px; text-align: right; }
    .lb-col-wr { width: 65px; text-align: right; }
    .lb-col-games { width: 60px; text-align: right; }

    .lb-rank-num { color: var(--lol-gold-3); font-weight: 700; }
    .lb-player-cell { display: flex; align-items: center; gap: 0.5rem; }
    .lb-player-icon { border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .lb-player-name { color: var(--lol-gold-1); font-weight: 600; }
    .lb-player-tag { color: var(--lol-text-muted); font-weight: 400; }
    .lb-lp-value { color: var(--lol-gold-1); font-weight: 700; }
    .lb-wr-good { color: #4caf50; }
    .lb-wr-bad { color: #f44336; }
  `],
})
export class LeaderboardComponent {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  selectedRegion = 'euw1';
  selectedTier = 'challenger';
  readonly loading = signal(false);
  readonly entries = signal<LeaderboardEntry[]>([]);
  readonly regions = signal<Region[]>([]);
  readonly regionOptions = computed<SelectOption[]>(() =>
    this.regions().map(r => ({ value: r.id, label: r.name }))
  );
  readonly tierOptions: SelectOption[] = [
    { value: 'challenger', label: 'Challenger' },
    { value: 'grandmaster', label: 'Grandmaster' },
    { value: 'master', label: 'Master' },
  ];

  ngOnInit() {
    this.api.getRegions().subscribe({ next: (r) => this.regions.set(r) });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.http.get<{ entries: LeaderboardEntry[] }>(
      `${this.baseUrl}/game/leaderboard`,
      { params: { region: this.selectedRegion, tier: this.selectedTier } }
    ).subscribe({
      next: (res) => {
        this.entries.set(res.entries ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.entries.set([]);
        this.loading.set(false);
      },
    });
  }

  winRate(e: LeaderboardEntry): number {
    const total = e.wins + e.losses;
    return total > 0 ? (e.wins / total) * 100 : 0;
  }
}
