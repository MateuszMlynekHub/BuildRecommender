import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { TranslationService } from '../../core/services/translation.service';
import { TPipe } from '../../shared/pipes/t.pipe';
import { Champion } from '../../core/models/champion.model';
import { BuildRecommendation } from '../../core/models/build-recommendation.model';

@Component({
  selector: 'app-build-simulator',
  standalone: true,
  imports: [FormsModule, TPipe],
  template: `
    <div class="sim-container">
      <h1 class="sim-title">{{ 'simulator.title' | t }}</h1>
      <p class="sim-subtitle">{{ 'simulator.subtitle' | t }}</p>

      <div class="sim-layout">
        <!-- My Champion Selection -->
        <div class="sim-section">
          <h2 class="sim-section-title">{{ 'simulator.yourChampion' | t }}</h2>
          <div class="sim-search-box">
            <input class="sim-search" type="text"
              [(ngModel)]="myChampionSearch"
              [placeholder]="'simulator.searchChampion' | t" />
          </div>
          @if (myChampionSearch() && !selectedChampion()) {
            <div class="sim-champ-list">
              @for (champ of filteredChampions(); track champ.id) {
                <div class="sim-champ-option" (click)="selectMyChampion(champ)">
                  <img [src]="getChampImage(champ)" width="28" height="28" class="sim-champ-icon" />
                  <span>{{ champ.name }}</span>
                </div>
              }
            </div>
          }
          @if (selectedChampion()) {
            <div class="sim-selected-champ" (click)="clearMyChampion()">
              <img [src]="getChampImage(selectedChampion()!)" width="40" height="40" class="sim-champ-icon-lg" />
              <span class="sim-champ-name">{{ selectedChampion()!.name }}</span>
              <span class="sim-remove-x">&times;</span>
            </div>
          }
        </div>

        <!-- Enemy Team -->
        <div class="sim-section">
          <h2 class="sim-section-title">{{ 'simulator.enemyTeam' | t }}</h2>
          <div class="sim-enemy-list">
            @for (enemy of selectedEnemies(); track enemy.id; let i = $index) {
              <div class="sim-enemy-chip" (click)="removeEnemy(i)">
                <img [src]="getChampImage(enemy)" width="28" height="28" class="sim-champ-icon" />
                <span>{{ enemy.name }}</span>
                <span class="sim-remove-x">&times;</span>
              </div>
            }
          </div>
          @if (selectedEnemies().length < 5) {
            <div class="sim-search-box">
              <input class="sim-search" type="text"
                [(ngModel)]="enemySearch"
                [placeholder]="'simulator.addEnemy' | t" />
            </div>
            @if (enemySearch()) {
              <div class="sim-champ-list">
                @for (champ of filteredEnemyChampions(); track champ.id) {
                  <div class="sim-champ-option" (click)="addEnemy(champ)">
                    <img [src]="getChampImage(champ)" width="28" height="28" class="sim-champ-icon" />
                    <span>{{ champ.name }}</span>
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>

      @if (selectedChampion() && selectedEnemies().length > 0) {
        <button class="sim-recommend-btn" (click)="recommend()" [disabled]="loading()">
          @if (loading()) { <span class="sim-spinner"></span> }
          {{ 'simulator.recommend' | t }}
        </button>
      }

      @if (recommendation()) {
        <div class="sim-result">
          <h3 class="sim-result-title">{{ recommendation()!.championName }}</h3>
          @for (variant of recommendation()!.variants; track variant.style) {
            <div class="sim-variant">
              <div class="sim-variant-label">{{ variant.labelKey | t }}</div>
              <div class="sim-variant-items">
                @for (item of variant.items; track item.item.id) {
                  <div class="sim-item" [title]="item.item.name">
                    <img [src]="item.item.imageUrl || gameState.getItemImageUrl(item.item.imageFileName)"
                      width="32" height="32" class="sim-item-img" loading="lazy" />
                    <span class="sim-item-name">{{ item.item.name }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Threat Profile -->
          <div class="sim-threat">
            <div class="sim-threat-title">Threat Profile</div>
            <div class="sim-threat-bar">
              <span>AD</span>
              <div class="sim-bar"><div class="sim-bar-fill" [style.width.%]="recommendation()!.enemyThreatProfile.adRatio * 100"></div></div>
              <span>{{ (recommendation()!.enemyThreatProfile.adRatio * 100).toFixed(0) }}%</span>
            </div>
            <div class="sim-threat-bar">
              <span>AP</span>
              <div class="sim-bar"><div class="sim-bar-fill sim-bar-fill--ap" [style.width.%]="recommendation()!.enemyThreatProfile.apRatio * 100"></div></div>
              <span>{{ (recommendation()!.enemyThreatProfile.apRatio * 100).toFixed(0) }}%</span>
            </div>
            <div class="sim-threat-bar">
              <span>Heal</span>
              <div class="sim-bar"><div class="sim-bar-fill sim-bar-fill--heal" [style.width.%]="recommendation()!.enemyThreatProfile.healingThreat * 100"></div></div>
              <span>{{ (recommendation()!.enemyThreatProfile.healingThreat * 100).toFixed(0) }}%</span>
            </div>
            <div class="sim-threat-bar">
              <span>CC</span>
              <div class="sim-bar"><div class="sim-bar-fill sim-bar-fill--cc" [style.width.%]="recommendation()!.enemyThreatProfile.ccThreat * 100"></div></div>
              <span>{{ (recommendation()!.enemyThreatProfile.ccThreat * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sim-container { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    .sim-title { font-size: 1.5rem; font-weight: 700; color: var(--lol-gold-1); margin-bottom: 0.25rem; }
    .sim-subtitle { font-size: 0.85rem; color: var(--lol-text-muted); margin-bottom: 1.5rem; }

    .sim-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1rem; }
    @media (max-width: 640px) { .sim-layout { grid-template-columns: 1fr; } }

    .sim-section {
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 1rem;
    }
    .sim-section-title { font-size: 0.9rem; color: var(--lol-gold-3); margin-bottom: 0.5rem; font-weight: 700; }

    .sim-search-box { margin-bottom: 0.5rem; }
    .sim-search {
      width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; color: var(--lol-text-primary, #ccc); padding: 0.4rem 0.6rem; font-size: 0.85rem;
    }
    .sim-search::placeholder { color: var(--lol-text-muted); }

    .sim-champ-list {
      max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
    }
    .sim-champ-option {
      display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.4rem;
      cursor: pointer; border-radius: 2px; font-size: 0.85rem;
    }
    .sim-champ-option:hover { background: rgba(200,170,110,0.1); }
    .sim-champ-icon { border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .sim-champ-icon-lg { border-radius: 50%; border: 2px solid var(--lol-gold-3); }

    .sim-selected-champ {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;
      background: rgba(200,170,110,0.1); border: 1px solid var(--lol-gold-3);
      border-radius: 4px; cursor: pointer;
    }
    .sim-champ-name { font-weight: 700; color: var(--lol-gold-1); flex: 1; }
    .sim-remove-x { color: var(--lol-text-muted); font-size: 1.2rem; cursor: pointer; }

    .sim-enemy-list { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
    .sim-enemy-chip {
      display: flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.5rem;
      background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; cursor: pointer; font-size: 0.8rem;
    }
    .sim-enemy-chip:hover { border-color: var(--lol-red, #f44); }

    .sim-recommend-btn {
      background: linear-gradient(135deg, var(--lol-gold-3), var(--lol-gold-5));
      color: #0a0a0a; border: none; border-radius: 3px; padding: 0.6rem 2rem;
      font-weight: 700; cursor: pointer; font-size: 0.9rem; margin: 1rem 0;
      display: flex; align-items: center; gap: 0.4rem;
    }
    .sim-recommend-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sim-spinner {
      display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.2);
      border-top-color: #0a0a0a; border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .sim-result {
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 1rem; margin-top: 1rem;
    }
    .sim-result-title { font-size: 1.1rem; font-weight: 700; color: var(--lol-gold-1); margin-bottom: 0.75rem; }

    .sim-variant { margin-bottom: 0.75rem; }
    .sim-variant-label {
      font-size: 0.75rem; text-transform: uppercase; color: var(--lol-gold-3);
      font-weight: 700; margin-bottom: 0.3rem;
    }
    .sim-variant-items { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .sim-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; }
    .sim-item-img { border-radius: 3px; border: 1px solid var(--lol-gold-5); }
    .sim-item-name { color: var(--lol-text-primary, #ccc); }

    .sim-threat { margin-top: 1rem; }
    .sim-threat-title {
      font-size: 0.8rem; text-transform: uppercase; color: var(--lol-gold-3);
      font-weight: 700; margin-bottom: 0.5rem;
    }
    .sim-threat-bar {
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 0.8rem;
    }
    .sim-threat-bar span:first-child { width: 40px; color: var(--lol-text-muted); }
    .sim-threat-bar span:last-child { width: 35px; text-align: right; color: var(--lol-gold-1); }
    .sim-bar {
      flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;
    }
    .sim-bar-fill { height: 100%; background: var(--lol-gold-3); border-radius: 4px; transition: width 0.3s; }
    .sim-bar-fill--ap { background: #9b6fe3; }
    .sim-bar-fill--heal { background: #4caf50; }
    .sim-bar-fill--cc { background: #f44336; }
  `],
})
export class BuildSimulatorComponent {
  private readonly api = inject(ApiService);
  readonly gameState = inject(GameStateService);

  readonly allChampions = signal<Champion[]>([]);
  readonly myChampionSearch = signal('');
  readonly enemySearch = signal('');
  readonly selectedChampion = signal<Champion | null>(null);
  readonly selectedEnemies = signal<Champion[]>([]);
  readonly recommendation = signal<BuildRecommendation | null>(null);
  readonly loading = signal(false);

  readonly filteredChampions = computed(() => {
    const q = this.myChampionSearch().toLowerCase();
    if (!q) return [];
    return this.allChampions()
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 10);
  });

  readonly filteredEnemyChampions = computed(() => {
    const q = this.enemySearch().toLowerCase();
    if (!q) return [];
    const usedIds = new Set(this.selectedEnemies().map(e => e.id));
    return this.allChampions()
      .filter(c => c.name.toLowerCase().includes(q) && !usedIds.has(c.id))
      .slice(0, 10);
  });

  ngOnInit() {
    this.api.getChampions().subscribe({
      next: (champs) => this.allChampions.set(champs),
    });
  }

  getChampImage(champ: Champion): string {
    return this.gameState.getChampionImageUrl(champ.imageFileName);
  }

  selectMyChampion(champ: Champion) {
    this.selectedChampion.set(champ);
    this.myChampionSearch.set('');
  }

  clearMyChampion() {
    this.selectedChampion.set(null);
    this.recommendation.set(null);
  }

  addEnemy(champ: Champion) {
    const current = this.selectedEnemies();
    if (current.length < 5) {
      this.selectedEnemies.set([...current, champ]);
      this.enemySearch.set('');
      // Auto-recommend when we have champion + enemies
      if (this.selectedChampion()) this.recommend();
    }
  }

  removeEnemy(index: number) {
    const current = [...this.selectedEnemies()];
    current.splice(index, 1);
    this.selectedEnemies.set(current);
    // Re-recommend if we still have enemies
    if (this.selectedChampion() && current.length > 0) this.recommend();
    else this.recommendation.set(null);
  }

  recommend() {
    const champ = this.selectedChampion();
    const enemies = this.selectedEnemies();
    if (!champ || enemies.length === 0) return;

    this.loading.set(true);
    this.api.getRecommendedBuild(
      champ.id,
      enemies.map(e => e.id),
      [],
    ).subscribe({
      next: (rec) => {
        this.recommendation.set(rec);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
