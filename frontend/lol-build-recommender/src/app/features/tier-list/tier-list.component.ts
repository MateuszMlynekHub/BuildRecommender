import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { TierListEntry } from '../../core/models/champion-detail.model';
import { LaneRole, LANE_ORDER } from '../../core/models/champion.model';
import { TPipe } from '../../shared/pipes/t.pipe';

type SortKey = 'winRate' | 'picks' | 'name';
type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

function assignTier(wr: number, avgWr: number): Tier {
  const diff = wr - avgWr;
  if (diff > 0.03) return 'S';
  if (diff > 0.01) return 'A';
  if (diff > -0.01) return 'B';
  if (diff > -0.03) return 'C';
  return 'D';
}

@Component({
  selector: 'app-tier-list',
  standalone: true,
  imports: [RouterLink, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tl-page">
      <div class="tl-container">
        <div class="tl-hero">
          <h1 class="tl-hero__title">LoL Tier List</h1>
          <p class="tl-hero__sub">Champion win rates from Challenger & Grandmaster matches</p>
        </div>

        <!-- Role filter -->
        <div class="tl-filters">
          <button class="tl-role" [class.tl-role--active]="!activeRole()" (click)="setRole(null)">ALL</button>
          @for (role of roles; track role) {
            <button class="tl-role" [class.tl-role--active]="activeRole() === role" (click)="setRole(role)">
              {{ roleName(role) }}
            </button>
          }

          <div class="tl-sort">
            <button class="tl-sort__btn" [class.tl-sort__btn--active]="sortKey() === 'winRate'" (click)="sortKey.set('winRate')">Win Rate</button>
            <button class="tl-sort__btn" [class.tl-sort__btn--active]="sortKey() === 'picks'" (click)="sortKey.set('picks')">Pick Rate</button>
            <button class="tl-sort__btn" [class.tl-sort__btn--active]="sortKey() === 'name'" (click)="sortKey.set('name')">Name</button>
          </div>
        </div>

        <!-- Table -->
        @if (sortedEntries().length > 0) {
          <div class="tl-table">
            <div class="tl-header">
              <span class="tl-col tl-col--rank">#</span>
              <span class="tl-col tl-col--tier">Tier</span>
              <span class="tl-col tl-col--champ">Champion</span>
              <span class="tl-col tl-col--role">Role</span>
              <span class="tl-col tl-col--wr">Win Rate</span>
              <span class="tl-col tl-col--pr">Games</span>
            </div>
            @for (entry of sortedEntries(); track entry.championId + entry.role; let i = $index) {
              <a class="tl-row" [routerLink]="['/champion', entry.championKey]">
                <span class="tl-col tl-col--rank">{{ i + 1 }}</span>
                <span class="tl-col tl-col--tier" [attr.data-tier]="getTier(entry)">{{ getTier(entry) }}</span>
                <span class="tl-col tl-col--champ">
                  <img class="tl-row__img"
                    [src]="gameState.getChampionImageUrl(entry.championKey + '.png')"
                    [alt]="entry.championKey" width="32" height="32" loading="lazy" />
                  {{ entry.championKey }}
                </span>
                <span class="tl-col tl-col--role">{{ entry.role }}</span>
                <span class="tl-col tl-col--wr" [class.tl-wr--high]="entry.winRate > 0.52" [class.tl-wr--low]="entry.winRate < 0.48">
                  {{ (entry.winRate * 100).toFixed(1) }}%
                </span>
                <span class="tl-col tl-col--pr">{{ entry.picks }}</span>
              </a>
            }
          </div>
        } @else {
          <div class="tl-empty">Collecting tier list data from Challenger matches...</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .tl-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .tl-container { max-width: 900px; margin: 0 auto; }

    .tl-hero { text-align: center; margin-bottom: 1.5rem; }
    .tl-hero__title {
      font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 4vw, 2.5rem);
      color: var(--lol-gold-1); letter-spacing: 0.05em;
    }
    .tl-hero__sub { color: var(--lol-text-muted); font-size: 0.82rem; margin-top: 0.3rem; }

    .tl-filters {
      display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;
      margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--lol-gold-5);
    }
    .tl-role {
      padding: 0.35rem 0.7rem; font-family: 'Cinzel', serif; font-size: 0.65rem;
      font-weight: 600; letter-spacing: 0.08em; color: var(--lol-text-muted);
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .tl-role:hover { color: var(--lol-gold-2); border-color: var(--lol-gold-4); }
    .tl-role--active { color: var(--lol-gold-1); background: rgba(200,155,60,0.15); border-color: var(--lol-gold-3); }

    .tl-sort { margin-left: auto; display: flex; gap: 0.3rem; }
    .tl-sort__btn {
      padding: 0.3rem 0.6rem; font-size: 0.62rem; font-weight: 500;
      color: var(--lol-text-dim); background: transparent; border: 1px solid transparent;
      border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .tl-sort__btn:hover { color: var(--lol-gold-2); }
    .tl-sort__btn--active { color: var(--lol-gold-1); border-color: var(--lol-gold-5); }

    .tl-table { border: 1px solid var(--lol-gold-5); border-radius: 2px; overflow: hidden; }
    .tl-header {
      display: flex; align-items: center; padding: 0.5rem 0.75rem;
      background: rgba(200,155,60,0.08); border-bottom: 1px solid var(--lol-gold-5);
      font-family: 'Cinzel', serif; font-size: 0.62rem; font-weight: 600;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--lol-gold-2);
    }
    .tl-row {
      display: flex; align-items: center; padding: 0.45rem 0.75rem;
      border-bottom: 1px solid rgba(120,90,40,0.12); text-decoration: none;
      transition: background 0.12s; cursor: pointer;
    }
    .tl-row:hover { background: rgba(200,155,60,0.06); }
    .tl-row:last-child { border-bottom: none; }

    .tl-col { font-size: 0.78rem; color: var(--lol-gold-1); }
    .tl-col--rank { width: 36px; text-align: center; color: var(--lol-text-muted); font-size: 0.72rem; }
    .tl-col--tier { width: 36px; text-align: center; font-weight: 700; font-family: 'Cinzel', serif; font-size: 0.82rem; }
    .tl-col--champ { flex: 1; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
    .tl-col--role { width: 70px; font-size: 0.68rem; color: var(--lol-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .tl-col--wr { width: 70px; text-align: right; font-weight: 700; }
    .tl-col--pr { width: 60px; text-align: right; color: var(--lol-text-muted); font-size: 0.72rem; }

    .tl-row__img { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--lol-gold-5); }

    [data-tier="S"] { color: #FF7043; }
    [data-tier="A"] { color: #C89B3C; }
    [data-tier="B"] { color: #0AC8B9; }
    [data-tier="C"] { color: #A0A0A0; }
    [data-tier="D"] { color: #787878; }

    .tl-wr--high { color: var(--lol-cyan); }
    .tl-wr--low { color: #E84057; }

    .tl-empty {
      padding: 3rem 1rem; text-align: center; color: var(--lol-text-dim);
      font-style: italic; border: 1px dashed var(--lol-gold-5); border-radius: 2px;
    }
  `],
})
export class TierListComponent implements OnInit {
  private api = inject(ApiService);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly roles: readonly LaneRole[] = LANE_ORDER;
  readonly activeRole = signal<LaneRole | null>(null);
  readonly sortKey = signal<SortKey>('winRate');
  readonly allEntries = signal<TierListEntry[]>([]);

  readonly sortedEntries = computed(() => {
    const entries = [...this.allEntries()];
    const key = this.sortKey();
    if (key === 'winRate') entries.sort((a, b) => b.winRate - a.winRate);
    else if (key === 'picks') entries.sort((a, b) => b.picks - a.picks);
    else entries.sort((a, b) => a.championKey.localeCompare(b.championKey));
    return entries;
  });

  private avgWinRate = 0.5;

  ngOnInit(): void {
    this.seo.updatePageMeta({
      title: 'LoL Tier List — Best Champions by Win Rate | DraftSense',
      description: 'League of Legends tier list based on Challenger and Grandmaster win rates. Find the best champions for every role this patch.',
      url: 'https://draftsense.net/tier-list',
    });

    if (!this.isBrowser) return;
    this.loadData();
  }

  setRole(role: LaneRole | null): void {
    this.activeRole.set(role);
    this.loadData();
  }

  getTier(entry: TierListEntry): Tier {
    return assignTier(entry.winRate, this.avgWinRate);
  }

  roleName(role: LaneRole): string {
    const names: Record<LaneRole, string> = {
      TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'Bot', UTILITY: 'Support',
    };
    return names[role];
  }

  private loadData(): void {
    const role = this.activeRole() ?? undefined;
    this.api.getTierList(role).subscribe({
      next: (entries) => {
        this.allEntries.set(entries);
        if (entries.length > 0) {
          const totalPicks = entries.reduce((s, e) => s + e.picks, 0);
          const totalWins = entries.reduce((s, e) => s + e.wins, 0);
          this.avgWinRate = totalPicks > 0 ? totalWins / totalPicks : 0.5;
        }
      },
    });
  }
}
