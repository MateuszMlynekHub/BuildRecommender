import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Region } from '../../core/models/region.model';
import { environment } from '../../../environments/environment';
import { LolSelectComponent, SelectOption } from '../../shared/components/lol-select.component';

interface BuildLeaderEntry {
  gameName: string;
  tagLine: string;
  profileIconUrl: string;
  averageScore: number;
  grade: string;
  gamesAnalyzed: number;
}

@Component({
  selector: 'app-build-leaderboard',
  standalone: true,
  imports: [FormsModule, LolSelectComponent],
  template: `
    <div class="bl-container">
      <h1 class="bl-title">Best Builders</h1>
      <p class="bl-subtitle">Challenger players ranked by build quality -- who builds the smartest?</p>

      <div class="bl-controls">
        <app-lol-select
          [options]="regionOptions()"
          [value]="selectedRegion"
          (valueChange)="selectedRegion = $event; load()"
          size="sm"
        ></app-lol-select>
      </div>

      @if (loading()) {
        <div class="bl-loading">
          <span class="bl-spinner-lg"></span>
          <p>Analyzing Challenger builds... This may take a moment.</p>
        </div>
      }

      @if (entries().length > 0 && !loading()) {
        <div class="bl-table">
          <div class="bl-header">
            <span class="bl-col bl-col-rank">#</span>
            <span class="bl-col bl-col-player">Player</span>
            <span class="bl-col bl-col-grade">Grade</span>
            <span class="bl-col bl-col-score">Avg Score</span>
            <span class="bl-col bl-col-games">Games</span>
          </div>
          @for (entry of entries(); track entry.gameName + entry.tagLine; let i = $index) {
            <div class="bl-row" [class.bl-row--top3]="i < 3">
              <span class="bl-col bl-col-rank bl-rank-num">
                @if (i === 0) { <span class="bl-medal bl-gold">1</span> }
                @else if (i === 1) { <span class="bl-medal bl-silver">2</span> }
                @else if (i === 2) { <span class="bl-medal bl-bronze">3</span> }
                @else { {{ i + 1 }} }
              </span>
              <div class="bl-col bl-col-player bl-player-cell">
                @if (entry.profileIconUrl) {
                  <img class="bl-player-icon" [src]="entry.profileIconUrl" width="32" height="32" loading="lazy" />
                }
                <span class="bl-player-name">
                  {{ entry.gameName || 'Challenger' }}<span class="bl-player-tag">{{ entry.tagLine ? '#' + entry.tagLine : '' }}</span>
                </span>
              </div>
              <span class="bl-col bl-col-grade">
                <span class="bl-grade-badge" [class]="'bl-grade-badge bl-g-' + entry.grade.toLowerCase()">{{ entry.grade }}</span>
              </span>
              <span class="bl-col bl-col-score bl-score-value">{{ entry.averageScore }}/100</span>
              <span class="bl-col bl-col-games">{{ entry.gamesAnalyzed }}</span>
            </div>
          }
        </div>
      }

      @if (!loading() && entries().length === 0 && loaded()) {
        <div class="bl-empty">No data available. Try a different region.</div>
      }

      @if (error()) {
        <div class="bl-error">{{ error() }}</div>
      }
    </div>
  `,
  styles: [`
    .bl-container { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    .bl-title { font-size: 1.5rem; font-weight: 700; color: var(--lol-gold-1); margin-bottom: 0.25rem; }
    .bl-subtitle { font-size: 0.85rem; color: var(--lol-text-muted); margin-bottom: 1rem; }

    .bl-controls { display: flex; gap: 0.5rem; margin-bottom: 1rem; }

    .bl-loading {
      text-align: center; color: var(--lol-text-muted); padding: 3rem 1rem;
      display: flex; flex-direction: column; align-items: center; gap: 1rem;
    }
    .bl-spinner-lg {
      display: inline-block; width: 32px; height: 32px;
      border: 3px solid rgba(200,170,110,0.2); border-top-color: var(--lol-gold-3);
      border-radius: 50%; animation: blspin 0.8s linear infinite;
    }
    @keyframes blspin { to { transform: rotate(360deg); } }

    .bl-table {
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5); border-radius: 4px;
      overflow: hidden;
    }
    .bl-header {
      display: flex; padding: 0.5rem 0.75rem; background: rgba(200,170,110,0.1);
      border-bottom: 1px solid var(--lol-gold-5); font-size: 0.75rem; font-weight: 700;
      color: var(--lol-gold-3); text-transform: uppercase; letter-spacing: 0.05em;
    }
    .bl-row {
      display: flex; align-items: center; padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(200,170,110,0.08); font-size: 0.85rem;
    }
    .bl-row:hover { background: rgba(200,170,110,0.05); }
    .bl-row--top3 { background: rgba(200,170,110,0.03); }

    .bl-col { min-width: 0; }
    .bl-col-rank { width: 40px; text-align: center; }
    .bl-col-player { flex: 1; }
    .bl-col-grade { width: 50px; text-align: center; }
    .bl-col-score { width: 80px; text-align: right; }
    .bl-col-games { width: 55px; text-align: right; }

    .bl-rank-num { color: var(--lol-gold-3); font-weight: 700; }
    .bl-medal {
      display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 50%; font-weight: 900; font-size: 0.75rem;
    }
    .bl-gold { background: linear-gradient(135deg, #ffd700, #ffb300); color: #000; }
    .bl-silver { background: linear-gradient(135deg, #c0c0c0, #9e9e9e); color: #000; }
    .bl-bronze { background: linear-gradient(135deg, #cd7f32, #a0522d); color: #fff; }

    .bl-player-cell { display: flex; align-items: center; gap: 0.5rem; }
    .bl-player-icon { border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .bl-player-name { color: var(--lol-gold-1); font-weight: 600; }
    .bl-player-tag { color: var(--lol-text-muted); font-weight: 400; }

    .bl-grade-badge {
      display: inline-block; padding: 0.15rem 0.4rem; border-radius: 3px;
      font-weight: 900; font-size: 0.8rem;
    }
    .bl-g-s, .bl-g-a { background: rgba(76,175,80,0.2); color: #4caf50; }
    .bl-g-b { background: rgba(200,170,110,0.2); color: var(--lol-gold-3); }
    .bl-g-c { background: rgba(255,152,0,0.2); color: #ff9800; }
    .bl-g-d, .bl-g-f { background: rgba(244,67,54,0.2); color: #f44336; }

    .bl-score-value { color: var(--lol-gold-1); font-weight: 700; }
    .bl-empty { text-align: center; color: var(--lol-text-muted); padding: 2rem; }
    .bl-error { color: var(--lol-red, #f44336); text-align: center; padding: 1rem; }
  `],
})
export class BuildLeaderboardComponent {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  selectedRegion = 'euw1';
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly entries = signal<BuildLeaderEntry[]>([]);
  readonly regions = signal<Region[]>([]);
  readonly error = signal('');

  readonly regionOptions = computed<SelectOption[]>(() =>
    this.regions().map(r => ({ value: r.id, label: r.name }))
  );

  ngOnInit() {
    this.api.getRegions().subscribe({ next: (r) => this.regions.set(r) });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.entries.set([]);

    this.http.get<{ entries: BuildLeaderEntry[] }>(
      `${this.baseUrl}/build/roast/leaderboard`,
      { params: { region: this.selectedRegion } },
    ).subscribe({
      next: (res) => {
        this.entries.set(res.entries ?? []);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load leaderboard');
        this.loading.set(false);
        this.loaded.set(true);
      },
    });
  }
}
