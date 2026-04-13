import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { TierListEntry } from '../../core/models/champion-detail.model';
import { LaneRole, LANE_ORDER } from '../../core/models/champion.model';

type SortKey = 'winRate' | 'picks' | 'name';
type Tier = 'S' | 'A' | 'B' | 'C' | 'D';
type GameMode = 'RANKED' | 'ARAM' | 'ARENA';

function assignTier(wr: number, avgWr: number): Tier {
  const diff = wr - avgWr;
  if (diff > 0.03) return 'S';
  if (diff > 0.01) return 'A';
  if (diff > -0.01) return 'B';
  if (diff > -0.03) return 'C';
  return 'D';
}

@Component({
  selector: 'app-mode-tierlist',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mtl-page">
      <div class="mtl-container">
        <div class="mtl-hero">
          <h1 class="mtl-hero__title">Mode Tier List</h1>
          <p class="mtl-hero__sub">Champion rankings for ARAM, Arena & Ranked</p>
        </div>

        <!-- Mode selector -->
        <div class="mtl-modes">
          @for (m of modes; track m) {
            <button class="mtl-mode" [class.mtl-mode--active]="activeMode() === m" (click)="setMode(m)">
              {{ m }}
            </button>
          }
        </div>

        <!-- Role filter (hidden for Arena) -->
        @if (activeMode() !== 'ARENA') {
          <div class="mtl-filters">
            <button class="mtl-role" [class.mtl-role--active]="!activeRole()" (click)="setRole(null)">ALL</button>
            @for (role of roles; track role) {
              <button class="mtl-role" [class.mtl-role--active]="activeRole() === role" (click)="setRole(role)">
                {{ roleName(role) }}
              </button>
            }

            <div class="mtl-sort">
              <button class="mtl-sort__btn" [class.mtl-sort__btn--active]="sortKey() === 'winRate'" (click)="sortKey.set('winRate')">Win Rate</button>
              <button class="mtl-sort__btn" [class.mtl-sort__btn--active]="sortKey() === 'picks'" (click)="sortKey.set('picks')">Pick Rate</button>
              <button class="mtl-sort__btn" [class.mtl-sort__btn--active]="sortKey() === 'name'" (click)="sortKey.set('name')">Name</button>
            </div>
          </div>
        }

        <!-- Mode badge -->
        <div class="mtl-badge">
          <span class="mtl-badge__label">Mode:</span>
          <span class="mtl-badge__value">{{ activeMode() }}</span>
        </div>

        <!-- Table -->
        @if (sortedEntries().length > 0) {
          <div class="mtl-table">
            <div class="mtl-header">
              <span class="mtl-col mtl-col--rank">#</span>
              <span class="mtl-col mtl-col--tier">Tier</span>
              <span class="mtl-col mtl-col--champ">Champion</span>
              <span class="mtl-col mtl-col--role">Role</span>
              <span class="mtl-col mtl-col--wr">Win Rate</span>
              <span class="mtl-col mtl-col--ban">Ban Rate</span>
              <span class="mtl-col mtl-col--pr">Games</span>
            </div>
            @for (entry of sortedEntries(); track entry.championId + entry.role; let i = $index) {
              <a class="mtl-row" [routerLink]="['/champion', entry.championKey]">
                <span class="mtl-col mtl-col--rank">{{ i + 1 }}</span>
                <span class="mtl-col mtl-col--tier" [attr.data-tier]="getTier(entry)">{{ getTier(entry) }}</span>
                <span class="mtl-col mtl-col--champ">
                  <img class="mtl-row__img"
                    [src]="gameState.getChampionImageUrl(entry.championKey + '.png')"
                    [alt]="entry.championKey" width="32" height="32" loading="lazy" />
                  {{ entry.championKey }}
                </span>
                <span class="mtl-col mtl-col--role">{{ entry.role }}</span>
                <span class="mtl-col mtl-col--wr" [class.mtl-wr--high]="entry.winRate > 0.52" [class.mtl-wr--low]="entry.winRate < 0.48">
                  {{ (entry.winRate * 100).toFixed(1) }}%
                </span>
                <span class="mtl-col mtl-col--ban" [class.mtl-ban--high]="entry.banRate > 0.2">
                  {{ (entry.banRate * 100).toFixed(1) }}%
                </span>
                <span class="mtl-col mtl-col--pr">{{ entry.picks }}</span>
              </a>
            }
          </div>
        } @else {
          <div class="mtl-empty">Collecting {{ activeMode() }} tier list data...</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .mtl-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .mtl-container { max-width: 900px; margin: 0 auto; }

    .mtl-hero { text-align: center; margin-bottom: 1.5rem; }
    .mtl-hero__title {
      font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 4vw, 2.5rem);
      color: var(--lol-gold-1); letter-spacing: 0.05em;
    }
    .mtl-hero__sub { color: var(--lol-text-muted); font-size: 0.82rem; margin-top: 0.3rem; }

    .mtl-modes {
      display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1rem;
    }
    .mtl-mode {
      padding: 0.5rem 1.5rem; font-family: 'Cinzel', serif; font-size: 0.78rem;
      font-weight: 700; letter-spacing: 0.1em; color: var(--lol-text-muted);
      background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; cursor: pointer; transition: all 0.15s;
    }
    .mtl-mode:hover { color: var(--lol-gold-2); border-color: var(--lol-gold-4); }
    .mtl-mode--active {
      color: var(--lol-gold-1); background: rgba(200,155,60,0.2);
      border-color: var(--lol-gold-3); text-shadow: 0 0 8px rgba(200,155,60,0.3);
    }

    .mtl-badge {
      display: inline-flex; align-items: center; gap: 0.4rem;
      margin-bottom: 0.8rem; padding: 0.25rem 0.6rem;
      background: rgba(200,155,60,0.1); border: 1px solid var(--lol-gold-5);
      border-radius: 2px; font-size: 0.7rem;
    }
    .mtl-badge__label { color: var(--lol-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .mtl-badge__value { color: var(--lol-gold-1); font-weight: 700; }

    .mtl-filters {
      display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;
      margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--lol-gold-5);
    }
    .mtl-role {
      padding: 0.35rem 0.7rem; font-family: 'Cinzel', serif; font-size: 0.65rem;
      font-weight: 600; letter-spacing: 0.08em; color: var(--lol-text-muted);
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .mtl-role:hover { color: var(--lol-gold-2); border-color: var(--lol-gold-4); }
    .mtl-role--active { color: var(--lol-gold-1); background: rgba(200,155,60,0.15); border-color: var(--lol-gold-3); }

    .mtl-sort { margin-left: auto; display: flex; gap: 0.3rem; }
    .mtl-sort__btn {
      padding: 0.3rem 0.6rem; font-size: 0.62rem; font-weight: 500;
      color: var(--lol-text-dim); background: transparent; border: 1px solid transparent;
      border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .mtl-sort__btn:hover { color: var(--lol-gold-2); }
    .mtl-sort__btn--active { color: var(--lol-gold-1); border-color: var(--lol-gold-5); }

    .mtl-table { border: 1px solid var(--lol-gold-5); border-radius: 2px; overflow: hidden; }
    .mtl-header {
      display: flex; align-items: center; padding: 0.5rem 0.75rem;
      background: rgba(200,155,60,0.08); border-bottom: 1px solid var(--lol-gold-5);
      font-family: 'Cinzel', serif; font-size: 0.62rem; font-weight: 600;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--lol-gold-2);
    }
    .mtl-row {
      display: flex; align-items: center; padding: 0.45rem 0.75rem;
      border-bottom: 1px solid rgba(120,90,40,0.12); text-decoration: none;
      transition: background 0.12s; cursor: pointer;
    }
    .mtl-row:hover { background: rgba(200,155,60,0.06); }
    .mtl-row:last-child { border-bottom: none; }

    .mtl-col { font-size: 0.78rem; color: var(--lol-gold-1); }
    .mtl-col--rank { width: 36px; text-align: center; color: var(--lol-text-muted); font-size: 0.72rem; }
    .mtl-col--tier { width: 36px; text-align: center; font-weight: 700; font-family: 'Cinzel', serif; font-size: 0.82rem; }
    .mtl-col--champ { flex: 1; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
    .mtl-col--role { width: 70px; font-size: 0.68rem; color: var(--lol-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .mtl-col--wr { width: 65px; text-align: right; font-weight: 700; }
    .mtl-col--ban { width: 65px; text-align: right; font-size: 0.72rem; color: var(--lol-text-muted); }
    .mtl-col--pr { width: 55px; text-align: right; color: var(--lol-text-muted); font-size: 0.72rem; }
    .mtl-ban--high { color: #E84057; font-weight: 600; }

    .mtl-row__img { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--lol-gold-5); }

    [data-tier="S"] { color: #FF7043; }
    [data-tier="A"] { color: #C89B3C; }
    [data-tier="B"] { color: #0AC8B9; }
    [data-tier="C"] { color: #A0A0A0; }
    [data-tier="D"] { color: #787878; }

    .mtl-wr--high { color: var(--lol-cyan); }
    .mtl-wr--low { color: #E84057; }

    .mtl-empty {
      padding: 3rem 1rem; text-align: center; color: var(--lol-text-dim);
      font-style: italic; border: 1px dashed var(--lol-gold-5); border-radius: 2px;
    }
  `],
})
export class ModeTierListComponent implements OnInit {
  private api = inject(ApiService);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly modes: readonly GameMode[] = ['RANKED', 'ARAM', 'ARENA'];
  readonly roles: readonly LaneRole[] = LANE_ORDER;
  readonly activeMode = signal<GameMode>('ARAM');
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
      title: 'ARAM & Arena Tier List — Best Champions by Mode | DraftSense',
      description: 'League of Legends tier list for ARAM, Arena, and Ranked modes. Find the best champions for every game mode this patch.',
      url: 'https://draftsense.net/mode-tierlist',
    });

    if (!this.isBrowser) return;
    this.loadData();
  }

  setMode(mode: GameMode): void {
    this.activeMode.set(mode);
    if (mode === 'ARENA') this.activeRole.set(null);
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
    const mode = this.activeMode();
    const role = this.activeRole() ?? undefined;
    this.api.getModeTierList(mode, role).subscribe({
      next: (res) => {
        this.allEntries.set(res.entries);
        if (res.entries.length > 0) {
          const totalPicks = res.entries.reduce((s, e) => s + e.picks, 0);
          const totalWins = res.entries.reduce((s, e) => s + e.wins, 0);
          this.avgWinRate = totalPicks > 0 ? totalWins / totalPicks : 0.5;
        }
      },
    });
  }
}
