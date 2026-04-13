import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { DuoSynergy } from '../../core/models/champion-detail.model';

type SortKey = 'winRate' | 'picks';

interface LanePair {
  label: string;
  lane: string | null;
}

@Component({
  selector: 'app-duo-synergy',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ds-page">
      <div class="ds-container">
        <div class="ds-hero">
          <h1 class="ds-hero__title">Duo Synergy</h1>
          <p class="ds-hero__sub">Best champion pairs by win rate in high-elo matches</p>
        </div>

        <!-- Lane pair filter -->
        <div class="ds-filters">
          @for (lp of lanePairs; track lp.label) {
            <button class="ds-lane" [class.ds-lane--active]="activeLane() === lp.lane" (click)="setLane(lp.lane)">
              {{ lp.label }}
            </button>
          }

          <div class="ds-sort">
            <button class="ds-sort__btn" [class.ds-sort__btn--active]="sortKey() === 'winRate'" (click)="sortKey.set('winRate')">Win Rate</button>
            <button class="ds-sort__btn" [class.ds-sort__btn--active]="sortKey() === 'picks'" (click)="sortKey.set('picks')">Games</button>
          </div>
        </div>

        <!-- Table -->
        @if (sortedEntries().length > 0) {
          <div class="ds-table">
            <div class="ds-header">
              <span class="ds-col ds-col--rank">#</span>
              <span class="ds-col ds-col--champ1">Champion 1</span>
              <span class="ds-col ds-col--plus">+</span>
              <span class="ds-col ds-col--champ2">Champion 2</span>
              <span class="ds-col ds-col--lanes">Lanes</span>
              <span class="ds-col ds-col--wr">Win Rate</span>
              <span class="ds-col ds-col--games">Games</span>
            </div>
            @for (entry of sortedEntries(); track entry.champion1Id + ':' + entry.champion2Id; let i = $index) {
              <div class="ds-row">
                <span class="ds-col ds-col--rank">{{ i + 1 }}</span>
                <a class="ds-col ds-col--champ1" [routerLink]="['/champion', entry.champion1Key]">
                  <img class="ds-row__img"
                    [src]="gameState.getChampionImageUrl(entry.champion1Key + '.png')"
                    [alt]="entry.champion1Key" width="32" height="32" loading="lazy" />
                  <span class="ds-champ-name">{{ entry.champion1Key }}</span>
                </a>
                <span class="ds-col ds-col--plus ds-plus-icon">+</span>
                <a class="ds-col ds-col--champ2" [routerLink]="['/champion', entry.champion2Key]">
                  <img class="ds-row__img"
                    [src]="gameState.getChampionImageUrl(entry.champion2Key + '.png')"
                    [alt]="entry.champion2Key" width="32" height="32" loading="lazy" />
                  <span class="ds-champ-name">{{ entry.champion2Key }}</span>
                </a>
                <span class="ds-col ds-col--lanes">
                  <span class="ds-lane-tag">{{ formatLane(entry.lane1) }}</span>
                  <span class="ds-lane-sep">+</span>
                  <span class="ds-lane-tag">{{ formatLane(entry.lane2) }}</span>
                </span>
                <span class="ds-col ds-col--wr" [class.ds-wr--high]="entry.winRate > 0.52" [class.ds-wr--low]="entry.winRate < 0.48">
                  {{ (entry.winRate * 100).toFixed(1) }}%
                </span>
                <span class="ds-col ds-col--games">{{ entry.picks }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="ds-empty">Collecting duo synergy data from high-elo matches...</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .ds-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .ds-container { max-width: 960px; margin: 0 auto; }

    .ds-hero { text-align: center; margin-bottom: 1.5rem; }
    .ds-hero__title {
      font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 4vw, 2.5rem);
      color: var(--lol-gold-1); letter-spacing: 0.05em;
    }
    .ds-hero__sub { color: var(--lol-text-muted); font-size: 0.82rem; margin-top: 0.3rem; }

    .ds-filters {
      display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;
      margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--lol-gold-5);
    }
    .ds-lane {
      padding: 0.35rem 0.7rem; font-family: 'Cinzel', serif; font-size: 0.65rem;
      font-weight: 600; letter-spacing: 0.08em; color: var(--lol-text-muted);
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .ds-lane:hover { color: var(--lol-gold-2); border-color: var(--lol-gold-4); }
    .ds-lane--active { color: var(--lol-gold-1); background: rgba(200,155,60,0.15); border-color: var(--lol-gold-3); }

    .ds-sort { margin-left: auto; display: flex; gap: 0.3rem; }
    .ds-sort__btn {
      padding: 0.3rem 0.6rem; font-size: 0.62rem; font-weight: 500;
      color: var(--lol-text-dim); background: transparent; border: 1px solid transparent;
      border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .ds-sort__btn:hover { color: var(--lol-gold-2); }
    .ds-sort__btn--active { color: var(--lol-gold-1); border-color: var(--lol-gold-5); }

    .ds-table { border: 1px solid var(--lol-gold-5); border-radius: 2px; overflow: hidden; }
    .ds-header {
      display: flex; align-items: center; padding: 0.5rem 0.75rem;
      background: rgba(200,155,60,0.08); border-bottom: 1px solid var(--lol-gold-5);
      font-family: 'Cinzel', serif; font-size: 0.62rem; font-weight: 600;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--lol-gold-2);
    }
    .ds-row {
      display: flex; align-items: center; padding: 0.45rem 0.75rem;
      border-bottom: 1px solid rgba(120,90,40,0.12); transition: background 0.12s;
    }
    .ds-row:hover { background: rgba(200,155,60,0.06); }
    .ds-row:last-child { border-bottom: none; }

    .ds-col { font-size: 0.78rem; color: var(--lol-gold-1); }
    .ds-col--rank { width: 32px; text-align: center; color: var(--lol-text-muted); font-size: 0.72rem; }
    .ds-col--champ1, .ds-col--champ2 {
      flex: 1; display: flex; align-items: center; gap: 0.4rem;
      font-weight: 600; text-decoration: none; color: var(--lol-gold-1);
      cursor: pointer;
    }
    .ds-col--champ1:hover, .ds-col--champ2:hover { color: var(--lol-cyan); }
    .ds-col--plus { width: 24px; text-align: center; }
    .ds-plus-icon { color: var(--lol-gold-3); font-weight: 700; font-size: 0.9rem; }
    .ds-col--lanes { width: 120px; display: flex; align-items: center; gap: 0.2rem; }
    .ds-col--wr { width: 65px; text-align: right; font-weight: 700; }
    .ds-col--games { width: 55px; text-align: right; color: var(--lol-text-muted); font-size: 0.72rem; }

    .ds-row__img { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .ds-champ-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .ds-lane-tag {
      font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--lol-text-muted); padding: 0.1rem 0.3rem;
      background: rgba(1,10,19,0.4); border: 1px solid rgba(120,90,40,0.15);
      border-radius: 2px;
    }
    .ds-lane-sep { color: var(--lol-text-dim); font-size: 0.6rem; }

    .ds-wr--high { color: var(--lol-cyan); }
    .ds-wr--low { color: #E84057; }

    .ds-empty {
      padding: 3rem 1rem; text-align: center; color: var(--lol-text-dim);
      font-style: italic; border: 1px dashed var(--lol-gold-5); border-radius: 2px;
    }

    @media (max-width: 640px) {
      .ds-col--lanes { display: none; }
      .ds-champ-name { font-size: 0.7rem; }
    }
  `],
})
export class DuoSynergyComponent implements OnInit {
  private api = inject(ApiService);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly lanePairs: readonly LanePair[] = [
    { label: 'ALL', lane: null },
    { label: 'BOT + SUP', lane: 'BOTTOM' },
    { label: 'TOP + JG', lane: 'TOP' },
    { label: 'MID + JG', lane: 'MIDDLE' },
  ];

  readonly activeLane = signal<string | null>(null);
  readonly sortKey = signal<SortKey>('winRate');
  readonly allEntries = signal<DuoSynergy[]>([]);

  readonly sortedEntries = computed(() => {
    const entries = [...this.allEntries()];
    const key = this.sortKey();
    if (key === 'winRate') entries.sort((a, b) => b.winRate - a.winRate);
    else entries.sort((a, b) => b.picks - a.picks);
    return entries;
  });

  ngOnInit(): void {
    this.seo.updatePageMeta({
      title: 'Duo Synergy — Best Champion Pairs | DraftSense',
      description: 'Find the best duo champion pairs for League of Legends. Win rate data from high-elo Challenger and Grandmaster matches.',
      url: 'https://draftsense.net/duo-synergy',
    });

    if (!this.isBrowser) return;
    this.loadData();
  }

  setLane(lane: string | null): void {
    this.activeLane.set(lane);
    this.loadData();
  }

  formatLane(lane: string): string {
    const names: Record<string, string> = {
      TOP: 'Top', JUNGLE: 'Jg', MIDDLE: 'Mid', BOTTOM: 'Bot', UTILITY: 'Sup',
    };
    return names[lane] ?? lane;
  }

  private loadData(): void {
    const lane = this.activeLane() ?? undefined;
    this.api.getDuoSynergies(lane).subscribe({
      next: (entries) => this.allEntries.set(entries),
    });
  }
}
