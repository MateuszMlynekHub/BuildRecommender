import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { GameStateService } from '../../core/services/game-state.service';
import { ApiService } from '../../core/services/api.service';
import { SeoService } from '../../core/services/seo.service';
import { ActiveGame, Team, Participant, Lane, BannedChampion } from '../../core/models/active-game.model';
import { BuildPanelComponent } from '../build-panel/build-panel.component';
import { TPipe } from '../../shared/pipes/t.pipe';
import { TranslationKey } from '../../core/i18n/translations';

// Lane sort order: Top → Jungle → Mid → Bot → Support.
const LANE_ORDER: Record<string, number> = {
  TOP: 0,
  JUNGLE: 1,
  MIDDLE: 2,
  BOTTOM: 3,
  UTILITY: 4,
  '': 5,
};

// Lane → translation key mapping. Resolved via the t pipe in templates so
// flipping language updates labels without touching this file.
const LANE_LABEL_KEYS: Record<string, TranslationKey> = {
  TOP:     'lane.top',
  JUNGLE:  'lane.jungle',
  MIDDLE:  'lane.middle',
  BOTTOM:  'lane.bottom',
  UTILITY: 'lane.utility',
  '':      'lane.unknown',
};

const LANE_COLORS: Record<string, string> = {
  TOP: '#3B82F6',
  JUNGLE: '#22C55E',
  MIDDLE: '#A855F7',
  BOTTOM: '#F97316',
  UTILITY: '#14B8A6',
  '': '#6B7280',
};

@Component({
  selector: 'app-game-view',
  standalone: true,
  imports: [CommonModule, BuildPanelComponent, TPipe],
  styles: [`
    .participant-row {
      cursor: pointer;
    }
    .participant-row:hover .drag-handle {
      cursor: grab;
    }
    .participant-row.is-dragging {
      opacity: 0.4;
      cursor: grabbing;
    }
    .participant-row.is-drag-over {
      background: linear-gradient(90deg, rgba(10, 200, 185, 0.25), rgba(10, 200, 185, 0.08)) !important;
      border: 1px dashed var(--lol-cyan) !important;
      box-shadow: 0 0 20px rgba(10, 200, 185, 0.3);
    }

    /* Enemy team dim-out while a drag is active on the other team.
       Grayscale + opacity + block pointer events so users can't accidentally
       drop onto the wrong team (backend swap is already team-scoped, this is
       just visual reinforcement). */
    .team-card {
      transition: opacity 0.2s ease, filter 0.2s ease;
    }
    .team-card.team-dimmed {
      opacity: 0.3;
      filter: grayscale(0.7);
      pointer-events: none;
    }
  `],
  template: `
    <div class="min-h-screen p-4 md:p-8">
      <div class="max-w-7xl mx-auto">
        <!-- Top bar: title + back button + LIVE indicator -->
        <div class="flex items-center justify-between mb-8 animate-in">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full gold-border-bright flex items-center justify-center"
                 style="background: radial-gradient(circle, rgba(200,155,60,0.2), transparent 70%);">
              <span class="w-3 h-3 rounded-full pulse-live" style="background-color: var(--lol-cyan);"></span>
            </div>
            <div>
              <div class="text-xs font-display uppercase tracking-widest text-cyan">{{ 'game.live' | t }}</div>
              <h1 class="text-2xl md:text-3xl font-display text-gold-lite">{{ 'game.title' | t }}</h1>
            </div>
          </div>
          <button (click)="goBack()" class="btn-outline flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            {{ 'game.back' | t }}
          </button>
        </div>

        @if (initialLoading()) {
          <div class="flex flex-col items-center justify-center py-32 animate-in">
            <div class="w-16 h-16 mb-4 rounded-full border-4 border-t-transparent animate-spin" style="border-color: var(--lol-gold-3); border-top-color: transparent;"></div>
            <p class="font-display text-gold tracking-widest text-sm uppercase">{{ 'game.loading' | t }}</p>
          </div>
        } @else if (loadErrorKey(); as errKey) {
          <div class="glass-card p-10 text-center animate-in max-w-lg mx-auto mt-20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="var(--lol-red)" class="mx-auto mb-4">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <p class="text-lg mb-4" style="color: #FCA5A5;">{{ errKey | t }}</p>
            <button (click)="goBack()" class="btn-outline">{{ 'game.backToSearch' | t }}</button>
          </div>
        } @else if (game(); as g) {
          <!-- Bans banner — grayscale portraits + red strikethrough feel -->
          @if (g.bans && g.bans.length > 0) {
            <div class="glass-card p-4 mb-8 animate-in">
              <div class="flex items-center gap-3 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="var(--lol-gold-3)">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
                </svg>
                <h3 class="text-xs font-display uppercase tracking-widest text-gold-soft">{{ 'game.bans' | t }}</h3>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div class="text-xs mb-2 font-display uppercase tracking-widest" style="color: var(--lol-blue-team)">{{ 'game.blueTeam' | t }}</div>
                  <div class="flex gap-2 flex-wrap">
                    @for (ban of bansForTeam(g, 100); track ban.championId) {
                      <div class="relative group">
                        <img
                          [src]="ban.championImageUrl"
                          [alt]="ban.championName"
                          [title]="ban.championName"
                          class="w-12 h-12 rounded"
                          style="filter: grayscale(100%) brightness(0.4); border: 1px solid var(--lol-red-2);"
                          (error)="onImgError($event)"
                        />
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div class="w-full h-0.5 rotate-45" style="background: var(--lol-red); box-shadow: 0 0 6px rgba(232,64,87,0.8);"></div>
                        </div>
                      </div>
                    }
                    @if (bansForTeam(g, 100).length === 0) {
                      <span class="text-xs text-muted italic">{{ 'game.noBans' | t }}</span>
                    }
                  </div>
                </div>
                <div>
                  <div class="text-xs mb-2 font-display uppercase tracking-widest" style="color: var(--lol-red)">{{ 'game.redTeam' | t }}</div>
                  <div class="flex gap-2 flex-wrap">
                    @for (ban of bansForTeam(g, 200); track ban.championId) {
                      <div class="relative group">
                        <img
                          [src]="ban.championImageUrl"
                          [alt]="ban.championName"
                          [title]="ban.championName"
                          class="w-12 h-12 rounded"
                          style="filter: grayscale(100%) brightness(0.4); border: 1px solid var(--lol-red-2);"
                          (error)="onImgError($event)"
                        />
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div class="w-full h-0.5 rotate-45" style="background: var(--lol-red); box-shadow: 0 0 6px rgba(232,64,87,0.8);"></div>
                        </div>
                      </div>
                    }
                    @if (bansForTeam(g, 200).length === 0) {
                      <span class="text-xs text-muted italic">{{ 'game.noBans' | t }}</span>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Team cards grid with VS divider -->
          <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 animate-in">
            <!-- Center VS badge on desktop -->
            <div class="hidden lg:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
              <div class="w-16 h-16 rounded-full flex items-center justify-center gold-border-bright font-display text-xl text-gold-lite"
                   style="background: radial-gradient(circle, var(--lol-abyss) 40%, transparent 100%); box-shadow: 0 0 40px rgba(200,155,60,0.4);">
                {{ 'game.vs' | t }}
              </div>
            </div>

            @for (team of g.teams; track team.teamId) {
              <div class="team-card glass-card overflow-hidden"
                   [class.team-dimmed]="isTeamDimmed(team.teamId)"
                   [style.border-color]="team.teamId === 100 ? 'var(--lol-blue-team)' : 'var(--lol-red)'">
                <!-- Team header with gradient background -->
                <div class="px-5 py-3 flex items-center justify-between"
                     [style.background]="team.teamId === 100
                       ? 'linear-gradient(90deg, rgba(74,144,226,0.25), transparent)'
                       : 'linear-gradient(90deg, rgba(232,64,87,0.25), transparent)'">
                  <div class="flex items-center gap-3">
                    <div class="w-2 h-8"
                         [style.background-color]="team.teamId === 100 ? 'var(--lol-blue-team)' : 'var(--lol-red)'"></div>
                    <h2 class="font-display uppercase tracking-widest text-sm"
                        [style.color]="team.teamId === 100 ? 'var(--lol-blue-team)' : 'var(--lol-red)'">
                      {{ (team.teamId === 100 ? 'game.blueTeam' : 'game.redTeam') | t }}
                    </h2>
                  </div>
                  <span class="text-xs text-muted">{{ team.participants.length }} {{ 'game.players' | t }}</span>
                </div>

                <!-- Participants list — bigger portraits, splash background reveal on hover.
                     Each row is draggable so users can swap lanes when players did a
                     verbal-only lane swap in lobby (no pick swap) — drop on another row
                     of the same team to exchange their lane assignments + re-fetch builds.
                     Track by championId — guaranteed unique within a team (can't pick the
                     same champion twice) and stable across lane swaps, so Angular moves
                     existing DOM elements in place instead of recreating them (which
                     would cancel an in-progress drag). -->
                <div class="p-3 space-y-2">
                  @for (participant of sortByLane(team.participants); track participant.championId) {
                    <div
                      class="participant-row relative flex items-center gap-3 p-3 rounded transition-all overflow-hidden group"
                      [class.is-drag-over]="dragOverChampionId() === participant.championId"
                      [class.is-dragging]="draggedChampionId() === participant.championId"
                      [style.background]="selectedChampionId() === participant.championId
                        ? 'linear-gradient(90deg, rgba(200,155,60,0.2), rgba(200,155,60,0.05))'
                        : 'rgba(1, 10, 19, 0.6)'"
                      [style.border]="selectedChampionId() === participant.championId
                        ? '1px solid var(--lol-gold-3)'
                        : '1px solid transparent'"
                      draggable="true"
                      (dragstart)="onDragStart($event, participant, team)"
                      (dragover)="onDragOver($event, participant, team)"
                      (dragleave)="onDragLeave($event, participant)"
                      (drop)="onDrop($event, participant, team)"
                      (dragend)="onDragEnd()"
                      (click)="selectChampion(participant, team)"
                    >
                      <!-- Splash art background on hover (loading champion centered splash) -->
                      <div class="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none"
                           [style.background-image]="'url(' + championSplashUrl(participant.championName) + ')'"
                           style="background-size: cover; background-position: center 20%;"></div>
                      <div class="absolute inset-0 pointer-events-none"
                           style="background: linear-gradient(90deg, rgba(1,10,19,0.85) 0%, rgba(1,10,19,0.5) 100%);"></div>

                      <!-- Official Riot lane icon — gold on subtle dark, matches LoL client -->
                      <div class="relative flex items-center justify-center w-10 h-10 shrink-0 rounded"
                           style="background: rgba(1, 10, 19, 0.7); border: 1px solid var(--lol-gold-5);"
                           [title]="laneLabelKey(participant.lane) | t"
                           [innerHTML]="laneIconSvg(participant.lane)"></div>

                      <!-- Champion portrait — larger + glow on selected -->
                      <div class="relative lol-portrait w-14 h-14 shrink-0"
                           [class.selected]="selectedChampionId() === participant.championId">
                        <img
                          [src]="participant.championImageUrl"
                          [alt]="participant.championName"
                          class="w-full h-full object-cover"
                          (error)="onImgError($event)"
                        />
                      </div>

                      <!-- Name + lane + riotId -->
                      <div class="relative flex-1 min-w-0">
                        <div class="font-display text-base truncate text-gold-lite">{{ participant.championName }}</div>
                        <div class="flex items-center gap-2 text-xs text-muted">
                          <span class="uppercase tracking-wider"
                                [style.color]="laneColor(participant.lane)">{{ laneLabelKey(participant.lane) | t }}</span>
                          <span>·</span>
                          <span class="truncate">{{ participant.riotId || ('game.unknown' | t) }}</span>
                        </div>
                      </div>

                      <!-- YOU badge -->
                      @if (participant.puuid === g.searchedPuuid) {
                        <span class="relative text-xs px-2 py-1 font-display tracking-widest uppercase"
                              style="background: linear-gradient(180deg, var(--lol-gold-3), var(--lol-gold-4)); color: var(--lol-void); box-shadow: 0 0 12px rgba(200,155,60,0.6);">
                          {{ 'game.you' | t }}
                        </span>
                      }

                      <!-- Drag handle — cursor hint that the row is draggable -->
                      <div class="relative drag-handle opacity-30 group-hover:opacity-80 transition-opacity"
                           [title]="'game.dragHint' | t">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="var(--lol-gold-2)">
                          <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/>
                        </svg>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Build panel section -->
          @if (buildLoading()) {
            <div class="glass-card p-12 text-center animate-in">
              <div class="inline-block w-12 h-12 mb-4 rounded-full border-4 border-t-transparent animate-spin"
                   style="border-color: var(--lol-gold-3); border-top-color: transparent;"></div>
              <p class="font-display text-gold tracking-widest text-sm uppercase">{{ 'game.forging' | t }}</p>
            </div>
          }

          @if (gameState.buildRecommendation(); as build) {
            <app-build-panel [recommendation]="build" [version]="gameState.ddragonVersion()" />
          }

          @if (!selectedChampionId() && !buildLoading()) {
            <div class="glass-card p-12 text-center animate-in">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="var(--lol-gold-3)" class="mx-auto mb-4 opacity-60">
                <path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/>
              </svg>
              <p class="font-display uppercase tracking-widest text-gold-soft text-sm">
                {{ 'game.selectChampion' | t }}
              </p>
            </div>
          }
        } @else {
          <div class="glass-card p-12 text-center animate-in max-w-lg mx-auto mt-20">
            <p class="text-muted mb-4">{{ 'game.noGame' | t }}</p>
            <button (click)="goBack()" class="btn-outline">{{ 'game.backToSearch' | t }}</button>
          </div>
        }
      </div>
    </div>
  `,
})
export class GameViewComponent implements OnInit {
  gameState = inject(GameStateService);
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);

  game = this.gameState.game;
  selectedChampionId = this.gameState.selectedChampionId;
  buildLoading = signal(false);
  initialLoading = signal(false);
  // Error state holds a translation key rather than a raw string so the
  // message in the error banner re-renders when the user switches language.
  loadErrorKey = signal<TranslationKey | null>(null);

  // Drag & drop state for swapping lanes when players did a verbal-only swap in lobby.
  // championId is used as the drag identity (NOT puuid) because Riot API ships an empty
  // puuid for bot accounts / smurfs / anonymised players, and an empty string tripped
  // the `!sourcePuuid` guard in onDrop which blocked legitimate drags on those rows.
  // championId is guaranteed unique within a single team.
  draggedChampionId = signal<number | null>(null);
  draggedFromTeamId = signal<number | null>(null);
  dragOverChampionId = signal<number | null>(null);

  private readonly laneIconCache = new Map<string, SafeHtml>();

  ngOnInit() {
    // SEO — the game view is per-player and noindex-worthy (each URL is dynamic
    // and has no value to a search engine), but we still set a meaningful title
    // so it shows up correctly in the browser tab, shares, and history. Google
    // won't rank this page but social unfurls still render OG/Twitter tags.
    this.seo.updatePageMeta({
      title: 'Analiza aktywnej gry — DraftSense',
      description: 'Rekomendacje itemów dopasowane do drużyny przeciwnej w Twojej aktywnej grze League of Legends.',
    });

    // If a game is already loaded in memory (normal navigation from Home), keep it.
    if (this.game()) return;

    // Otherwise try to rehydrate from query params — this is the refresh case.
    const params = this.route.snapshot.queryParamMap;
    const gameName = params.get('gameName');
    const tagLine = params.get('tagLine');
    const region = params.get('region');

    if (!gameName || !tagLine || !region) {
      this.router.navigate(['/']);
      return;
    }

    this.initialLoading.set(true);
    this.loadErrorKey.set(null);
    this.api.findActiveGame(gameName, tagLine, region).subscribe({
      next: (game) => {
        this.validateGameLanes(game);
        this.gameState.game.set(game);
        this.initialLoading.set(false);
      },
      error: (err) => {
        this.initialLoading.set(false);
        if (err.status === 404) {
          this.loadErrorKey.set('home.form.error.notInGame');
        } else if (err.status === 403 || err.status === 401) {
          this.loadErrorKey.set('home.form.error.apiKey');
        } else {
          this.loadErrorKey.set('home.form.error.generic');
        }
      },
    });
  }

  sortByLane(participants: Participant[]): Participant[] {
    return [...participants].sort(
      (a, b) => (LANE_ORDER[a.lane] ?? 99) - (LANE_ORDER[b.lane] ?? 99),
    );
  }

  bansForTeam(game: ActiveGame, teamId: number): BannedChampion[] {
    return (game.bans ?? []).filter((b) => b.teamId === teamId && b.championId > 0);
  }

  /**
   * Full-size champion splash art served by Data Dragon CDN. Used as an animated
   * background on the participant row on hover — makes the UI feel alive.
   * Falls back to a gray placeholder URL if the champion name has spaces/special chars
   * Riot doesn't index (Aatrox_0.jpg is stable but some champs have odd naming).
   */
  championSplashUrl(championName: string): string {
    if (!championName) return '';
    // Data Dragon uses the champion's Riot "key" (PascalCase, no spaces/apostrophes).
    // The backend sends the display name; strip spaces and apostrophes to approximate the key.
    const key = championName.replace(/[\s'.]/g, '');
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`;
  }

  /**
   * Returns the translation key for a given lane so the template can pipe it
   * through `| t`. Falls back to the "unknown" placeholder for any lane the
   * Riot API sends us that isn't one of the five standard positions.
   */
  laneLabelKey(lane: Lane): TranslationKey {
    return LANE_LABEL_KEYS[lane] ?? 'lane.unknown';
  }

  laneColor(lane: Lane): string {
    return LANE_COLORS[lane] ?? '#6B7280';
  }

  /**
   * Official League of Legends position icons, mirrored from Community Dragon
   * (`rcp-fe-lol-champ-select/global/default/svg/position-*.svg`). These are the
   * exact SVGs Riot uses in champion select — same map-corner indicator for TOP/BOT,
   * diamond for MIDDLE, foliage shape for JUNGLE, laurel crown for UTILITY.
   *
   * Colors use the Riot palette directly: #c8aa6e (active gold) + #785a28 (inactive
   * dark gold) so the icons visually match the rest of the theme without extra tinting.
   * Cached per lane — each SafeHtml blob is created once on first render.
   */
  laneIconSvg(lane: Lane): SafeHtml {
    const key = lane || '';
    const cached = this.laneIconCache.get(key);
    if (cached) return cached;

    const wrap = (paths: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="26" height="26">${paths}</svg>`;

    let svg: string;
    switch (lane) {
      case 'TOP':
        svg = wrap(
          '<path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/>' +
          '<polygon fill="#c8aa6e" points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>'
        );
        break;
      case 'JUNGLE':
        svg = wrap(
          '<path fill="#c8aa6e" fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>'
        );
        break;
      case 'MIDDLE':
        svg = wrap(
          '<path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/>' +
          '<polygon fill="#c8aa6e" points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>'
        );
        break;
      case 'BOTTOM':
        svg = wrap(
          '<path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/>' +
          '<polygon fill="#c8aa6e" points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>'
        );
        break;
      case 'UTILITY':
        svg = wrap(
          '<path fill="#c8aa6e" fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>'
        );
        break;
      default:
        svg = wrap('<circle cx="17" cy="17" r="5" fill="#785a28"/>');
    }

    const safe = this.sanitizer.bypassSecurityTrustHtml(svg);
    this.laneIconCache.set(key, safe);
    return safe;
  }

  selectChampion(participant: Participant, selectedTeam: Team) {
    this.gameState.selectedChampionId.set(participant.championId);
    this.gameState.buildRecommendation.set(null);
    this.buildLoading.set(true);

    const game = this.game();
    if (!game) return;

    const enemyTeam = game.teams.find(t => t.teamId !== selectedTeam.teamId);
    const allyTeam = selectedTeam;

    const enemyIds = enemyTeam?.participants.map(p => p.championId) ?? [];
    const allyIds = allyTeam.participants
      .filter(p => p.championId !== participant.championId)
      .map(p => p.championId);

    this.api
      .getRecommendedBuild(participant.championId, enemyIds, allyIds, participant.lane || undefined)
      .subscribe({
        next: (build) => {
          this.gameState.buildRecommendation.set(build);
          this.buildLoading.set(false);
        },
        error: () => {
          this.buildLoading.set(false);
        },
      });
  }

  goBack() {
    this.gameState.game.set(null);
    this.gameState.selectedChampionId.set(null);
    this.gameState.buildRecommendation.set(null);
    this.router.navigate(['/']);
  }

  // =====================================================================================
  // Drag & drop — lane-swap flow
  // =====================================================================================
  // Why: Riot's spectator API reports the in-game `teamPosition` which is often wrong
  // when players did a verbal swap in lobby (e.g., Aatrox picks top slot but actually
  // plays support). The build recommender then serves mismatched items. Letting users
  // drag a champion tile onto another tile of the same team swaps the LANES (not the
  // champions) and re-fetches the build with the correct role.
  // =====================================================================================

  onDragStart(ev: DragEvent, participant: Participant, team: Team) {
    console.debug('[dragstart]', {
      champion: participant.championName,
      championId: participant.championId,
      lane: participant.lane,
      teamId: team.teamId,
    });

    // Fresh state for every drag — stops leftover values from a cancelled drag
    // blocking the next one.
    this.draggedChampionId.set(participant.championId);
    this.draggedFromTeamId.set(team.teamId);
    this.dragOverChampionId.set(null);
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      // Required for Firefox to fire drop events.
      ev.dataTransfer.setData('text/plain', String(participant.championId));
    }
  }

  onDragOver(ev: DragEvent, target: Participant, team: Team) {
    // Only allow dropping on the same team and not on self.
    if (this.draggedFromTeamId() !== team.teamId) return;
    if (this.draggedChampionId() === target.championId) return;

    // preventDefault is REQUIRED for the drop event to fire afterwards.
    // NOT calling stopPropagation — some browsers interpret it as blocking the drop.
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';

    // Guard against duplicate signal sets (dragover fires ~60 times/sec over the same target).
    if (this.dragOverChampionId() !== target.championId) {
      this.dragOverChampionId.set(target.championId);
    }
  }

  onDragLeave(_ev: DragEvent, target: Participant) {
    if (this.dragOverChampionId() === target.championId) {
      this.dragOverChampionId.set(null);
    }
  }

  onDrop(ev: DragEvent, target: Participant, team: Team) {
    ev.preventDefault();

    const sourceChampionId = this.draggedChampionId();
    const sourceTeamId = this.draggedFromTeamId();

    console.debug('[drop]', {
      sourceChampionId,
      target: { championId: target.championId, champion: target.championName, lane: target.lane },
      sourceTeamId,
      targetTeamId: team.teamId,
    });

    // Always clear state FIRST — regardless of whether the swap actually runs,
    // so a subsequent drag starts from a clean slate.
    this.clearDragState();

    if (sourceChampionId == null || sourceChampionId === target.championId) {
      console.debug('[drop] skipped — no source or self-drop');
      return;
    }
    if (sourceTeamId !== team.teamId) {
      console.debug('[drop] skipped — cross-team drop blocked');
      return;
    }

    this.swapLanes(sourceChampionId, target.championId, team.teamId);
  }

  onDragEnd() {
    console.debug('[dragend]');
    this.clearDragState();
  }

  private clearDragState() {
    this.draggedChampionId.set(null);
    this.draggedFromTeamId.set(null);
    this.dragOverChampionId.set(null);
  }

  /** True when the given team should be dimmed out because a drag is active on the other team. */
  isTeamDimmed(teamId: number): boolean {
    const fromTeam = this.draggedFromTeamId();
    return fromTeam !== null && fromTeam !== teamId;
  }

  /**
   * Sanity check the game response from the backend — flags duplicate puuids, duplicate
   * lanes, or missing lanes within a team so we can diagnose "3 champions with the same role"
   * reports. Errors are logged to the console, not surfaced to the user (the data is still
   * rendered even if imperfect — these are diagnostics).
   */
  private validateGameLanes(game: ActiveGame) {
    for (const team of game.teams) {
      const puuids = new Set<string>();
      const lanes = new Map<string, string[]>();
      for (const p of team.participants) {
        if (p.puuid && puuids.has(p.puuid)) {
          console.error(
            '[validateGameLanes] duplicate puuid within team',
            { teamId: team.teamId, puuid: p.puuid });
        }
        puuids.add(p.puuid);

        if (p.lane) {
          if (!lanes.has(p.lane)) lanes.set(p.lane, []);
          lanes.get(p.lane)!.push(p.championName);
        }
      }
      for (const [lane, champs] of lanes) {
        if (champs.length > 1) {
          console.error(
            `[validateGameLanes] team ${team.teamId} has ${champs.length} champions assigned to ${lane}: ${champs.join(', ')}`);
        }
      }
    }
  }

  /**
   * Swap the `lane` fields of two participants (identified by puuid). Performs an
   * immutable update on the game signal so Angular re-renders the participant rows
   * in the new lane order. If either swapped champion was the currently selected one,
   * re-fetches its build recommendation with the new role.
   */
  /**
   * Swap the `lane` fields of two participants within a single team, identified by
   * championId (which is always unique within a team and never empty — unlike puuid,
   * which Riot ships empty for bot accounts). Uses array indices to replace exactly
   * two rows and leaves everyone else pointer-identical.
   *
   * Swap is permissive — it runs even if lanes are already identical or if the result
   * still has duplicate lanes (inherited from a buggy LaneAssigner state). Duplicate
   * states are logged as warnings for diagnostics but never block the user operation.
   */
  private swapLanes(championIdA: number, championIdB: number, teamId: number) {
    const currentGame = this.game();
    if (!currentGame) {
      console.warn('[swapLanes] no current game state — aborting');
      return;
    }

    const teamIndex = currentGame.teams.findIndex(t => t.teamId === teamId);
    if (teamIndex < 0) {
      console.warn('[swapLanes] team not found', { teamId });
      return;
    }
    const targetTeam = currentGame.teams[teamIndex];

    const idxA = targetTeam.participants.findIndex(p => p.championId === championIdA);
    const idxB = targetTeam.participants.findIndex(p => p.championId === championIdB);
    if (idxA < 0 || idxB < 0 || idxA === idxB) {
      console.warn('[swapLanes] invalid indices', { idxA, idxB, championIdA, championIdB });
      return;
    }

    const sourceA = targetTeam.participants[idxA];
    const sourceB = targetTeam.participants[idxB];

    console.debug('[swapLanes] swapping',
      { teamId, a: `${sourceA.championName}@${sourceA.lane}`, b: `${sourceB.championName}@${sourceB.lane}` });

    // Build the new participant array by SHALLOW-COPYING then replacing exactly two indices.
    const newParticipants: Participant[] = [...targetTeam.participants];
    newParticipants[idxA] = { ...sourceA, lane: sourceB.lane };
    newParticipants[idxB] = { ...sourceB, lane: sourceA.lane };

    // Diagnostic-only duplicate warning — does NOT block the operation. If the backend
    // already shipped a broken state (two champions on the same lane), swapping around
    // doesn't make it worse, and rejecting would leave the user stuck.
    const laneCounts = new Map<string, number>();
    for (const p of newParticipants) {
      if (!p.lane) continue;
      laneCounts.set(p.lane, (laneCounts.get(p.lane) ?? 0) + 1);
    }
    for (const [lane, count] of laneCounts) {
      if (count > 1) {
        console.warn(`[swapLanes] team ${teamId} still has ${count} champions on ${lane} after swap (inherited from backend)`);
      }
    }

    const newTeam: Team = { ...targetTeam, participants: newParticipants };
    const newTeams = [...currentGame.teams];
    newTeams[teamIndex] = newTeam;

    const updatedGame: ActiveGame = { ...currentGame, teams: newTeams };
    this.gameState.game.set(updatedGame);

    // If one of the swapped champions is currently selected, refetch its build with
    // the new lane. The backend's anomaly-detection fallback kicks in from there if
    // the new role has no historical data for this champion.
    const selId = this.selectedChampionId();
    if (selId === sourceA.championId) {
      this.selectChampion(newParticipants[idxA], newTeam);
    } else if (selId === sourceB.championId) {
      this.selectChampion(newParticipants[idxB], newTeam);
    }
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/Aatrox_0.jpg';
  }
}
