import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { MetaShiftEntry, PatchTrend } from '../../core/models/champion-detail.model';

@Component({
  selector: 'app-meta-shift',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ms-page">
      <div class="ms-container">
        <div class="ms-hero">
          <h1 class="ms-hero__title">Meta Shift</h1>
          <p class="ms-hero__sub">Champion win rate changes between patches</p>
        </div>

        @if (entries().length > 0) {
          <!-- Winners -->
          <section class="ms-section">
            <h2 class="ms-section__title ms-section__title--up">Biggest Winners</h2>
            <div class="ms-table">
              @for (e of winners(); track e.championId + e.role; let i = $index) {
                <a class="ms-row" [routerLink]="['/champion', e.championKey]">
                  <span class="ms-col ms-col--rank">{{ i + 1 }}</span>
                  <span class="ms-col ms-col--champ">
                    <img class="ms-row__img"
                      [src]="gameState.getChampionImageUrl(e.championKey + '.png')"
                      [alt]="e.championKey" width="28" height="28" loading="lazy" />
                    {{ e.championKey }}
                  </span>
                  <span class="ms-col ms-col--spark">
                    @if (getTrendKey(e.championId, e.role); as key) {
                      @if (trendCache().get(key); as pts) {
                        <svg viewBox="0 0 60 20" class="ms-spark" preserveAspectRatio="none">
                          <polyline [attr.points]="sparklinePath(pts)" fill="none"
                            [attr.stroke]="e.winRateDelta >= 0 ? '#50E3C2' : '#E84057'" stroke-width="1.5"
                            stroke-linejoin="round" stroke-linecap="round" />
                        </svg>
                      }
                    }
                  </span>
                  <span class="ms-col ms-col--role">{{ e.role }}</span>
                  <span class="ms-col ms-col--wr">{{ (e.currentWinRate * 100).toFixed(1) }}%</span>
                  <span class="ms-col ms-col--delta ms-delta--up">+{{ (e.winRateDelta * 100).toFixed(1) }}%</span>
                  <span class="ms-col ms-col--games">{{ e.currentPicks }}g</span>
                </a>
              }
            </div>
          </section>

          <!-- Losers -->
          <section class="ms-section">
            <h2 class="ms-section__title ms-section__title--down">Biggest Losers</h2>
            <div class="ms-table">
              @for (e of losers(); track e.championId + e.role; let i = $index) {
                <a class="ms-row" [routerLink]="['/champion', e.championKey]">
                  <span class="ms-col ms-col--rank">{{ i + 1 }}</span>
                  <span class="ms-col ms-col--champ">
                    <img class="ms-row__img"
                      [src]="gameState.getChampionImageUrl(e.championKey + '.png')"
                      [alt]="e.championKey" width="28" height="28" loading="lazy" />
                    {{ e.championKey }}
                  </span>
                  <span class="ms-col ms-col--spark">
                    @if (getTrendKey(e.championId, e.role); as key) {
                      @if (trendCache().get(key); as pts) {
                        <svg viewBox="0 0 60 20" class="ms-spark" preserveAspectRatio="none">
                          <polyline [attr.points]="sparklinePath(pts)" fill="none"
                            [attr.stroke]="e.winRateDelta >= 0 ? '#50E3C2' : '#E84057'" stroke-width="1.5"
                            stroke-linejoin="round" stroke-linecap="round" />
                        </svg>
                      }
                    }
                  </span>
                  <span class="ms-col ms-col--role">{{ e.role }}</span>
                  <span class="ms-col ms-col--wr">{{ (e.currentWinRate * 100).toFixed(1) }}%</span>
                  <span class="ms-col ms-col--delta ms-delta--down">{{ (e.winRateDelta * 100).toFixed(1) }}%</span>
                  <span class="ms-col ms-col--games">{{ e.currentPicks }}g</span>
                </a>
              }
            </div>
          </section>
        } @else {
          <div class="ms-empty">Collecting patch comparison data...</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .ms-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .ms-container { max-width: 800px; margin: 0 auto; }

    .ms-hero { text-align: center; margin-bottom: 1.5rem; }
    .ms-hero__title { font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 4vw, 2.5rem); color: var(--lol-gold-1); }
    .ms-hero__sub { color: var(--lol-text-muted); font-size: 0.82rem; margin-top: 0.3rem; }

    .ms-section { margin-bottom: 1.5rem; }
    .ms-section__title {
      font-family: 'Cinzel', serif; font-size: 0.85rem; letter-spacing: 0.1em;
      text-transform: uppercase; padding-bottom: 0.4rem; margin-bottom: 0.5rem;
      border-bottom: 1px solid var(--lol-gold-5);
    }
    .ms-section__title--up { color: #50E3C2; }
    .ms-section__title--down { color: #E84057; }

    .ms-table { border: 1px solid var(--lol-gold-5); border-radius: 2px; overflow: hidden; }
    .ms-row {
      display: flex; align-items: center; padding: 0.4rem 0.6rem;
      border-bottom: 1px solid rgba(120,90,40,0.1); text-decoration: none; transition: background 0.12s;
    }
    .ms-row:hover { background: rgba(200,155,60,0.06); }
    .ms-row:last-child { border-bottom: none; }
    .ms-row__img { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .ms-col { font-size: 0.78rem; color: var(--lol-gold-1); }
    .ms-col--rank { width: 28px; text-align: center; color: var(--lol-text-muted); font-size: 0.72rem; }
    .ms-col--champ { flex: 1; display: flex; align-items: center; gap: 0.4rem; font-weight: 600; }
    .ms-col--role { width: 60px; font-size: 0.65rem; color: var(--lol-text-muted); text-transform: uppercase; }
    .ms-col--wr { width: 55px; text-align: right; font-weight: 600; }
    .ms-col--delta { width: 60px; text-align: right; font-weight: 700; font-size: 0.82rem; }
    .ms-col--games { width: 45px; text-align: right; color: var(--lol-text-muted); font-size: 0.68rem; }

    .ms-col--spark { width: 60px; height: 20px; flex-shrink: 0; }
    .ms-spark { width: 60px; height: 20px; display: block; }

    .ms-delta--up { color: #50E3C2; }
    .ms-delta--down { color: #E84057; }

    .ms-empty {
      padding: 3rem 1rem; text-align: center; color: var(--lol-text-dim);
      font-style: italic; border: 1px dashed var(--lol-gold-5); border-radius: 2px;
    }
  `],
})
export class MetaShiftComponent implements OnInit {
  private api = inject(ApiService);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly entries = signal<MetaShiftEntry[]>([]);

  readonly winners = signal<MetaShiftEntry[]>([]);
  readonly losers = signal<MetaShiftEntry[]>([]);

  /** Map of "championId:role" → PatchTrend[] for sparkline rendering. */
  readonly trendCache = signal<Map<string, PatchTrend[]>>(new Map());

  ngOnInit(): void {
    this.seo.updatePageMeta({
      title: 'Meta Shift — LoL Patch Win Rate Changes | DraftSense',
      description: 'Track League of Legends meta shifts between patches. See which champions gained or lost the most win rate this patch.',
      url: 'https://draftsense.net/meta',
    });

    if (!this.isBrowser) return;

    this.api.getMetaShift().subscribe({
      next: (data) => {
        this.entries.set(data);
        const w = data.filter(e => e.winRateDelta > 0).sort((a, b) => b.winRateDelta - a.winRateDelta).slice(0, 15);
        const l = data.filter(e => e.winRateDelta < 0).sort((a, b) => a.winRateDelta - b.winRateDelta).slice(0, 15);
        this.winners.set(w);
        this.losers.set(l);

        // Fetch patch trends for each displayed champion (deduplicated by champion ID)
        const seen = new Set<number>();
        for (const e of [...w, ...l]) {
          if (seen.has(e.championId)) continue;
          seen.add(e.championId);
          this.api.getPatchTrends(e.championId, e.role).subscribe({
            next: (trends) => {
              if (trends.length >= 2) {
                const cache = new Map(this.trendCache());
                cache.set(`${e.championId}:${e.role}`, trends);
                this.trendCache.set(cache);
              }
            },
          });
        }
      },
    });
  }

  getTrendKey(championId: number, role: string): string {
    return `${championId}:${role}`;
  }

  sparklinePath(trends: PatchTrend[]): string {
    if (trends.length < 2) return '';
    const wrs = trends.map(t => t.winRate);
    const min = Math.min(...wrs);
    const max = Math.max(...wrs);
    const range = max - min || 0.01;
    const w = 60;
    const h = 20;
    const pad = 2;
    return trends.map((t, i) => {
      const x = pad + (i / (trends.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (t.winRate - min) / range) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
  }
}
