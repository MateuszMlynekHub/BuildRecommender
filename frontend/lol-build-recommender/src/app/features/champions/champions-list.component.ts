import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { Champion, LaneRole, LANE_ORDER } from '../../core/models/champion.model';
import { TPipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-champions-list',
  standalone: true,
  imports: [RouterLink, FormsModule, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="champs-page">
      <div class="champs-container">
        <!-- Hero -->
        <div class="champs-hero">
          <h1 class="champs-hero__title">{{ 'champions.title' | t }}</h1>
          <p class="champs-hero__subtitle">{{ 'champions.subtitle' | t }}</p>
        </div>

        <!-- Filters -->
        <div class="champs-filters">
          <div class="champs-search">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"
                 fill="var(--lol-gold-4)" class="champs-search__icon">
              <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              type="text"
              class="champs-search__input"
              [placeholder]="'champions.search' | t"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
            />
          </div>

          <div class="champs-roles">
            <button
              type="button"
              class="role-btn"
              [class.role-btn--active]="!activeRole()"
              (click)="activeRole.set(null)"
            >
              {{ 'champions.allRoles' | t }}
            </button>
            @for (role of roles; track role) {
              <button
                type="button"
                class="role-btn"
                [class.role-btn--active]="activeRole() === role"
                [attr.title]="roleName(role)"
                (click)="activeRole.set(role)"
              >
                @switch (role) {
                  @case ('TOP') {
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="22" height="22">
                      <path opacity="0.5" fill="currentColor" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/>
                      <polygon fill="currentColor" points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>
                    </svg>
                  }
                  @case ('JUNGLE') {
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="22" height="22">
                      <path fill="currentColor" fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>
                    </svg>
                  }
                  @case ('MIDDLE') {
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="22" height="22">
                      <path opacity="0.5" fill="currentColor" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/>
                      <polygon fill="currentColor" points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>
                    </svg>
                  }
                  @case ('BOTTOM') {
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="22" height="22">
                      <path opacity="0.5" fill="currentColor" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/>
                      <polygon fill="currentColor" points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>
                    </svg>
                  }
                  @case ('UTILITY') {
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="22" height="22">
                      <path fill="currentColor" fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>
                    </svg>
                  }
                }
              </button>
            }
          </div>
        </div>

        <!-- Grid -->
        @if (filteredChampions().length === 0 && allChampions().length > 0) {
          <div class="champs-empty">{{ 'champions.noResults' | t }}</div>
        }

        <div class="champs-grid">
          @for (champ of filteredChampions(); track champ.id) {
            <a
              class="champ-card"
              [routerLink]="['/champion', champ.key]"
            >
              <img
                class="champ-card__img"
                [src]="gameState.getChampionImageUrl(champ.imageFileName)"
                [alt]="champ.name"
                loading="lazy"
                width="64"
                height="64"
              />
              <div class="champ-card__name">{{ champ.name }}</div>
              <div class="champ-card__roles">
                @for (pos of champ.positions; track pos) {
                  <span class="champ-card__role-tag">{{ pos }}</span>
                }
              </div>
            </a>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .champs-page {
      min-height: 100vh;
      padding: 2rem 1rem 3rem;
    }
    .champs-container {
      max-width: 1100px;
      margin: 0 auto;
    }

    .champs-hero {
      text-align: center;
      margin-bottom: 2rem;
    }
    .champs-hero__title {
      font-family: 'Cinzel', serif;
      font-size: clamp(2rem, 5vw, 2.8rem);
      color: var(--lol-gold-1);
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
    }
    .champs-hero__subtitle {
      color: var(--lol-text-muted);
      font-size: 0.85rem;
    }

    /* Filters */
    .champs-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--lol-gold-5);
    }
    .champs-search {
      position: relative;
      flex: 1;
      min-width: 200px;
    }
    .champs-search__icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }
    .champs-search__input {
      width: 100%;
      padding: 0.6rem 0.75rem 0.6rem 2.25rem;
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      color: var(--lol-gold-1);
      background: rgba(1,10,19,0.7);
      border: 1px solid var(--lol-gold-5);
      border-radius: 2px;
      transition: border-color 0.15s ease;
    }
    .champs-search__input:focus {
      outline: none;
      border-color: var(--lol-gold-3);
    }
    .champs-search__input::placeholder {
      color: var(--lol-text-dim);
    }

    .champs-roles {
      display: flex;
      gap: 0.35rem;
    }
    .role-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.2rem;
      height: 2.2rem;
      padding: 0 0.5rem;
      font-family: 'Cinzel', serif;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--lol-text-muted);
      background: rgba(1,10,19,0.5);
      border: 1px solid var(--lol-gold-5);
      border-radius: 2px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .role-btn:hover {
      color: var(--lol-gold-2);
      border-color: var(--lol-gold-4);
    }
    .role-btn--active {
      color: var(--lol-gold-1);
      background: rgba(200,155,60,0.15);
      border-color: var(--lol-gold-3);
    }

    .champs-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--lol-text-muted);
      font-size: 0.9rem;
    }

    /* Grid */
    .champs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 0.75rem;
    }
    @media (min-width: 640px) {
      .champs-grid {
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      }
    }

    .champ-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.65rem 0.4rem;
      background: rgba(1,10,19,0.55);
      border: 1px solid var(--lol-gold-5);
      border-radius: 2px;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .champ-card:hover {
      border-color: var(--lol-gold-3);
      background: rgba(200,155,60,0.08);
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(200,155,60,0.15);
    }
    .champ-card__img {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 2px solid var(--lol-gold-5);
      object-fit: cover;
      margin-bottom: 0.4rem;
      transition: border-color 0.15s ease;
    }
    .champ-card:hover .champ-card__img {
      border-color: var(--lol-gold-3);
    }
    .champ-card__name {
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 0.72rem;
      color: var(--lol-gold-1);
      text-align: center;
      line-height: 1.2;
      margin-bottom: 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
    .champ-card__roles {
      display: flex;
      gap: 0.2rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .champ-card__role-tag {
      font-size: 0.5rem;
      font-family: 'Cinzel', serif;
      letter-spacing: 0.06em;
      color: var(--lol-gold-4);
      text-transform: uppercase;
    }
  `],
})
export class ChampionsListComponent implements OnInit {
  private api = inject(ApiService);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly roles: readonly LaneRole[] = LANE_ORDER;
  readonly allChampions = signal<Champion[]>([]);
  readonly searchQuery = signal('');
  readonly activeRole = signal<LaneRole | null>(null);

  /** Meraki uses "SUPPORT" while Riot Match API uses "UTILITY". Map for filter compatibility. */
  private static readonly ROLE_TO_POSITION: Record<string, string> = {
    TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MIDDLE', BOTTOM: 'BOTTOM', UTILITY: 'SUPPORT',
  };

  readonly filteredChampions = computed(() => {
    let list = this.allChampions();
    const q = this.searchQuery().toLowerCase().trim();
    const role = this.activeRole();

    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (role) {
      const pos = ChampionsListComponent.ROLE_TO_POSITION[role] ?? role;
      list = list.filter((c) => c.positions.includes(pos));
    }
    return list;
  });

  ngOnInit(): void {
    this.seo.updatePageMeta({
      title: 'LoL Champions — Builds & Counter Items | DraftSense',
      description: 'Browse all League of Legends champions. Find the best builds, counter items, skill orders, and ability details for every champion and role.',
      url: 'https://draftsense.net/champions',
    });

    if (!this.isBrowser) return;

    this.api.getChampions().subscribe({
      next: (champs) => {
        this.allChampions.set(champs.sort((a, b) => a.name.localeCompare(b.name)));
      },
    });
  }

  roleName(role: LaneRole): string {
    const names: Record<LaneRole, string> = {
      TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'Bot', UTILITY: 'Support',
    };
    return names[role];
  }
}
