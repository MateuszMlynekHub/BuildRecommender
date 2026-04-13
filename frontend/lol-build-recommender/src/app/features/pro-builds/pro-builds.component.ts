import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { ProBuild } from '../../core/models/champion-detail.model';
import { LaneRole, LANE_ORDER } from '../../core/models/champion.model';

// Inline SVG icon paths for each lane role (from game-view component).
const LANE_SVG_PATHS: Record<string, string> = {
  TOP:
    '<path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/>' +
    '<polygon fill="#c8aa6e" points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>',
  JUNGLE:
    '<path fill="#c8aa6e" fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>',
  MIDDLE:
    '<path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/>' +
    '<polygon fill="#c8aa6e" points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>',
  BOTTOM:
    '<path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/>' +
    '<polygon fill="#c8aa6e" points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>',
  UTILITY:
    '<path fill="#c8aa6e" fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>',
};

@Component({
  selector: 'app-pro-builds',
  standalone: true,
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pb-page">
      <div class="pb-container">
        <div class="pb-hero">
          <h1 class="pb-hero__title">Pro Builds</h1>
          <p class="pb-hero__sub">Recent builds from Challenger & Grandmaster players</p>
        </div>

        <!-- Filters -->
        <div class="pb-filters">
          <div class="pb-filter-group">
            @for (r of regionOptions; track r.id) {
              <button class="pb-pill" [class.pb-pill--active]="selectedRegion() === r.id" (click)="setRegion(r.id)">
                {{ r.label }}
              </button>
            }
          </div>
          <div class="pb-filter-group pb-filter-roles">
            <button class="pb-role-btn" [class.pb-role-btn--active]="!activeRole()" (click)="activeRole.set(null)" title="All roles">
              <span class="pb-role-label">ALL</span>
            </button>
            @for (role of roles; track role) {
              <button class="pb-role-btn" [class.pb-role-btn--active]="activeRole() === role"
                (click)="activeRole.set(role)" [title]="role">
                <span class="pb-role-icon" [innerHTML]="laneIcon(role)"></span>
              </button>
            }
          </div>
          <input class="pb-search" type="text" placeholder="Champion..."
            [ngModel]="championFilter()" (ngModelChange)="championFilter.set($event)" />
        </div>

        @if (loading()) {
          <div class="pb-loading">Loading builds...</div>
        }

        @if (filteredBuilds().length > 0) {
          <div class="pb-table">
            <div class="pb-thead">
              <span class="pb-th pb-th--dot"></span>
              <span class="pb-th pb-th--player">Player</span>
              <span class="pb-th pb-th--champ">Champion</span>
              <span class="pb-th pb-th--role">Role</span>
              <span class="pb-th pb-th--kda">KDA</span>
              <span class="pb-th pb-th--items">Build</span>
              <span class="pb-th pb-th--time">Time</span>
              <span class="pb-th pb-th--expand"></span>
            </div>
            @for (build of filteredBuilds(); track build.matchId) {
              <div class="pb-row" [class.pb-row--win]="build.win" [class.pb-row--loss]="!build.win"
                   (click)="toggleExpand(build.matchId)">
                <span class="pb-td pb-td--dot">
                  <span class="pb-dot" [class.pb-dot--win]="build.win" [class.pb-dot--loss]="!build.win"></span>
                </span>
                <div class="pb-td pb-td--player">
                  <img class="pb-avatar" [src]="gameState.getChampionImageUrl(build.championKey + '.png')"
                    width="38" height="38" loading="lazy" />
                  <div class="pb-pinfo">
                    <span class="pb-pname">{{ build.playerName }}</span>
                    <span class="pb-pteam">{{ build.team }}</span>
                  </div>
                </div>
                <div class="pb-td pb-td--champ">
                  <a class="pb-champ-link" [routerLink]="['/champion', build.championKey]" (click)="$event.stopPropagation()">
                    {{ build.championKey }}
                  </a>
                </div>
                <span class="pb-td pb-td--role">
                  <span class="pb-role-icon pb-role-icon--sm" [innerHTML]="laneIcon(build.role)"></span>
                </span>
                <span class="pb-td pb-td--kda">
                  <span class="pb-kda-n">{{ build.kills }}/{{ build.deaths }}/{{ build.assists }}</span>
                  <span class="pb-kda-r" [class.pb-kda-good]="kdaRatio(build) >= 3" [class.pb-kda-great]="kdaRatio(build) >= 5">
                    {{ kdaRatio(build).toFixed(1) }}
                  </span>
                </span>
                <div class="pb-td pb-td--items">
                  @for (itemId of build.items; track $index) {
                    <img class="pb-item" [src]="gameState.getItemImageUrl(itemId + '.png')"
                      width="32" height="32" loading="lazy"
                      (error)="onItemImgError($event)" />
                  }
                </div>
                <span class="pb-td pb-td--time">{{ timeAgo(build.matchId) }}</span>
                <span class="pb-td pb-td--expand">
                  <svg class="pb-chevron" [class.pb-chevron--open]="expandedMatch() === build.matchId"
                    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
                  </svg>
                </span>
              </div>

              @if (expandedMatch() === build.matchId && build.participants.length) {
                <div class="pb-detail">
                  @for (tid of [100, 200]; track tid) {
                    <div class="pb-team" [class.pb-team--win]="isTeamWin(build, tid)">
                      <div class="pb-team-hdr">
                        <span class="pb-team-side">{{ tid === 100 ? 'Blue' : 'Red' }}</span>
                        <span [class.pb-win-tag]="isTeamWin(build, tid)" [class.pb-loss-tag]="!isTeamWin(build, tid)">
                          {{ isTeamWin(build, tid) ? 'WIN' : 'LOSS' }}
                        </span>
                      </div>
                      @for (p of getTeam(build, tid); track p.championId) {
                        <div class="pb-part" [class.pb-part--me]="p.championId === build.championId && tid === 100">
                          <img class="pb-part-icon" [src]="p.championImage || gameState.getChampionImageUrl(p.championKey + '.png')"
                            width="28" height="28" loading="lazy" />
                          <span class="pb-part-role-icon" [innerHTML]="laneIcon(p.teamPosition)"></span>
                          <span class="pb-part-name">{{ p.summonerName }}</span>
                          <span class="pb-part-champ">{{ p.championKey }}</span>
                          <span class="pb-part-kda">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>
        } @else if (!loading()) {
          <div class="pb-empty">No pro builds for this filter.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .pb-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .pb-container { max-width: 1100px; margin: 0 auto; }
    .pb-hero { text-align: center; margin-bottom: 1.25rem; }
    .pb-hero__title { font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--lol-gold-1); }
    .pb-hero__sub { color: var(--lol-text-muted); font-size: 0.9rem; margin-top: 0.2rem; }

    /* Filters */
    .pb-filters {
      display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center;
      margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--lol-gold-5);
    }
    .pb-filter-group { display: flex; gap: 0.3rem; }
    .pb-filter-roles { gap: 0.2rem; }
    .pb-pill {
      padding: 0.4rem 0.75rem; font-size: 0.78rem; font-weight: 600;
      color: var(--lol-gold-3, #c89b3c); background: rgba(1,10,19,0.5);
      border: 1px solid var(--lol-gold-5); border-radius: 3px; cursor: pointer;
    }
    .pb-pill:hover { color: var(--lol-gold-1); }
    .pb-pill--active { color: var(--lol-gold-1); background: rgba(200,155,60,0.15); border-color: var(--lol-gold-3); }
    .pb-role-btn {
      width: 38px; height: 36px; display: flex; align-items: center; justify-content: center;
      background: rgba(1,10,19,0.5); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; cursor: pointer; padding: 0;
    }
    .pb-role-btn:hover { border-color: var(--lol-gold-4); }
    .pb-role-btn--active { background: rgba(200,155,60,0.15); border-color: var(--lol-gold-3); }
    .pb-role-label { font-size: 0.7rem; font-weight: 700; color: var(--lol-gold-3); }
    .pb-role-icon { display: flex; align-items: center; justify-content: center; }
    .pb-role-icon :deep(svg) { width: 22px; height: 22px; }
    .pb-role-icon--sm { display: inline-flex; }
    .pb-role-icon--sm :deep(svg) { width: 20px; height: 20px; }
    .pb-search {
      background: rgba(0,0,0,0.3); border: 1px solid var(--lol-gold-5); border-radius: 3px;
      color: var(--lol-gold-3); padding: 0.4rem 0.65rem; font-size: 0.85rem; width: 150px;
      margin-left: auto;
    }
    .pb-search::placeholder { color: var(--lol-text-muted); }

    .pb-loading, .pb-empty { text-align: center; color: var(--lol-text-muted); padding: 2.5rem; font-size: 0.9rem; font-style: italic; }

    /* Table */
    .pb-table { border: 1px solid var(--lol-gold-5); border-radius: 4px; overflow: hidden; }
    .pb-thead {
      display: flex; align-items: center; padding: 0.55rem 0.75rem;
      background: rgba(200,155,60,0.08); border-bottom: 1px solid var(--lol-gold-5);
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--lol-gold-3);
    }
    .pb-row {
      display: flex; align-items: center; padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(120,90,40,0.06); cursor: pointer;
      transition: background 0.1s;
    }
    .pb-row:hover { background: rgba(200,155,60,0.04); }
    .pb-row--win { border-left: 4px solid #50E3C2; }
    .pb-row--loss { border-left: 4px solid #E84057; }

    .pb-th, .pb-td { font-size: 0.88rem; }
    .pb-th--dot, .pb-td--dot { width: 22px; }
    .pb-th--player, .pb-td--player { width: 190px; }
    .pb-th--champ, .pb-td--champ { width: 115px; }
    .pb-th--role, .pb-td--role { width: 40px; text-align: center; }
    .pb-th--kda, .pb-td--kda { width: 110px; }
    .pb-th--items, .pb-td--items { flex: 1; min-width: 0; }
    .pb-th--time, .pb-td--time { width: 75px; font-size: 0.78rem; color: var(--lol-text-muted); text-align: right; }
    .pb-th--expand, .pb-td--expand { width: 26px; text-align: center; }

    .pb-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
    .pb-dot--win { background: #50E3C2; }
    .pb-dot--loss { background: #E84057; }

    .pb-td--player { display: flex; align-items: center; gap: 0.5rem; }
    .pb-avatar { border-radius: 50%; border: 2px solid var(--lol-gold-5); width: 38px; height: 38px; }
    .pb-pinfo { display: flex; flex-direction: column; min-width: 0; }
    .pb-pname { font-weight: 700; font-size: 0.88rem; color: var(--lol-gold-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pb-pteam { font-size: 0.68rem; color: var(--lol-text-muted); }

    .pb-champ-link { font-weight: 600; font-size: 0.88rem; color: var(--lol-gold-1); text-decoration: none; }
    .pb-champ-link:hover { color: var(--lol-cyan); }

    .pb-td--kda { display: flex; align-items: center; gap: 0.4rem; }
    .pb-kda-n { font-size: 0.88rem; color: var(--lol-gold-1); }
    .pb-kda-r { font-size: 0.75rem; color: var(--lol-text-muted); }
    .pb-kda-good { color: #50E3C2; font-weight: 600; }
    .pb-kda-great { color: #FF7043; font-weight: 700; }

    .pb-td--items { display: flex; gap: 3px; overflow: hidden; }
    .pb-item { width: 32px; height: 32px; border-radius: 3px; border: 1px solid var(--lol-gold-5); background: rgba(0,0,0,0.4); }

    .pb-chevron { color: var(--lol-text-muted); transition: transform 0.2s; }
    .pb-chevron--open { transform: rotate(180deg); }

    /* Expanded detail */
    .pb-detail {
      display: grid; grid-template-columns: 1fr 1fr;
      background: rgba(1,10,19,0.35); border-bottom: 1px solid var(--lol-gold-5);
    }
    .pb-team { padding: 0.6rem 0.75rem; }
    .pb-team:first-child { border-right: 1px solid rgba(120,90,40,0.1); }
    .pb-team-hdr {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 0.35rem; padding-bottom: 0.25rem; border-bottom: 1px solid rgba(120,90,40,0.06);
      font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--lol-text-muted); font-weight: 700;
    }
    .pb-win-tag { color: #50E3C2; }
    .pb-loss-tag { color: #E84057; }

    .pb-part {
      display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0; font-size: 0.82rem;
    }
    .pb-part--me { background: rgba(200,155,60,0.1); border-radius: 3px; padding: 0.25rem 0.35rem; }
    .pb-part-icon { border-radius: 50%; border: 1px solid var(--lol-gold-5); width: 28px; height: 28px; }
    .pb-part-role-icon { display: inline-flex; }
    .pb-part-role-icon :deep(svg) { width: 18px; height: 18px; }
    .pb-part-name { color: var(--lol-gold-1); font-weight: 600; min-width: 70px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pb-part-champ { color: var(--lol-text-muted); font-size: 0.75rem; min-width: 60px; }
    .pb-part-kda { margin-left: auto; color: var(--lol-gold-3); font-size: 0.8rem; }

    @media (max-width: 700px) {
      .pb-th--time, .pb-td--time { display: none; }
      .pb-th--player, .pb-td--player { width: 140px; }
      .pb-detail { grid-template-columns: 1fr; }
      .pb-team:first-child { border-right: none; border-bottom: 1px solid rgba(120,90,40,0.08); }
    }
  `],
})
export class ProBuildsComponent implements OnInit {
  private api = inject(ApiService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private laneIconCache = new Map<string, SafeHtml>();

  readonly regionOptions = [
    { id: 'euw1', label: 'EUW' },
    { id: 'eun1', label: 'EUNE' },
    { id: 'na1', label: 'NA' },
    { id: 'kr', label: 'KR' },
  ];

  readonly roles: readonly LaneRole[] = LANE_ORDER;
  readonly selectedRegion = signal('euw1');
  readonly activeRole = signal<LaneRole | null>(null);
  readonly championFilter = signal('');
  readonly loading = signal(false);
  readonly allBuilds = signal<ProBuild[]>([]);
  readonly expandedMatch = signal<string | null>(null);

  readonly filteredBuilds = computed(() => {
    let builds = this.allBuilds();
    const role = this.activeRole();
    const q = this.championFilter().toLowerCase();
    if (role) builds = builds.filter(b => b.role?.toUpperCase() === role);
    if (q) builds = builds.filter(b => b.championKey.toLowerCase().includes(q));
    return builds;
  });

  ngOnInit(): void {
    this.seo.updatePageMeta({
      title: 'Pro Builds — Challenger & Grandmaster Builds | DraftSense',
      description: 'Browse recent builds from Challenger and Grandmaster League of Legends players.',
      url: 'https://draftsense.net/pro-builds',
    });
    if (!this.isBrowser) return;
    this.loadData();
  }

  setRegion(region: string): void {
    this.selectedRegion.set(region);
    this.loadData();
  }

  toggleExpand(matchId: string): void {
    this.expandedMatch.set(this.expandedMatch() === matchId ? null : matchId);
  }

  getTeam(build: ProBuild, teamId: number) {
    return (build.participants || []).filter(p => p.teamId === teamId);
  }

  isTeamWin(build: ProBuild, teamId: number): boolean {
    return (build.participants || []).find(p => p.teamId === teamId)?.win ?? false;
  }

  kdaRatio(build: ProBuild): number {
    return build.deaths === 0 ? build.kills + build.assists : (build.kills + build.assists) / build.deaths;
  }

  laneIcon(role: string): SafeHtml {
    const key = (role || '').toUpperCase();
    const cached = this.laneIconCache.get(key);
    if (cached) return cached;

    const paths = LANE_SVG_PATHS[key] || '<circle cx="17" cy="17" r="4" fill="#785a28"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="18" height="18">${paths}</svg>`;
    const safe = this.sanitizer.bypassSecurityTrustHtml(svg);
    this.laneIconCache.set(key, safe);
    return safe;
  }

  /** Generates "1d ago", "3d ago", "1w ago" style strings from matchId hash. */
  timeAgo(matchId: string): string {
    // Deterministic pseudo-time from matchId for synthetic data
    let hash = 0;
    for (let i = 0; i < matchId.length; i++) hash = ((hash << 5) - hash + matchId.charCodeAt(i)) | 0;
    const hours = Math.abs(hash % 168) + 1; // 1-168h (1 week)
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return '1w ago';
  }

  onItemImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private loadData(): void {
    this.loading.set(true);
    this.expandedMatch.set(null);
    this.api.getProBuilds(this.selectedRegion(), 30).subscribe({
      next: (builds) => { this.allBuilds.set(builds); this.loading.set(false); },
      error: () => { this.allBuilds.set([]); this.loading.set(false); },
    });
  }
}
