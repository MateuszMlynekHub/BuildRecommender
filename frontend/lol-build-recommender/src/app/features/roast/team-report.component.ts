import { Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Region } from '../../core/models/region.model';
import { environment } from '../../../environments/environment';
import { LolSelectComponent, SelectOption } from '../../shared/components/lol-select.component';

interface TeamPlayerResult {
  gameName: string;
  tagLine: string;
  found: boolean;
  championName?: string;
  championImage?: string;
  score?: number;
  grade?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  win?: boolean;
  error?: string | null;
}

interface TeamReport {
  players: TeamPlayerResult[];
  teamAverage: number;
  teamGrade: string;
}

@Component({
  selector: 'app-team-report',
  standalone: true,
  imports: [FormsModule, LolSelectComponent],
  template: `
    <div class="tr-container">
      <h1 class="tr-title">Team Build Report</h1>
      <p class="tr-subtitle">Batch analyze your team's builds from their last ranked game</p>

      <div class="tr-input-area">
        <div class="tr-field">
          <label class="tr-label">Enter Riot IDs (comma-separated, name#tag format)</label>
          <textarea
            class="tr-textarea"
            [(ngModel)]="inputText"
            placeholder="Player1#EUW, Player2#NA1, Player3#KR"
            rows="3"
          ></textarea>
        </div>
        <div class="tr-field">
          <label class="tr-label">Region</label>
          <app-lol-select
            [options]="regionOptions()"
            [value]="selectedRegion"
            (valueChange)="selectedRegion = $event"
            [fullWidth]="true"
          ></app-lol-select>
        </div>
        <button class="btn-gold w-full flex items-center justify-center gap-3" (click)="analyze()" [disabled]="loading()">
          @if (loading()) { <span class="tr-spinner"></span> }
          Analyze Team
        </button>
      </div>

      @if (report()) {
        <div class="tr-report">
          <div class="tr-team-summary" [class]="'tr-team-summary tr-grade-' + report()!.teamGrade.toLowerCase()">
            <div class="tr-team-grade-circle">
              <span class="tr-team-grade">{{ report()!.teamGrade }}</span>
              <span class="tr-team-score">{{ report()!.teamAverage }}/100</span>
            </div>
            <div class="tr-team-info">
              <div class="tr-team-label">TEAM BUILD SCORE</div>
              <div class="tr-team-subtitle-text">Average across {{ report()!.players.length }} players</div>
            </div>
          </div>

          <div class="tr-players">
            @for (player of report()!.players; track player.gameName + '#' + player.tagLine) {
              <div class="tr-player-card" [class.tr-player--error]="player.error || !player.found">
                <div class="tr-player-header">
                  @if (player.championImage) {
                    <img class="tr-player-champ" [src]="player.championImage" width="40" height="40" loading="lazy" />
                  }
                  <div class="tr-player-info">
                    <div class="tr-player-name">{{ player.gameName }}<span class="tr-player-tag">#{{ player.tagLine }}</span></div>
                    @if (player.championName) {
                      <div class="tr-player-champ-name">{{ player.championName }}</div>
                    }
                  </div>
                  @if (player.score !== undefined && player.score !== null) {
                    <div class="tr-player-score-badge" [class]="'tr-player-score-badge tr-badge-' + player.grade?.toLowerCase()">
                      <span class="tr-badge-grade">{{ player.grade }}</span>
                      <span class="tr-badge-score">{{ player.score }}</span>
                    </div>
                  }
                </div>
                @if (player.kills !== undefined) {
                  <div class="tr-player-stats">
                    <span class="tr-stat">{{ player.kills }}/{{ player.deaths }}/{{ player.assists }}</span>
                    <span class="tr-stat" [class.tr-win]="player.win" [class.tr-loss]="!player.win">
                      {{ player.win ? 'Victory' : 'Defeat' }}
                    </span>
                  </div>
                }
                @if (player.error) {
                  <div class="tr-player-error">{{ player.error }}</div>
                }
              </div>
            }
          </div>

          <button class="tr-share-btn" (click)="copyToClipboard()">Copy Team Report</button>
        </div>
      }

      @if (error()) {
        <div class="tr-error">{{ error() }}</div>
      }
    </div>
  `,
  styles: [`
    .tr-container { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    .tr-title { font-size: 1.5rem; font-weight: 700; color: var(--lol-gold-1); margin-bottom: 0.25rem; }
    .tr-subtitle { font-size: 0.85rem; color: var(--lol-text-muted); margin-bottom: 1.5rem; }

    .tr-input-area {
      background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 1rem; margin-bottom: 1.5rem;
    }
    .tr-field { margin-bottom: 0.75rem; }
    .tr-label { font-size: 0.65rem; font-family: 'Cinzel', serif; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lol-gold-3); font-weight: 600; display: block; margin-bottom: 0.35rem; }
    .tr-textarea {
      width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; color: var(--lol-text-primary, #ccc); font-family: monospace;
      font-size: 0.85rem; padding: 0.5rem; resize: vertical;
    }
    .tr-textarea::placeholder { color: var(--lol-text-muted); }
    .tr-spinner {
      display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%; animation: trspin 0.6s linear infinite;
    }
    @keyframes trspin { to { transform: rotate(360deg); } }

    .tr-report { display: flex; flex-direction: column; gap: 1rem; }

    .tr-team-summary {
      display: flex; gap: 1rem; align-items: center; padding: 1.25rem;
      background: rgba(1,10,19,0.7); border: 2px solid var(--lol-gold-3); border-radius: 8px;
    }
    .tr-grade-s, .tr-grade-a { border-color: #4caf50; }
    .tr-grade-b { border-color: var(--lol-gold-3); }
    .tr-grade-c { border-color: #ff9800; }
    .tr-grade-d, .tr-grade-f { border-color: #f44336; }

    .tr-team-grade-circle {
      width: 70px; height: 70px; border-radius: 50%; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(200,170,110,0.1); border: 2px solid var(--lol-gold-3);
    }
    .tr-team-grade { font-size: 1.8rem; font-weight: 900; color: var(--lol-gold-1); line-height: 1; }
    .tr-team-score { font-size: 0.65rem; color: var(--lol-text-muted); }
    .tr-team-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lol-gold-3); }
    .tr-team-subtitle-text { font-size: 0.85rem; color: var(--lol-text-muted); }
    .tr-team-info { flex: 1; }

    .tr-players { display: flex; flex-direction: column; gap: 0.5rem; }
    .tr-player-card {
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 0.75rem 1rem;
    }
    .tr-player--error { opacity: 0.6; }
    .tr-player-header { display: flex; gap: 0.75rem; align-items: center; }
    .tr-player-champ { border-radius: 50%; border: 2px solid var(--lol-gold-5); }
    .tr-player-info { flex: 1; }
    .tr-player-name { font-size: 0.95rem; font-weight: 700; color: var(--lol-gold-1); }
    .tr-player-tag { color: var(--lol-text-muted); font-weight: 400; }
    .tr-player-champ-name { font-size: 0.75rem; color: var(--lol-gold-3); }

    .tr-player-score-badge {
      width: 48px; height: 48px; border-radius: 50%; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(200,170,110,0.1); border: 2px solid var(--lol-gold-3);
    }
    .tr-badge-s, .tr-badge-a { border-color: #4caf50; }
    .tr-badge-b { border-color: var(--lol-gold-3); }
    .tr-badge-c { border-color: #ff9800; }
    .tr-badge-d, .tr-badge-f { border-color: #f44336; }
    .tr-badge-grade { font-size: 1rem; font-weight: 900; color: var(--lol-gold-1); line-height: 1; }
    .tr-badge-score { font-size: 0.55rem; color: var(--lol-text-muted); }

    .tr-player-stats {
      display: flex; gap: 1rem; margin-top: 0.4rem; font-size: 0.8rem;
    }
    .tr-stat { color: var(--lol-text-muted); }
    .tr-win { color: #4caf50; font-weight: 600; }
    .tr-loss { color: #f44336; font-weight: 600; }
    .tr-player-error { color: var(--lol-text-muted); font-size: 0.75rem; font-style: italic; margin-top: 0.25rem; }

    .tr-share-btn {
      background: linear-gradient(135deg, var(--lol-gold-3), var(--lol-gold-5));
      color: #0a0a0a; border: none; border-radius: 3px; padding: 0.5rem 1.5rem;
      font-weight: 700; cursor: pointer; font-size: 0.85rem; width: 100%;
    }

    .tr-error { color: var(--lol-red, #f44336); text-align: center; padding: 1rem; }
  `],
})
export class TeamReportComponent {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly baseUrl = environment.apiUrl;

  inputText = '';
  selectedRegion = 'euw1';
  readonly loading = signal(false);
  readonly report = signal<TeamReport | null>(null);
  readonly error = signal('');
  readonly regions = signal<Region[]>([]);

  readonly regionOptions = computed<SelectOption[]>(() =>
    this.regions().map(r => ({ value: r.id, label: r.name }))
  );

  ngOnInit() {
    this.api.getRegions().subscribe({ next: (r) => this.regions.set(r) });
  }

  analyze() {
    const text = this.inputText.trim();
    if (!text) return;

    this.loading.set(true);
    this.error.set('');
    this.report.set(null);

    this.http.get<TeamReport>(`${this.baseUrl}/build/roast/team`, {
      params: { players: text, region: this.selectedRegion },
    }).subscribe({
      next: (res) => {
        this.report.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to analyze team');
        this.loading.set(false);
      },
    });
  }

  copyToClipboard() {
    if (!this.isBrowser || !this.report()) return;
    const r = this.report()!;
    const lines = [
      `TEAM BUILD REPORT - Grade: ${r.teamGrade} (${r.teamAverage}/100)`,
      '',
      ...r.players.map(p =>
        p.score !== undefined
          ? `${p.gameName}#${p.tagLine} - ${p.championName} - ${p.grade} (${p.score}/100) ${p.win ? 'W' : 'L'}`
          : `${p.gameName}#${p.tagLine} - ${p.error || 'N/A'}`
      ),
      '',
      'Analyzed at DraftSense!',
    ];
    navigator.clipboard.writeText(lines.join('\n'));
  }
}
