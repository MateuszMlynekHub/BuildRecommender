import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Champion, LaneRole, LANE_ORDER } from '../../core/models/champion.model';
import { GoldEfficientItem } from '../../core/models/build-recommendation.model';
import { TPipe } from '../../shared/pipes/t.pipe';
import { LolSelectComponent, SelectOption } from '../../shared/components/lol-select.component';

const ROLE_LABELS: Record<LaneRole, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
};

@Component({
  selector: 'app-gold-advisor',
  standalone: true,
  imports: [FormsModule, TPipe, LolSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gold-page">
      <div class="gold-container">
        <div class="gold-hero">
          <h1 class="gold-hero__title">{{ 'goldAdvisor.title' | t }}</h1>
          <p class="gold-hero__sub">{{ 'goldAdvisor.goldInput' | t }}</p>
        </div>

        <!-- Controls -->
        <div class="gold-controls">
          <div class="gold-controls__field">
            <label class="gold-controls__label" for="goldInput">{{ 'goldAdvisor.goldInput' | t }}</label>
            <input
              id="goldInput"
              type="number"
              class="gold-controls__input"
              [ngModel]="gold()"
              (ngModelChange)="gold.set($event)"
              (ngModelChange)="fetchRecommendations()"
              min="1"
              placeholder="e.g. 1200"
            />
          </div>

          <div class="gold-controls__field">
            <label class="gold-controls__label">{{ 'goldAdvisor.champion' | t }}</label>
            <app-lol-select
              [options]="championOptions()"
              [value]="selectedChampionId() != null ? '' + selectedChampionId() : ''"
              (valueChange)="onChampionChange($event)"
            ></app-lol-select>
          </div>

          <div class="gold-controls__field">
            <label class="gold-controls__label">{{ 'goldAdvisor.role' | t }}</label>
            <app-lol-select
              [options]="roleOptions"
              [value]="selectedRole() ?? ''"
              (valueChange)="onRoleChange($event)"
            ></app-lol-select>
          </div>
        </div>

        <!-- Results -->
        @if (loading()) {
          <div class="gold-loading">Loading...</div>
        } @else if (items().length === 0) {
          <p class="gold-empty">{{ 'goldAdvisor.empty' | t }}</p>
        } @else {
          <h2 class="gold-results__heading">{{ 'goldAdvisor.recommended' | t }}</h2>
          <ul class="gold-results">
            @for (entry of items(); track entry.item.id) {
              <li class="gold-item" [class.gold-item--component]="entry.isRecommendedComponent">
                <img
                  class="gold-item__icon"
                  [src]="entry.item.imageUrl"
                  [alt]="entry.item.name"
                  width="40"
                  height="40"
                  loading="lazy"
                />
                <div class="gold-item__info">
                  <span class="gold-item__name">{{ entry.item.name }}</span>
                  @if (entry.isRecommendedComponent) {
                    <span class="gold-item__badge">{{ 'goldAdvisor.buildComponent' | t }}</span>
                  }
                </div>
                <div class="gold-item__meta">
                  <span class="gold-item__gold">{{ entry.item.gold.total }}g</span>
                  <span class="gold-item__eff">{{ 'goldAdvisor.efficiency' | t }}: {{ (entry.efficiency * 100).toFixed(0) }}%</span>
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: [`
    .gold-page {
      min-height: 100vh;
      padding: 5rem 1rem 2rem;
      background: var(--lol-abyss-1, #010a13);
      color: var(--lol-text, #c8aa6e);
    }

    .gold-container {
      max-width: 720px;
      margin: 0 auto;
    }

    .gold-hero {
      text-align: center;
      margin-bottom: 2rem;
    }

    .gold-hero__title {
      font-family: 'Cinzel', serif;
      font-size: 2rem;
      color: var(--lol-gold-1, #f0e6d2);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 0.5rem;
    }

    .gold-hero__sub {
      color: var(--lol-text-muted, #a09b8c);
      font-size: 0.95rem;
      margin: 0;
    }

    /* Controls */
    .gold-controls {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 2rem;
    }

    .gold-controls__field {
      display: flex;
      flex-direction: column;
      flex: 1 1 180px;
      min-width: 0;
    }

    .gold-controls__label {
      font-family: 'Cinzel', serif;
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--lol-gold-3, #c89b3c);
      margin-bottom: 0.35rem;
    }

    .gold-controls__input {
      background: rgba(1, 10, 19, 0.9);
      border: 1px solid var(--lol-gold-5, #463714);
      border-radius: 4px;
      color: var(--lol-gold-1, #f0e6d2);
      padding: 0.55rem 0.75rem;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s ease;
    }

    .gold-controls__input:focus {
      border-color: var(--lol-gold-3, #c89b3c);
    }

    /* Loading */
    .gold-loading {
      text-align: center;
      color: var(--lol-gold-3, #c89b3c);
      padding: 2rem 0;
      font-size: 0.9rem;
    }

    /* Empty state */
    .gold-empty {
      text-align: center;
      color: var(--lol-text-muted, #a09b8c);
      padding: 3rem 0;
      font-size: 0.95rem;
    }

    /* Results */
    .gold-results__heading {
      font-family: 'Cinzel', serif;
      font-size: 1rem;
      color: var(--lol-gold-2, #c8aa6e);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin: 0 0 0.75rem;
    }

    .gold-results {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .gold-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      background: rgba(10, 20, 40, 0.7);
      border: 1px solid var(--lol-gold-5, #463714);
      border-radius: 6px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .gold-item:hover {
      border-color: var(--lol-gold-3, #c89b3c);
      background: rgba(200, 155, 60, 0.06);
    }

    .gold-item--component {
      border-color: var(--lol-gold-3, #c89b3c);
      background: rgba(200, 155, 60, 0.08);
    }

    .gold-item__icon {
      border-radius: 4px;
      border: 1px solid var(--lol-gold-5, #463714);
      flex-shrink: 0;
    }

    .gold-item__info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .gold-item__name {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--lol-gold-1, #f0e6d2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .gold-item__badge {
      display: inline-block;
      font-size: 0.65rem;
      font-family: 'Cinzel', serif;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--lol-gold-3, #c89b3c);
      background: rgba(200, 155, 60, 0.12);
      border: 1px solid var(--lol-gold-4, #785a28);
      border-radius: 3px;
      padding: 0.1rem 0.4rem;
      width: fit-content;
    }

    .gold-item__meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.1rem;
      flex-shrink: 0;
    }

    .gold-item__gold {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--lol-gold-2, #c8aa6e);
    }

    .gold-item__eff {
      font-size: 0.7rem;
      color: var(--lol-text-muted, #a09b8c);
    }

    @media (max-width: 600px) {
      .gold-controls {
        flex-direction: column;
      }
    }
  `],
})
export class GoldAdvisorComponent implements OnInit {
  private api = inject(ApiService);
  private platformId = inject(PLATFORM_ID);

  readonly gold = signal<number | null>(null);
  readonly selectedChampionId = signal<number | null>(null);
  readonly selectedRole = signal<string | null>(null);
  readonly champions = signal<Champion[]>([]);
  readonly items = signal<GoldEfficientItem[]>([]);
  readonly loading = signal(false);
  readonly roles: readonly LaneRole[] = LANE_ORDER;

  readonly championOptions = computed<SelectOption[]>(() => [
    { value: '', label: '--' },
    ...this.champions().map(c => ({ value: String(c.id), label: c.name })),
  ]);

  readonly roleOptions: SelectOption[] = [
    { value: '', label: '--' },
    { value: 'TOP', label: 'Top' },
    { value: 'JUNGLE', label: 'Jungle' },
    { value: 'MIDDLE', label: 'Mid' },
    { value: 'BOTTOM', label: 'Bot' },
    { value: 'UTILITY', label: 'Support' },
  ];

  private fetchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.api.getChampions().subscribe((c) => this.champions.set(c.sort((a, b) => a.name.localeCompare(b.name))));
  }

  roleLabel(role: LaneRole): string {
    return ROLE_LABELS[role] ?? role;
  }

  onChampionChange(value: string): void {
    this.selectedChampionId.set(value ? Number(value) : null);
    this.fetchRecommendations();
  }

  onRoleChange(value: string): void {
    this.selectedRole.set(value || null);
    this.fetchRecommendations();
  }

  fetchRecommendations(): void {
    if (this.fetchTimer) clearTimeout(this.fetchTimer);
    this.fetchTimer = setTimeout(() => this._fetch(), 350);
  }

  private _fetch(): void {
    const g = this.gold();
    if (!g || g <= 0) {
      this.items.set([]);
      return;
    }

    this.loading.set(true);
    this.api
      .getGoldEfficientItems(
        g,
        this.selectedChampionId() ?? undefined,
        this.selectedRole() ?? undefined,
      )
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.loading.set(false);
        },
        error: () => {
          this.items.set([]);
          this.loading.set(false);
        },
      });
  }
}
