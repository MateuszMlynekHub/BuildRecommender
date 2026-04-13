import { Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Region } from '../../core/models/region.model';
import { environment } from '../../../environments/environment';
import { LolSelectComponent, SelectOption } from '../../shared/components/lol-select.component';

interface WrappedData {
  gameName: string;
  tagLine: string;
  region: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  mostPlayedChampion: {
    championId: number;
    championName: string;
    championImage: string;
    gamesPlayed: number;
  };
  averageKda: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  averageDamage: number;
  averageCS: number;
  averageBuildScore: number;
  buildGrade: string;
  buildPersonality: string;
  funStats: string[];
  championsPlayed: number;
}

@Component({
  selector: 'app-season-wrapped',
  standalone: true,
  imports: [FormsModule, DecimalPipe, TitleCasePipe, LolSelectComponent],
  template: `
    <div class="sw-container">
      @if (!data() && !loading()) {
        <div class="sw-intro">
          <h1 class="sw-intro-title">Season Wrapped</h1>
          <p class="sw-intro-subtitle">Your ranked season in review. Discover your stats, your style, and some truths you might not want to hear.</p>

          <div class="sw-input-area">
            <div class="sw-form">
              <div class="sw-field">
                <label class="sw-label">Riot ID</label>
                <div class="flex gap-2 items-stretch">
                  <input class="lol-input min-w-0" style="flex: 7 1 0%;" type="text" [(ngModel)]="gameName" placeholder="Name" (keyup.enter)="generate()" />
                  <span class="flex items-center px-1 text-gold text-2xl font-display shrink-0">#</span>
                  <input class="lol-input min-w-0 uppercase" style="flex: 3 1 0%;" type="text" [(ngModel)]="tagLine" placeholder="Tag" (keyup.enter)="generate()" />
                </div>
              </div>
              <div class="sw-field">
                <label class="sw-label">Region</label>
                <app-lol-select
                  [options]="regionOptions()"
                  [value]="selectedRegion"
                  (valueChange)="selectedRegion = $event"
                  [fullWidth]="true"
                ></app-lol-select>
              </div>
              <button class="btn-gold w-full flex items-center justify-center gap-3" (click)="generate()" [disabled]="loading()">
                @if (loading()) { <span class="sw-spinner"></span> }
                Unwrap My Season
              </button>
            </div>
          </div>

          @if (error()) {
            <div class="sw-error">{{ error() }}</div>
          }
        </div>
      }

      @if (loading()) {
        <div class="sw-loading-screen">
          <div class="sw-loading-pulse"></div>
          <p class="sw-loading-text">Analyzing your season...</p>
        </div>
      }

      @if (data() && !loading()) {
        <div class="sw-cards" (click)="nextCard()">
          @if (currentCard() === 0) {
            <div class="sw-card sw-card-enter sw-card--overview">
              <div class="sw-card-badge">SEASON WRAPPED</div>
              <h2 class="sw-card-name">{{ data()!.gameName }}#{{ data()!.tagLine }}</h2>
              <div class="sw-card-big-stat">{{ data()!.totalGames }}</div>
              <div class="sw-card-big-label">Ranked Games Played</div>
              <div class="sw-card-row">
                <div class="sw-card-stat">
                  <span class="sw-stat-value sw-win-color">{{ data()!.wins }}</span>
                  <span class="sw-stat-label">Wins</span>
                </div>
                <div class="sw-card-stat">
                  <span class="sw-stat-value sw-loss-color">{{ data()!.losses }}</span>
                  <span class="sw-stat-label">Losses</span>
                </div>
                <div class="sw-card-stat">
                  <span class="sw-stat-value">{{ data()!.winRate }}%</span>
                  <span class="sw-stat-label">Win Rate</span>
                </div>
              </div>
              <div class="sw-card-tap">Tap to continue</div>
            </div>
          }

          @if (currentCard() === 1) {
            <div class="sw-card sw-card-enter sw-card--champion">
              <div class="sw-card-badge">YOUR MAIN</div>
              @if (data()!.mostPlayedChampion.championImage) {
                <img class="sw-card-champ-img" [src]="data()!.mostPlayedChampion.championImage" width="120" height="120" />
              }
              <h2 class="sw-card-champ-name">{{ data()!.mostPlayedChampion.championName }}</h2>
              <div class="sw-card-champ-games">{{ data()!.mostPlayedChampion.gamesPlayed }} games played</div>
              <div class="sw-card-aside">You played {{ data()!.championsPlayed }} different champion{{ data()!.championsPlayed !== 1 ? 's' : '' }} total</div>
              <div class="sw-card-tap">Tap to continue</div>
            </div>
          }

          @if (currentCard() === 2) {
            <div class="sw-card sw-card-enter sw-card--kda">
              <div class="sw-card-badge">YOUR KDA</div>
              <div class="sw-card-big-stat">{{ data()!.averageKda }}</div>
              <div class="sw-card-big-label">Average KDA</div>
              <div class="sw-card-row">
                <div class="sw-card-stat">
                  <span class="sw-stat-value">{{ data()!.totalKills }}</span>
                  <span class="sw-stat-label">Kills</span>
                </div>
                <div class="sw-card-stat">
                  <span class="sw-stat-value">{{ data()!.totalDeaths }}</span>
                  <span class="sw-stat-label">Deaths</span>
                </div>
                <div class="sw-card-stat">
                  <span class="sw-stat-value">{{ data()!.totalAssists }}</span>
                  <span class="sw-stat-label">Assists</span>
                </div>
              </div>
              <div class="sw-card-row">
                <div class="sw-card-stat">
                  <span class="sw-stat-value">{{ data()!.averageDamage | number }}</span>
                  <span class="sw-stat-label">Avg Damage</span>
                </div>
                <div class="sw-card-stat">
                  <span class="sw-stat-value">{{ data()!.averageCS }}</span>
                  <span class="sw-stat-label">Avg CS</span>
                </div>
              </div>
              <div class="sw-card-tap">Tap to continue</div>
            </div>
          }

          @if (currentCard() === 3) {
            <div class="sw-card sw-card-enter sw-card--build">
              <div class="sw-card-badge">YOUR BUILDS</div>
              <div class="sw-card-grade-circle" [class]="'sw-card-grade-circle sw-grade-' + data()!.buildGrade.toLowerCase()">
                <span class="sw-grade-letter">{{ data()!.buildGrade }}</span>
                <span class="sw-grade-score">{{ data()!.averageBuildScore }}/100</span>
              </div>
              <div class="sw-card-big-label">Average Build Score</div>
              <div class="sw-card-personality">
                <span class="sw-personality-label">Build Personality:</span>
                <span class="sw-personality-value sw-personality-{{ data()!.buildPersonality }}">{{ data()!.buildPersonality | titlecase }}</span>
              </div>
              <div class="sw-card-personality-desc">
                @if (data()!.buildPersonality === 'aggressive') {
                  You favor damage over safety. Living life on the edge.
                } @else if (data()!.buildPersonality === 'defensive') {
                  You build tanky and safe. Survival is your motto.
                } @else {
                  A well-rounded builder. You adapt to the situation.
                }
              </div>
              <div class="sw-card-tap">Tap to continue</div>
            </div>
          }

          @if (currentCard() === 4) {
            <div class="sw-card sw-card-enter sw-card--fun">
              <div class="sw-card-badge">THE ROAST</div>
              <div class="sw-fun-stats">
                @for (stat of data()!.funStats; track $index) {
                  <div class="sw-fun-stat">{{ stat }}</div>
                }
                @if (data()!.funStats.length === 0) {
                  <div class="sw-fun-stat">You played a pretty clean season. No dirt to be found... this time.</div>
                }
              </div>
              <button class="sw-share-btn" (click)="copyToClipboard(); $event.stopPropagation()">Copy My Wrapped</button>
              <button class="sw-restart-btn" (click)="restart(); $event.stopPropagation()">Start Over</button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .sw-container { max-width: 500px; margin: 2rem auto; padding: 0 1rem; }

    .sw-intro-title { font-size: 1.5rem; font-weight: 700; color: var(--lol-gold-1); margin-bottom: 0.25rem; }
    .sw-intro-subtitle { font-size: 0.85rem; color: var(--lol-text-muted); margin-bottom: 1.5rem; }

    .sw-input-area {
      background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 1rem;
    }
    .sw-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .sw-field { display: flex; flex-direction: column; gap: 0.35rem; }
    .sw-label { font-size: 0.65rem; font-family: 'Cinzel', serif; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lol-gold-3); font-weight: 600; }
    .sw-spinner {
      display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%; animation: swspin 0.6s linear infinite;
    }
    @keyframes swspin { to { transform: rotate(360deg); } }

    .sw-loading-screen {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 300px; gap: 1rem;
    }
    .sw-loading-pulse {
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #9c27b0, #7b1fa2);
      animation: swpulse 1.2s ease-in-out infinite;
    }
    @keyframes swpulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.5; }
    }
    .sw-loading-text { color: var(--lol-text-muted); font-size: 0.9rem; }

    /* Cards */
    .sw-cards { cursor: pointer; user-select: none; }
    .sw-card {
      background: rgba(1,10,19,0.85); border: 2px solid var(--lol-gold-3);
      border-radius: 12px; padding: 2rem 1.5rem; text-align: center;
      min-height: 400px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 0.75rem;
    }
    .sw-card-enter { animation: swslide 0.4s ease-out; }
    @keyframes swslide {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .sw-card--overview { border-color: #2196f3; }
    .sw-card--champion { border-color: #ff9800; }
    .sw-card--kda { border-color: #f44336; }
    .sw-card--build { border-color: #9c27b0; }
    .sw-card--fun { border-color: var(--lol-gold-3); }

    .sw-card-badge {
      font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em;
      color: var(--lol-gold-3); font-weight: 700;
      background: rgba(200,170,110,0.1); padding: 0.25rem 0.75rem; border-radius: 12px;
    }
    .sw-card-name { font-size: 1.2rem; font-weight: 700; color: var(--lol-gold-1); }
    .sw-card-big-stat { font-size: 3.5rem; font-weight: 900; color: #fff; line-height: 1; }
    .sw-card-big-label { font-size: 0.85rem; color: var(--lol-text-muted); }
    .sw-card-row { display: flex; gap: 1.5rem; justify-content: center; margin-top: 0.5rem; }
    .sw-card-stat { display: flex; flex-direction: column; align-items: center; }
    .sw-stat-value { font-size: 1.3rem; font-weight: 700; color: var(--lol-gold-1); }
    .sw-stat-label { font-size: 0.7rem; color: var(--lol-text-muted); text-transform: uppercase; }
    .sw-win-color { color: #4caf50; }
    .sw-loss-color { color: #f44336; }
    .sw-card-tap { font-size: 0.7rem; color: var(--lol-text-muted); margin-top: auto; opacity: 0.6; }

    .sw-card-champ-img { border-radius: 50%; border: 3px solid var(--lol-gold-3); }
    .sw-card-champ-name { font-size: 1.8rem; font-weight: 900; color: #fff; }
    .sw-card-champ-games { font-size: 0.9rem; color: var(--lol-gold-3); }
    .sw-card-aside { font-size: 0.75rem; color: var(--lol-text-muted); font-style: italic; }

    .sw-card-grade-circle {
      width: 100px; height: 100px; border-radius: 50%; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(200,170,110,0.1); border: 3px solid var(--lol-gold-3);
    }
    .sw-grade-s, .sw-grade-a { border-color: #4caf50; }
    .sw-grade-b { border-color: var(--lol-gold-3); }
    .sw-grade-c { border-color: #ff9800; }
    .sw-grade-d, .sw-grade-f { border-color: #f44336; }
    .sw-grade-letter { font-size: 2.5rem; font-weight: 900; color: var(--lol-gold-1); line-height: 1; }
    .sw-grade-score { font-size: 0.7rem; color: var(--lol-text-muted); }

    .sw-card-personality { display: flex; gap: 0.5rem; align-items: center; }
    .sw-personality-label { font-size: 0.8rem; color: var(--lol-text-muted); }
    .sw-personality-value { font-size: 1rem; font-weight: 700; }
    .sw-personality-aggressive { color: #f44336; }
    .sw-personality-defensive { color: #2196f3; }
    .sw-personality-balanced { color: #4caf50; }
    .sw-card-personality-desc { font-size: 0.8rem; color: var(--lol-text-muted); font-style: italic; }

    .sw-fun-stats { display: flex; flex-direction: column; gap: 0.75rem; text-align: left; width: 100%; }
    .sw-fun-stat {
      font-size: 0.85rem; color: var(--lol-text-primary, #ccc); padding: 0.5rem 0.75rem;
      background: rgba(0,0,0,0.3); border-radius: 4px; border-left: 3px solid var(--lol-gold-3);
    }

    .sw-share-btn {
      background: linear-gradient(135deg, var(--lol-gold-3), var(--lol-gold-5));
      color: #0a0a0a; border: none; border-radius: 3px; padding: 0.5rem 1.5rem;
      font-weight: 700; cursor: pointer; font-size: 0.85rem; width: 100%; margin-top: 0.5rem;
    }
    .sw-restart-btn {
      background: transparent; border: 1px solid var(--lol-gold-5); color: var(--lol-gold-3);
      border-radius: 3px; padding: 0.4rem 1rem; cursor: pointer; font-size: 0.8rem; width: 100%;
    }

    .sw-error { color: var(--lol-red, #f44336); text-align: center; padding: 1rem; }
  `],
})
export class SeasonWrappedComponent {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly baseUrl = environment.apiUrl;

  gameName = '';
  tagLine = '';
  selectedRegion = 'euw1';
  readonly loading = signal(false);
  readonly data = signal<WrappedData | null>(null);
  readonly currentCard = signal(0);
  readonly error = signal('');
  readonly regions = signal<Region[]>([]);

  readonly regionOptions = computed<SelectOption[]>(() =>
    this.regions().map(r => ({ value: r.id, label: r.name }))
  );

  private readonly totalCards = 5;

  ngOnInit() {
    this.api.getRegions().subscribe({ next: (r) => this.regions.set(r) });
  }

  generate() {
    if (!this.gameName || !this.tagLine) return;

    this.loading.set(true);
    this.error.set('');
    this.data.set(null);
    this.currentCard.set(0);

    this.http.get<WrappedData>(`${this.baseUrl}/build/roast/wrapped`, {
      params: {
        gameName: this.gameName,
        tagLine: this.tagLine,
        region: this.selectedRegion,
      },
    }).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to generate wrapped');
        this.loading.set(false);
      },
    });
  }

  nextCard() {
    const cur = this.currentCard();
    if (cur < this.totalCards - 1) {
      this.currentCard.set(cur + 1);
    }
  }

  restart() {
    this.data.set(null);
    this.currentCard.set(0);
  }

  copyToClipboard() {
    if (!this.isBrowser || !this.data()) return;
    const d = this.data()!;
    const lines = [
      `SEASON WRAPPED - ${d.gameName}#${d.tagLine}`,
      `${d.totalGames} games | ${d.wins}W ${d.losses}L (${d.winRate}% WR)`,
      `Main: ${d.mostPlayedChampion.championName} (${d.mostPlayedChampion.gamesPlayed} games)`,
      `KDA: ${d.averageKda} | Build Score: ${d.buildGrade} (${d.averageBuildScore}/100)`,
      `Style: ${d.buildPersonality}`,
      '',
      ...d.funStats,
      '',
      'Get your Wrapped at DraftSense!',
    ];
    navigator.clipboard.writeText(lines.join('\n'));
  }
}
