import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { Champion, LaneRole, LANE_ORDER } from '../../core/models/champion.model';
import { MatchupStat } from '../../core/models/champion-detail.model';

interface DraftSlot {
  champion: Champion | null;
  role: LaneRole;
}

interface Suggestion {
  champion: Champion;
  score: number;
  reason: string;
}

const ROLE_LABELS: Record<LaneRole, string> = {
  TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'Bot', UTILITY: 'Support',
};

@Component({
  selector: 'app-draft-advisor',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="draft-page">
      <div class="draft-container">
        <div class="draft-hero">
          <h1 class="draft-hero__title">Draft Advisor</h1>
          <p class="draft-hero__sub">Pick enemy champions to get counter-pick suggestions</p>
        </div>

        <div class="draft-board">
          <!-- Enemy Team (Red) -->
          <div class="draft-team draft-team--red">
            <h2 class="draft-team__title draft-team__title--red">Enemy Team</h2>
            <div class="draft-slots">
              @for (slot of enemySlots(); track slot.role) {
                <div class="draft-slot" [class.draft-slot--filled]="slot.champion"
                     [class.draft-slot--selecting]="selectingSlot() === slot.role">
                  <div class="draft-slot__role">{{ roleLabel(slot.role) }}</div>
                  @if (slot.champion) {
                    <img class="draft-slot__img"
                      [src]="gameState.getChampionImageUrl(slot.champion.imageFileName)"
                      [alt]="slot.champion.name" width="48" height="48" />
                    <div class="draft-slot__name">{{ slot.champion.name }}</div>
                    <button class="draft-slot__remove" (click)="clearSlot(slot.role)">x</button>
                  } @else {
                    <button class="draft-slot__pick" (click)="startSelecting(slot.role)">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="var(--lol-gold-4)">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Your Pick -->
          <div class="draft-team draft-team--blue">
            <h2 class="draft-team__title draft-team__title--blue">Your Role</h2>
            <div class="draft-your-role">
              @for (role of roles; track role) {
                <button class="draft-role-btn"
                  [class.draft-role-btn--active]="yourRole() === role"
                  (click)="yourRole.set(role)">
                  {{ roleLabel(role) }}
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Champion picker (shown when selecting) -->
        @if (selectingSlot()) {
          <div class="draft-picker">
            <div class="draft-picker__header">
              <span>Pick for {{ roleLabel(selectingSlot()!) }}</span>
              <button class="draft-picker__close" (click)="selectingSlot.set(null)">Cancel</button>
            </div>
            <input
              type="text"
              class="draft-picker__search"
              placeholder="Search champion..."
              [ngModel]="pickerSearch()"
              (ngModelChange)="pickerSearch.set($event)"
            />
            <div class="draft-picker__grid">
              @for (champ of filteredPicker(); track champ.id) {
                <button class="draft-picker__champ" (click)="pickChampion(champ)"
                  [disabled]="isChampionPicked(champ.id)">
                  <img [src]="gameState.getChampionImageUrl(champ.imageFileName)"
                    [alt]="champ.name" width="40" height="40" loading="lazy" />
                  <span>{{ champ.name }}</span>
                </button>
              }
            </div>
          </div>
        }

        <!-- Suggestions -->
        @if (pickedEnemyCount() > 0) {
          <div class="draft-suggestions">
            <h2 class="draft-section-title">Recommended Picks for {{ roleLabel(yourRole()) }}</h2>
            @if (suggestions().length > 0) {
              <div class="draft-suggest-grid">
                @for (s of suggestions(); track s.champion.id; let i = $index) {
                  <a class="draft-suggest-card" [routerLink]="['/champion', s.champion.key]">
                    <span class="draft-suggest-rank">#{{ i + 1 }}</span>
                    <img class="draft-suggest-img"
                      [src]="gameState.getChampionImageUrl(s.champion.imageFileName)"
                      [alt]="s.champion.name" width="48" height="48" />
                    <div class="draft-suggest-info">
                      <div class="draft-suggest-name">{{ s.champion.name }}</div>
                      <div class="draft-suggest-reason">{{ s.reason }}</div>
                    </div>
                    <div class="draft-suggest-score">{{ s.score.toFixed(0) }}</div>
                  </a>
                }
              </div>
            } @else {
              <div class="cd-empty">Pick at least one enemy champion to see suggestions</div>
            }

            <!-- Team Comp Analysis -->
            <h2 class="draft-section-title" style="margin-top:1.5rem">Enemy Team Analysis</h2>
            <div class="draft-analysis">
              <div class="draft-analysis__item">
                <span class="draft-analysis__label">Physical Damage</span>
                <div class="draft-analysis__bar">
                  <div class="draft-analysis__fill draft-analysis__fill--ad" [style.width.%]="analysis().adRatio * 100"></div>
                </div>
                <span class="draft-analysis__val">{{ (analysis().adRatio * 100).toFixed(0) }}%</span>
              </div>
              <div class="draft-analysis__item">
                <span class="draft-analysis__label">Magic Damage</span>
                <div class="draft-analysis__bar">
                  <div class="draft-analysis__fill draft-analysis__fill--ap" [style.width.%]="analysis().apRatio * 100"></div>
                </div>
                <span class="draft-analysis__val">{{ (analysis().apRatio * 100).toFixed(0) }}%</span>
              </div>
              <div class="draft-analysis__item">
                <span class="draft-analysis__label">Crowd Control</span>
                <div class="draft-analysis__bar">
                  <div class="draft-analysis__fill draft-analysis__fill--cc" [style.width.%]="analysis().ccScore * 100"></div>
                </div>
                <span class="draft-analysis__val">{{ (analysis().ccScore * 100).toFixed(0) }}%</span>
              </div>
              <div class="draft-analysis__item">
                <span class="draft-analysis__label">Healing</span>
                <div class="draft-analysis__bar">
                  <div class="draft-analysis__fill draft-analysis__fill--heal" [style.width.%]="analysis().healScore * 100"></div>
                </div>
                <span class="draft-analysis__val">{{ (analysis().healScore * 100).toFixed(0) }}%</span>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .draft-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .draft-container { max-width: 960px; margin: 0 auto; }

    .draft-hero { text-align: center; margin-bottom: 2rem; }
    .draft-hero__title {
      font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 4vw, 2.5rem);
      color: var(--lol-gold-1); letter-spacing: 0.05em;
    }
    .draft-hero__sub { color: var(--lol-text-muted); font-size: 0.82rem; margin-top: 0.3rem; }

    .draft-board {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;
    }
    @media (max-width: 640px) { .draft-board { grid-template-columns: 1fr; } }

    .draft-team {
      padding: 1rem; background: rgba(1,10,19,0.55);
      border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .draft-team__title {
      font-family: 'Cinzel', serif; font-size: 0.8rem; letter-spacing: 0.12em;
      text-transform: uppercase; text-align: center; margin-bottom: 0.75rem;
      padding-bottom: 0.4rem; border-bottom: 1px solid var(--lol-gold-5);
    }
    .draft-team__title--red { color: #E84057; }
    .draft-team__title--blue { color: #4A90E2; }

    .draft-slots { display: flex; flex-direction: column; gap: 0.5rem; }
    .draft-slot {
      display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem;
      background: rgba(1,10,19,0.4); border: 1px solid var(--lol-gold-5); border-radius: 2px;
      min-height: 60px; position: relative;
    }
    .draft-slot--filled { border-color: rgba(232,64,87,0.4); background: rgba(232,64,87,0.06); }
    .draft-slot--selecting { border-color: var(--lol-gold-3); box-shadow: 0 0 12px rgba(200,155,60,0.2); }
    .draft-slot__role {
      width: 50px; font-family: 'Cinzel', serif; font-size: 0.6rem; font-weight: 600;
      letter-spacing: 0.08em; text-transform: uppercase; color: var(--lol-text-muted); flex-shrink: 0;
    }
    .draft-slot__img { width: 48px; height: 48px; border-radius: 50%; border: 2px solid rgba(232,64,87,0.5); }
    .draft-slot__name { flex: 1; font-size: 0.82rem; font-weight: 600; color: var(--lol-gold-1); }
    .draft-slot__pick {
      width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
      background: rgba(200,155,60,0.08); border: 1px dashed var(--lol-gold-5); border-radius: 50%;
      cursor: pointer; transition: all 0.15s;
    }
    .draft-slot__pick:hover { border-color: var(--lol-gold-3); background: rgba(200,155,60,0.15); }
    .draft-slot__remove {
      position: absolute; top: 0.25rem; right: 0.25rem;
      width: 18px; height: 18px; font-size: 0.6rem; line-height: 1;
      color: var(--lol-text-muted); background: rgba(1,10,19,0.8);
      border: 1px solid var(--lol-gold-5); border-radius: 50%; cursor: pointer;
    }

    .draft-your-role { display: flex; gap: 0.35rem; justify-content: center; flex-wrap: wrap; }
    .draft-role-btn {
      padding: 0.4rem 0.7rem; font-family: 'Cinzel', serif; font-size: 0.65rem;
      font-weight: 600; letter-spacing: 0.08em; color: var(--lol-text-muted);
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .draft-role-btn:hover { color: var(--lol-gold-2); border-color: var(--lol-gold-4); }
    .draft-role-btn--active { color: #4A90E2; background: rgba(74,144,226,0.12); border-color: rgba(74,144,226,0.5); }

    /* Champion picker overlay */
    .draft-picker {
      margin-bottom: 1.5rem; padding: 1rem; background: rgba(1,10,19,0.9);
      border: 1px solid var(--lol-gold-3); border-radius: 2px;
    }
    .draft-picker__header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;
      font-family: 'Cinzel', serif; font-size: 0.8rem; color: var(--lol-gold-1);
    }
    .draft-picker__close {
      font-size: 0.7rem; color: var(--lol-text-muted); background: transparent;
      border: 1px solid var(--lol-gold-5); padding: 0.2rem 0.5rem; border-radius: 2px; cursor: pointer;
    }
    .draft-picker__search {
      width: 100%; padding: 0.5rem 0.75rem; margin-bottom: 0.6rem; font-size: 0.82rem;
      color: var(--lol-gold-1); background: rgba(1,10,19,0.7);
      border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .draft-picker__search::placeholder { color: var(--lol-text-dim); }
    .draft-picker__grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.3rem;
      max-height: 300px; overflow-y: auto;
    }
    .draft-picker__champ {
      display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
      padding: 0.3rem; background: rgba(1,10,19,0.4); border: 1px solid transparent;
      border-radius: 2px; cursor: pointer; transition: all 0.12s; text-decoration: none;
    }
    .draft-picker__champ:hover:not(:disabled) { border-color: var(--lol-gold-3); background: rgba(200,155,60,0.08); }
    .draft-picker__champ:disabled { opacity: 0.3; cursor: not-allowed; }
    .draft-picker__champ img { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .draft-picker__champ span { font-size: 0.55rem; color: var(--lol-gold-2); text-align: center; line-height: 1.1; }

    /* Suggestions */
    .draft-suggestions {
      padding: 1rem; background: rgba(1,10,19,0.55);
      border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .draft-section-title {
      font-family: 'Cinzel', serif; font-size: 0.8rem; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--lol-gold-2); margin-bottom: 0.75rem;
      padding-bottom: 0.4rem; border-bottom: 1px solid var(--lol-gold-5);
    }
    .draft-suggest-grid { display: flex; flex-direction: column; gap: 0.4rem; }
    .draft-suggest-card {
      display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem;
      background: rgba(1,10,19,0.4); border: 1px solid var(--lol-gold-5); border-radius: 2px;
      text-decoration: none; transition: all 0.15s; cursor: pointer;
    }
    .draft-suggest-card:hover { border-color: var(--lol-gold-4); background: rgba(200,155,60,0.06); }
    .draft-suggest-rank { font-family: 'Cinzel', serif; font-size: 0.75rem; color: var(--lol-gold-3); width: 28px; text-align: center; }
    .draft-suggest-img { width: 48px; height: 48px; border-radius: 50%; border: 2px solid rgba(74,144,226,0.5); }
    .draft-suggest-info { flex: 1; }
    .draft-suggest-name { font-size: 0.82rem; font-weight: 600; color: var(--lol-gold-1); }
    .draft-suggest-reason { font-size: 0.68rem; color: var(--lol-text-muted); margin-top: 0.15rem; }
    .draft-suggest-score {
      font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700; color: var(--lol-cyan);
      min-width: 36px; text-align: right;
    }

    /* Analysis bars */
    .draft-analysis { display: flex; flex-direction: column; gap: 0.5rem; }
    .draft-analysis__item { display: flex; align-items: center; gap: 0.5rem; }
    .draft-analysis__label { width: 120px; font-size: 0.72rem; color: var(--lol-text-muted); font-weight: 500; }
    .draft-analysis__bar { flex: 1; height: 14px; background: rgba(1,10,19,0.6); border-radius: 2px; overflow: hidden; }
    .draft-analysis__fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
    .draft-analysis__fill--ad { background: linear-gradient(90deg, #E84057, #FF6B6B); }
    .draft-analysis__fill--ap { background: linear-gradient(90deg, #9B6FE3, #C490FF); }
    .draft-analysis__fill--cc { background: linear-gradient(90deg, #F5A623, #FFD700); }
    .draft-analysis__fill--heal { background: linear-gradient(90deg, #50E3C2, #7FFFD4); }
    .draft-analysis__val { width: 36px; font-size: 0.72rem; font-weight: 600; color: var(--lol-gold-1); text-align: right; }

    .cd-empty {
      padding: 1rem; text-align: center; font-size: 0.78rem; color: var(--lol-text-dim);
      font-style: italic; background: rgba(200,155,60,0.04); border-radius: 2px;
      border: 1px dashed var(--lol-gold-5);
    }
  `],
})
export class DraftAdvisorComponent implements OnInit {
  private api = inject(ApiService);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly roles: readonly LaneRole[] = LANE_ORDER;
  readonly allChampions = signal<Champion[]>([]);
  readonly yourRole = signal<LaneRole>('MIDDLE');
  readonly selectingSlot = signal<LaneRole | null>(null);
  readonly pickerSearch = signal('');

  readonly enemySlots = signal<DraftSlot[]>(
    LANE_ORDER.map((role) => ({ champion: null, role }))
  );

  /** Matchup data fetched per enemy champion — maps enemyChampionId → their matchup stats. */
  readonly matchupCache = signal<Map<number, MatchupStat[]>>(new Map());

  readonly pickedEnemyCount = computed(() =>
    this.enemySlots().filter((s) => s.champion !== null).length
  );

  readonly filteredPicker = computed(() => {
    const q = this.pickerSearch().toLowerCase().trim();
    let list = this.allChampions();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    return list.slice(0, 60);
  });

  /** Simple team analysis from champion data. */
  readonly analysis = computed(() => {
    const enemies = this.enemySlots().map(s => s.champion).filter(Boolean) as Champion[];
    if (enemies.length === 0) return { adRatio: 0.5, apRatio: 0.5, ccScore: 0, healScore: 0 };

    let ad = 0, ap = 0, cc = 0, heal = 0;
    for (const c of enemies) {
      const tags = c.tags.map(t => t.toLowerCase());
      if (tags.includes('marksman') || tags.includes('fighter') || tags.includes('assassin')) ad++;
      else ap++;
    }
    const total = ad + ap || 1;
    return {
      adRatio: ad / total,
      apRatio: ap / total,
      ccScore: Math.min(enemies.length * 0.2, 1),
      healScore: Math.min(enemies.filter(c => c.tags.map(t => t.toLowerCase()).includes('support')).length * 0.3, 1),
    };
  });

  /** Counter-pick suggestions based on matchup win rates + tag heuristics. */
  readonly suggestions = computed(() => {
    const enemies = this.enemySlots().map(s => s.champion).filter(Boolean) as Champion[];
    if (enemies.length === 0) return [];

    const role = this.yourRole();
    const posKey = role === 'UTILITY' ? 'SUPPORT' : role;
    const enemyIds = new Set(enemies.map(c => c.id));
    const cache = this.matchupCache();

    const candidates = this.allChampions()
      .filter(c => c.positions.includes(posKey) && !enemyIds.has(c.id));

    const enemyTags = enemies.flatMap(c => c.tags.map(t => t.toLowerCase()));
    const hasLotsOfAD = enemyTags.filter(t => t === 'marksman' || t === 'fighter').length >= 2;
    const hasLotsOfAP = enemyTags.filter(t => t === 'mage').length >= 2;
    const hasAssassins = enemyTags.includes('assassin');
    const hasTanks = enemyTags.includes('tank');

    const scored: Suggestion[] = candidates.map(c => {
      let score = 50;
      const reasons: string[] = [];
      const myTags = c.tags.map(t => t.toLowerCase());

      // Use real matchup win rates from crawler data
      for (const enemy of enemies) {
        const enemyMatchups = cache.get(enemy.id);
        if (enemyMatchups) {
          // Find how well this candidate does AGAINST this enemy
          // Enemy matchups show enemy's WR vs opponents — low WR = good for candidate
          const matchup = enemyMatchups.find(m => m.opponentChampionId === c.id);
          if (matchup && matchup.picks >= 3) {
            // Enemy has low WR against this candidate = candidate counters enemy
            const wrBonus = (0.5 - matchup.winRate) * 100;
            score += wrBonus;
            if (matchup.winRate < 0.45) {
              reasons.push(`Counters ${enemy.name} (${(matchup.winRate * 100).toFixed(0)}% enemy WR)`);
            }
          }
        }
      }

      // Fallback tag-based heuristics when no matchup data
      if (reasons.length === 0) {
        if (hasLotsOfAD && myTags.includes('tank')) { score += 15; reasons.push('Tank vs AD team'); }
        if (hasLotsOfAP && myTags.includes('tank')) { score += 12; reasons.push('Tanky vs AP team'); }
        if (hasAssassins && myTags.includes('tank')) { score += 8; reasons.push('Peel vs assassins'); }
        if (hasTanks && myTags.includes('marksman')) { score += 8; reasons.push('DPS vs tanks'); }
        if (!hasTanks && myTags.includes('assassin')) { score += 10; reasons.push('Assassin vs squishies'); }
      }

      if (c.positions.length >= 2) { score += 2; reasons.push('Flex pick'); }

      return { champion: c, score, reason: reasons.join(', ') || 'Solid pick' };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 10);
  });

  ngOnInit(): void {
    this.seo.updatePageMeta({
      title: 'Draft Advisor — LoL Counter Pick Tool | DraftSense',
      description: 'Simulate League of Legends champion select. Pick enemy champions and get counter-pick suggestions based on team composition analysis.',
      url: 'https://draftsense.net/draft',
    });

    if (!this.isBrowser) return;
    this.api.getChampions().subscribe({
      next: (champs) => this.allChampions.set(champs.sort((a, b) => a.name.localeCompare(b.name))),
    });
  }

  roleLabel(role: LaneRole): string {
    return ROLE_LABELS[role];
  }

  startSelecting(role: LaneRole): void {
    this.selectingSlot.set(role);
    this.pickerSearch.set('');
  }

  pickChampion(champ: Champion): void {
    const role = this.selectingSlot();
    if (!role) return;
    this.enemySlots.update(slots =>
      slots.map(s => s.role === role ? { ...s, champion: champ } : s)
    );
    this.selectingSlot.set(null);

    // Fetch matchup data for this enemy champion (their WR vs all opponents in their role)
    const laneForApi = role === 'UTILITY' ? 'UTILITY' : role;
    this.api.getChampionMatchups(champ.id, laneForApi, 30).subscribe({
      next: (matchups) => {
        this.matchupCache.update(cache => {
          const next = new Map(cache);
          next.set(champ.id, matchups);
          return next;
        });
      },
    });
  }

  clearSlot(role: LaneRole): void {
    this.enemySlots.update(slots =>
      slots.map(s => s.role === role ? { ...s, champion: null } : s)
    );
  }

  isChampionPicked(id: number): boolean {
    return this.enemySlots().some(s => s.champion?.id === id);
  }
}
