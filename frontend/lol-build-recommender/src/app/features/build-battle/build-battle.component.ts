import { Component, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { Champion } from '../../core/models/champion.model';
import { BuildRecommendation } from '../../core/models/build-recommendation.model';
import { environment } from '../../../environments/environment';

interface CompletedItem {
  id: number;
  name: string;
  imageFileName: string;
  imageUrl: string;
  tags: string[];
  gold: { total: number; base: number; purchasable: boolean };
}

interface HighScore {
  champion: string;
  enemies: string;
  score: number;
  grade: string;
  date: string;
}

@Component({
  selector: 'app-build-battle',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bb-container">
      <h1 class="bb-title">Build Battle</h1>
      <p class="bb-subtitle">Pick 6 items for the scenario and see how your build stacks up against our AI recommendation</p>

      @if (!scenario()) {
        <button class="bb-start-btn" (click)="generateScenario()" [disabled]="allChampions().length === 0">
          {{ allChampions().length === 0 ? 'Loading champions...' : 'Generate Scenario' }}
        </button>
      }

      @if (scenario()) {
        <div class="bb-scenario">
          <div class="bb-scenario-header">
            <div class="bb-your-champ">
              <div class="bb-label">YOU ARE PLAYING</div>
              <div class="bb-champ-display">
                <img [src]="getChampImage(scenario()!.champion)" width="56" height="56" class="bb-champ-img" loading="lazy" />
                <span class="bb-champ-name">{{ scenario()!.champion.name }}</span>
              </div>
            </div>
            <div class="bb-vs">VS</div>
            <div class="bb-enemy-team">
              <div class="bb-label">ENEMY TEAM</div>
              <div class="bb-enemy-row">
                @for (enemy of scenario()!.enemies; track enemy.id) {
                  <div class="bb-enemy-mini">
                    <img [src]="getChampImage(enemy)" width="40" height="40" class="bb-enemy-img" loading="lazy" />
                    <span class="bb-enemy-name">{{ enemy.name }}</span>
                  </div>
                }
              </div>
            </div>
            <button class="bb-reroll-btn" (click)="generateScenario()" title="Roll new scenario">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
              New Round
            </button>
          </div>

          <!-- Selected Items -->
          <div class="bb-build-section">
            <div class="bb-label">YOUR BUILD ({{ selectedItems().length }}/6)</div>
            <div class="bb-build-slots">
              @for (slot of [0,1,2,3,4,5]; track slot) {
                @if (selectedItems()[slot]) {
                  <div class="bb-slot bb-slot--filled" (click)="removeItem(slot)">
                    <img [src]="getItemImage(selectedItems()[slot])" width="40" height="40" class="bb-slot-img" />
                    <span class="bb-slot-name">{{ selectedItems()[slot].name }}</span>
                    <span class="bb-slot-x">&times;</span>
                  </div>
                } @else {
                  <div class="bb-slot bb-slot--empty">
                    <span class="bb-slot-placeholder">?</span>
                  </div>
                }
              }
            </div>
          </div>

          <!-- Item Search -->
          @if (selectedItems().length < 6) {
            <div class="bb-item-search">
              <input class="bb-search-input" type="text"
                [(ngModel)]="itemSearch"
                placeholder="Search items..." />
            </div>
            <div class="bb-item-grid">
              @for (item of filteredItems(); track item.id) {
                <div class="bb-item-option" (click)="addItem(item)"
                  [class.bb-item--selected]="isItemSelected(item.id)">
                  <img [src]="getItemImage(item)" width="32" height="32" class="bb-item-img" loading="lazy" />
                  <div class="bb-item-info">
                    <span class="bb-item-name">{{ item.name }}</span>
                    <span class="bb-item-gold">{{ item.gold.total }}g</span>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Score Button -->
          @if (selectedItems().length === 6 && !result()) {
            <button class="bb-score-btn" (click)="scoreBuild()" [disabled]="scoring()">
              @if (scoring()) { <span class="bb-spinner"></span> }
              Score My Build
            </button>
          }

          <!-- Result -->
          @if (result()) {
            <div class="bb-result" [class]="'bb-result bb-result-' + result()!.grade.toLowerCase()">
              <div class="bb-result-header">
                <div class="bb-result-grade-circle">
                  <span class="bb-result-grade">{{ result()!.grade }}</span>
                  <span class="bb-result-score-num">{{ result()!.score }}/100</span>
                </div>
                <div class="bb-result-info">
                  <div class="bb-result-title">BUILD SCORE</div>
                  <div class="bb-result-comment">"{{ result()!.comment }}"</div>
                </div>
              </div>

              @if (result()!.optimalItems.length > 0) {
                <div class="bb-optimal-section">
                  <div class="bb-label">AI RECOMMENDED BUILD</div>
                  <div class="bb-optimal-row">
                    @for (item of result()!.optimalItems; track item.id) {
                      <div class="bb-optimal-item" [class.bb-match]="isItemSelected(item.id)">
                        <img [src]="getItemImageById(item)" width="36" height="36" class="bb-optimal-img" loading="lazy" />
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="bb-result-actions">
                <button class="bb-retry-btn" (click)="generateScenario()">New Scenario</button>
                <button class="bb-retry-btn" (click)="retryScenario()">Retry Same Scenario</button>
              </div>
            </div>
          }
        </div>
      }

      <!-- High Scores -->
      @if (highScores().length > 0) {
        <div class="bb-highscores">
          <div class="bb-label">YOUR HIGH SCORES</div>
          <div class="bb-hs-list">
            @for (hs of highScores(); track hs.date) {
              <div class="bb-hs-row">
                <span class="bb-hs-champ">{{ hs.champion }}</span>
                <span class="bb-hs-enemies">vs {{ hs.enemies }}</span>
                <span class="bb-hs-grade" [class]="'bb-hs-grade bb-hs-' + hs.grade.toLowerCase()">{{ hs.grade }}</span>
                <span class="bb-hs-score">{{ hs.score }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .bb-container { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    .bb-title { font-size: 1.5rem; font-weight: 700; color: var(--lol-gold-1); margin-bottom: 0.25rem; }
    .bb-subtitle { font-size: 0.85rem; color: var(--lol-text-muted); margin-bottom: 1.5rem; }

    .bb-start-btn {
      background: linear-gradient(135deg, #ff9800, #f57c00);
      color: #fff; border: none; border-radius: 4px; padding: 0.75rem 2rem;
      font-weight: 700; cursor: pointer; font-size: 1rem;
    }
    .bb-start-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .bb-scenario {
      background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 1rem;
    }
    .bb-scenario-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .bb-reroll-btn {
      display: flex; align-items: center; gap: 0.4rem; margin-left: auto;
      background: rgba(200,155,60,0.15); border: 1px solid var(--lol-gold-4);
      color: var(--lol-gold-2); padding: 0.5rem 1rem; border-radius: 3px;
      font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
    }
    .bb-reroll-btn:hover { border-color: var(--lol-gold-3); color: var(--lol-gold-1); background: rgba(200,155,60,0.25); }
    .bb-your-champ { text-align: center; }
    .bb-champ-display { display: flex; align-items: center; gap: 0.5rem; }
    .bb-champ-img { border-radius: 50%; border: 3px solid var(--lol-gold-3); }
    .bb-champ-name { font-size: 1.1rem; font-weight: 700; color: var(--lol-gold-1); }
    .bb-vs { font-size: 1.5rem; font-weight: 900; color: var(--lol-text-muted); }
    .bb-enemy-team { flex: 1; }
    .bb-enemy-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .bb-enemy-mini { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
    .bb-enemy-img { border-radius: 50%; border: 2px solid var(--lol-gold-5); }
    .bb-enemy-name { font-size: 0.65rem; color: var(--lol-text-muted); text-align: center; max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .bb-label {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--lol-gold-3); font-weight: 700; margin-bottom: 0.4rem;
    }

    .bb-build-section { margin-bottom: 1rem; }
    .bb-build-slots { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .bb-slot {
      width: 60px; height: 60px; border-radius: 4px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; position: relative;
    }
    .bb-slot--empty {
      border: 2px dashed var(--lol-gold-5); background: rgba(0,0,0,0.2);
    }
    .bb-slot--filled {
      border: 2px solid var(--lol-gold-3); background: rgba(200,170,110,0.1); cursor: pointer;
    }
    .bb-slot--filled:hover { border-color: #f44336; }
    .bb-slot-placeholder { font-size: 1.5rem; color: var(--lol-text-muted); }
    .bb-slot-img { border-radius: 3px; }
    .bb-slot-name { font-size: 0.5rem; color: var(--lol-text-muted); position: absolute; bottom: -14px; white-space: nowrap; max-width: 70px; overflow: hidden; text-overflow: ellipsis; }
    .bb-slot-x {
      position: absolute; top: -4px; right: -4px; background: #f44336; color: #fff;
      width: 16px; height: 16px; border-radius: 50%; font-size: 0.7rem;
      display: none; align-items: center; justify-content: center; line-height: 1;
    }
    .bb-slot--filled:hover .bb-slot-x { display: flex; }

    .bb-item-search { margin: 1.25rem 0 0.5rem; }
    .bb-search-input {
      width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; color: var(--lol-text-primary, #ccc); padding: 0.4rem 0.6rem;
      font-size: 0.85rem;
    }
    .bb-search-input::placeholder { color: var(--lol-text-muted); }

    .bb-item-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.3rem; max-height: 300px; overflow-y: auto; padding: 0.25rem 0;
    }
    .bb-item-option {
      display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.4rem;
      cursor: pointer; border-radius: 3px; border: 1px solid transparent;
    }
    .bb-item-option:hover { background: rgba(200,170,110,0.1); border-color: var(--lol-gold-5); }
    .bb-item--selected { opacity: 0.3; pointer-events: none; }
    .bb-item-img { border-radius: 3px; border: 1px solid var(--lol-gold-5); }
    .bb-item-info { display: flex; flex-direction: column; min-width: 0; }
    .bb-item-name { font-size: 0.8rem; color: var(--lol-text-primary, #ccc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bb-item-gold { font-size: 0.7rem; color: var(--lol-gold-3); }

    .bb-score-btn {
      background: linear-gradient(135deg, #ff9800, #f57c00);
      color: #fff; border: none; border-radius: 3px; padding: 0.6rem 2rem;
      font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 1rem;
      display: flex; align-items: center; gap: 0.4rem; width: 100%; justify-content: center;
    }
    .bb-score-btn:disabled { opacity: 0.5; }
    .bb-spinner {
      display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%; animation: bbspin 0.6s linear infinite;
    }
    @keyframes bbspin { to { transform: rotate(360deg); } }

    .bb-result {
      margin-top: 1rem; padding: 1.25rem; border: 2px solid var(--lol-gold-3);
      border-radius: 8px; background: rgba(1,10,19,0.7);
    }
    .bb-result-s, .bb-result-a { border-color: #4caf50; }
    .bb-result-b { border-color: var(--lol-gold-3); }
    .bb-result-c { border-color: #ff9800; }
    .bb-result-d, .bb-result-f { border-color: #f44336; }

    .bb-result-header { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
    .bb-result-grade-circle {
      width: 70px; height: 70px; border-radius: 50%; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(200,170,110,0.1); border: 2px solid var(--lol-gold-3);
      flex-shrink: 0;
    }
    .bb-result-grade { font-size: 1.8rem; font-weight: 900; color: var(--lol-gold-1); line-height: 1; }
    .bb-result-score-num { font-size: 0.65rem; color: var(--lol-text-muted); }
    .bb-result-info { flex: 1; }
    .bb-result-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lol-gold-3); }
    .bb-result-comment { font-style: italic; color: var(--lol-text-muted); font-size: 0.85rem; margin-top: 0.25rem; }

    .bb-optimal-section { margin-bottom: 1rem; }
    .bb-optimal-row { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .bb-optimal-item { border: 2px solid transparent; border-radius: 3px; }
    .bb-optimal-img { border-radius: 3px; }
    .bb-match { border-color: #4caf50; }

    .bb-result-actions { display: flex; gap: 0.5rem; }
    .bb-retry-btn {
      flex: 1; background: linear-gradient(135deg, var(--lol-gold-3), var(--lol-gold-5));
      color: #0a0a0a; border: none; border-radius: 3px; padding: 0.5rem 1rem;
      font-weight: 700; cursor: pointer; font-size: 0.8rem;
    }

    .bb-highscores {
      margin-top: 2rem; background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 1rem;
    }
    .bb-hs-list { display: flex; flex-direction: column; gap: 0.3rem; }
    .bb-hs-row {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0;
      font-size: 0.8rem; border-bottom: 1px solid rgba(200,170,110,0.08);
    }
    .bb-hs-champ { color: var(--lol-gold-1); font-weight: 600; min-width: 80px; }
    .bb-hs-enemies { color: var(--lol-text-muted); flex: 1; font-size: 0.75rem; }
    .bb-hs-grade { font-weight: 700; min-width: 24px; text-align: center; }
    .bb-hs-s, .bb-hs-a { color: #4caf50; }
    .bb-hs-b { color: var(--lol-gold-3); }
    .bb-hs-c { color: #ff9800; }
    .bb-hs-d, .bb-hs-f { color: #f44336; }
    .bb-hs-score { color: var(--lol-gold-1); font-weight: 700; min-width: 30px; text-align: right; }
  `],
})
export class BuildBattleComponent {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly baseUrl = environment.apiUrl;

  readonly allChampions = signal<Champion[]>([]);
  readonly allItems = signal<CompletedItem[]>([]);
  readonly scenario = signal<{ champion: Champion; enemies: Champion[] } | null>(null);
  readonly selectedItems = signal<CompletedItem[]>([]);
  readonly result = signal<{ score: number; grade: string; comment: string; optimalItems: { id: number; imageFileName: string; imageUrl?: string }[] } | null>(null);
  readonly scoring = signal(false);
  readonly highScores = signal<HighScore[]>([]);

  itemSearch = '';

  readonly filteredItems = computed(() => {
    const q = this.itemSearch.toLowerCase();
    const selectedIds = new Set(this.selectedItems().map(i => i.id));
    return this.allItems()
      .filter(i => {
        if (selectedIds.has(i.id)) return false;
        if (!q) return true;
        return i.name.toLowerCase().includes(q);
      })
      .slice(0, 60);
  });

  ngOnInit() {
    this.api.getChampions().subscribe({
      next: (champs) => this.allChampions.set(champs),
    });

    // Load current DDragon version so item image URLs resolve correctly
    this.api.getVersion().subscribe({
      next: (v) => this.gameState.ddragonVersion.set(v),
    });

    // Load completed items from the API
    this.http.get<Record<string, CompletedItem>>(`${this.baseUrl}/data/items`).subscribe({
      next: (dict) => {
        const items = Object.values(dict).filter(i => i.gold.total >= 2000 && i.gold.purchasable);
        items.sort((a, b) => a.name.localeCompare(b.name));
        this.allItems.set(items);
      },
    });

    // Load high scores from localStorage
    if (this.isBrowser) {
      try {
        const saved = localStorage.getItem('bb-highscores');
        if (saved) this.highScores.set(JSON.parse(saved));
      } catch { }
    }
  }

  generateScenario() {
    const champs = this.allChampions();
    if (champs.length < 6) return;

    // Pick random champion for the player
    const shuffled = [...champs].sort(() => Math.random() - 0.5);
    const champion = shuffled[0];
    const enemies = shuffled.slice(1, 6);

    this.scenario.set({ champion, enemies });
    this.selectedItems.set([]);
    this.result.set(null);
    this.itemSearch = '';
  }

  retryScenario() {
    this.selectedItems.set([]);
    this.result.set(null);
    this.itemSearch = '';
  }

  addItem(item: CompletedItem) {
    const current = this.selectedItems();
    if (current.length >= 6) return;
    if (current.some(i => i.id === item.id)) return;
    this.selectedItems.set([...current, item]);
  }

  removeItem(index: number) {
    const current = [...this.selectedItems()];
    current.splice(index, 1);
    this.selectedItems.set(current);
    this.result.set(null);
  }

  isItemSelected(id: number): boolean {
    return this.selectedItems().some(i => i.id === id);
  }

  getChampImage(champ: Champion): string {
    return this.gameState.getChampionImageUrl(champ.imageFileName);
  }

  getItemImage(item: CompletedItem): string {
    return item.imageUrl || this.gameState.getItemImageUrl(item.imageFileName);
  }

  getItemImageById(item: { id: number; imageFileName: string; imageUrl?: string }): string {
    return item.imageUrl || this.gameState.getItemImageUrl(item.imageFileName);
  }

  scoreBuild() {
    const s = this.scenario();
    if (!s || this.selectedItems().length !== 6) return;

    this.scoring.set(true);

    // Call the recommend API to get optimal build, then compare
    this.api.getRecommendedBuild(
      s.champion.id,
      s.enemies.map(e => e.id),
      [],
    ).subscribe({
      next: (rec) => {
        const optimalItems = rec.variants[0]?.items ?? [];
        const optimalIds = new Set(optimalItems.map(i => i.item.id));
        const selectedIds = new Set(this.selectedItems().map(i => i.id));

        let matches = 0;
        for (const id of selectedIds) {
          if (optimalIds.has(id)) matches++;
        }

        const rawScore = Math.round((matches / Math.max(optimalItems.length, 1)) * 100);
        const score = Math.min(100, Math.max(0, rawScore));
        const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';

        const comment = score >= 90
          ? 'Perfect read! You might be an AI yourself.'
          : score >= 75
          ? 'Solid build knowledge. Not bad at all.'
          : score >= 60
          ? 'You are getting there. A few items off.'
          : score >= 45
          ? 'Some questionable choices. Study the matchup.'
          : score >= 30
          ? 'Did you even look at the enemy team?'
          : 'The enemy team sends their thanks for the free LP.';

        const optimalItemsForDisplay = optimalItems.map(i => ({
          id: i.item.id,
          imageFileName: i.item.imageFileName,
          imageUrl: i.item.imageUrl,
        }));

        this.result.set({ score, grade, comment, optimalItems: optimalItemsForDisplay });
        this.scoring.set(false);

        // Save high score
        if (this.isBrowser) {
          const hs: HighScore = {
            champion: s.champion.name,
            enemies: s.enemies.map(e => e.name).join(', '),
            score,
            grade,
            date: new Date().toISOString(),
          };
          const current = [...this.highScores(), hs]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
          this.highScores.set(current);
          try { localStorage.setItem('bb-highscores', JSON.stringify(current)); } catch { }
        }
      },
      error: () => {
        this.scoring.set(false);
      },
    });
  }
}
