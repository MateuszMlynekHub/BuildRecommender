import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { Champion, LANE_ORDER, LaneRole } from '../../core/models/champion.model';
import { TPipe } from '../../shared/pipes/t.pipe';
import { TranslationKey } from '../../core/i18n/translations';

/**
 * Result of a single player after shuffling. Role and champion are both
 * optional — role only set when role-appropriate mode is on, champion only
 * set when random champions is on.
 */
interface ShuffledPlayer {
  name: string;
  role?: LaneRole;
  champion?: Champion;
}

/** Full shuffle output — two teams, each with up to 5 players. */
interface ShuffleResult {
  blueTeam: ShuffledPlayer[];
  redTeam: ShuffledPlayer[];
}

/**
 * Per-card metadata consumed by the shuffle animation. Drives CSS custom
 * properties that place the card at its final position:
 *   • idx        — deal order (controls animation-delay, cards pop out in
 *                  sequence 100 ms apart)
 *   • team       — which side the card ends on (-1 = blue left, +1 = red right
 *                  in the `--team-side` CSS var)
 *   • row        — normalized vertical slot centered around 0 so teams are
 *                  visually symmetric regardless of size (5 players → rows
 *                  -2..2, 4 → -1.5..1.5, 3 → -1..1, etc.)
 *
 * Names only — champion portraits + role badges appear in the static result
 * grid after the animation completes, not during. Keeps the animation tight
 * and readable even on small screens.
 */
interface AnimCard {
  name: string;
  team: 'blue' | 'red';
  row: number;
  idx: number;
}

/**
 * Team Shuffle — randomizes a list of player names into two teams (Blue/Red),
 * optionally assigning random champions and role-appropriate picks.
 *
 * How it works:
 *   1. User types up to 10 player names (2 minimum, with dynamic add/remove).
 *   2. Optionally toggles "Random champions" — assigns a unique champion to
 *      each player picked from Data Dragon's full catalog.
 *   3. Optionally toggles "Role-appropriate" (only usable with random champions
 *      on) — before picking a champion, each player in a team gets assigned
 *      a role in the canonical order [top, jg, mid, bot, sup], and the
 *      champion pool is filtered to champions that Meraki lists the matching
 *      lane in their Positions array.
 *   4. Click Shuffle → 1.2 s "shuffling" animation → results appear with a
 *      staggered slide-up for each player card.
 *
 * Dedupe logic: no champion is assigned twice across both teams (LoL rule —
 * the same champion can't appear on both sides in most modes). The code
 * tracks a per-shuffle `Set<number>` of used champion IDs and filters the
 * pool accordingly.
 */
@Component({
  selector: 'app-team-shuffle',
  standalone: true,
  imports: [FormsModule, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shuffle-page">
      <div class="shuffle-container">
        <!-- Hero -->
        <div class="shuffle-hero">
          <div class="shuffle-hero__icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="var(--lol-gold-3)">
              <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
          </div>
          <h1 class="shuffle-hero__title">{{ 'shuffle.title' | t }}</h1>
          <p class="shuffle-hero__subtitle">{{ 'shuffle.subtitle' | t }}</p>
        </div>

        <!--
          Shuffle stage — the dramatic animation overlay shown ONLY while the
          shuffle is running. Unmounts back to the input card + results grid
          once isShuffling flips false. Using @if rather than CSS visibility
          toggling ensures the CSS keyframe animations replay every shuffle
          cycle — the stage element is freshly constructed each time so
          animation-delay and keyframes restart from frame 0.
        -->
        @if (isShuffling()) {
          <div class="shuffle-stage" role="status" aria-live="polite">
            <!-- Corner ornaments — reuses the same .corner class from the
                 input card so the stage matches the app's glass-card frame
                 language. Stage has no solid border; the corners + gradient
                 background create a "floating frame" look. -->
            <div class="corner corner--tl"></div>
            <div class="corner corner--tr"></div>
            <div class="corner corner--bl"></div>
            <div class="corner corner--br"></div>

            <!--
              Hextech Crystal — Arcane-inspired animated centerpiece.

              Visual concept: glowing cyan crystal suspended inside a rotating
              gold hexagonal housing, crackling with energy. Matches the app
              palette (gold frame = LoL client UI chrome, cyan crystal = the
              hextech inner light + the app's own --lol-cyan accent color).

              Layered structure (back to front, each animates independently):
                1. hex-frame    — double hexagonal gold ring with corner bolts,
                                  slow clockwise rotation (16 s linear)
                2. hex-prongs   — 6 static gold clamps pointing inward from
                                  frame corners, visually "holding" the crystal
                3. glow backdrop — blurred cyan rhombus, tinting the area
                                  behind the crystal
                4. hex-crystal  — main cyan diamond with facet lines + inner
                                  highlight, pulsing scale + brightness (1.4 s)
                5. hex-particles — 6 tiny cyan dots orbiting counter-clockwise
                                  around the crystal (4 s)
                6. hex-lightning — 4 zigzag bolts flickering on staggered
                                  intervals, looks like continuous magical
                                  crackling

              Why CSS on SVG <g>: CSS animations on SVG group elements work
              reliably when transform-box: fill-box is set so transform-origin
              resolves to the group's own center, not the SVG viewBox origin.
            -->
            <svg
              class="shuffle-stage__hextech"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-80 -80 160 160"
              aria-hidden="true"
            >
              <defs>
                <!-- Cyan crystal fill: hot white center → pale cyan → deep teal edge -->
                <radialGradient id="hex-crystal-grad" cx="40%" cy="30%" r="70%">
                  <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="1" />
                  <stop offset="18%"  stop-color="#E0FBFC" stop-opacity="1" />
                  <stop offset="45%"  stop-color="#7FF9FF" stop-opacity="0.95" />
                  <stop offset="75%"  stop-color="#0AC8B9" stop-opacity="0.9" />
                  <stop offset="100%" stop-color="#005A82" stop-opacity="0.85" />
                </radialGradient>
                <!-- Soft blur for the halo backdrop behind the crystal -->
                <filter id="hex-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" />
                </filter>
              </defs>

              <!-- Outer hex frame — double border for ornate metalwork feel,
                   slow clockwise rotation, 6 decorative bolts at the corners. -->
              <g class="hex-frame">
                <polygon
                  points="0,-62 54,-31 54,31 0,62 -54,31 -54,-31"
                  fill="none"
                  stroke="var(--lol-gold-3)"
                  stroke-width="2"
                  stroke-linejoin="miter"
                />
                <polygon
                  points="0,-55 48,-27.5 48,27.5 0,55 -48,27.5 -48,-27.5"
                  fill="none"
                  stroke="var(--lol-gold-4)"
                  stroke-width="0.8"
                />
                <g fill="var(--lol-gold-2)">
                  <circle cx="0"   cy="-62" r="2.6" />
                  <circle cx="54"  cy="-31" r="2.6" />
                  <circle cx="54"  cy="31"  r="2.6" />
                  <circle cx="0"   cy="62"  r="2.6" />
                  <circle cx="-54" cy="31"  r="2.6" />
                  <circle cx="-54" cy="-31" r="2.6" />
                </g>
              </g>

              <!-- Prongs holding the crystal — 6 short gold lines pointing
                   inward from the hex frame corners toward the crystal.
                   Static (don't rotate with frame) so they always point at
                   the crystal's stable center position. -->
              <g class="hex-prongs" stroke="var(--lol-gold-2)" stroke-width="2.5" stroke-linecap="round">
                <line x1="0"   y1="-48"   x2="0"   y2="-34" />
                <line x1="42"  y1="-24"   x2="29"  y2="-17" />
                <line x1="42"  y1="24"    x2="29"  y2="17" />
                <line x1="0"   y1="48"    x2="0"   y2="34" />
                <line x1="-42" y1="24"    x2="-29" y2="17" />
                <line x1="-42" y1="-24"   x2="-29" y2="-17" />
              </g>

              <!-- Soft cyan glow backdrop — blurred, sits behind the crystal
                   to give the whole centerpiece an atmospheric halo. -->
              <polygon
                points="0,-38 32,0 0,38 -32,0"
                fill="var(--lol-cyan)"
                opacity="0.5"
                filter="url(#hex-glow)"
              />

              <!-- Hextech crystal core — cyan rhombus with facet lines for
                   crystalline 3D appearance, pulsing in place. -->
              <g class="hex-crystal">
                <!-- Main crystal body with radial gradient fill -->
                <polygon
                  points="0,-32 26,0 0,32 -26,0"
                  fill="url(#hex-crystal-grad)"
                  stroke="#7FF9FF"
                  stroke-width="1.2"
                />
                <!-- Vertical + horizontal facet lines (subtle depth cues) -->
                <line x1="0" y1="-32" x2="0" y2="32" stroke="rgba(255,255,255,0.35)" stroke-width="0.6" />
                <line x1="-26" y1="0" x2="26" y2="0" stroke="rgba(255,255,255,0.25)" stroke-width="0.5" />
                <!-- Diagonal edge highlights for 3D faceted look -->
                <line x1="0" y1="-32" x2="26" y2="0"  stroke="rgba(255,255,255,0.55)" stroke-width="0.8" />
                <line x1="0" y1="-32" x2="-26" y2="0" stroke="rgba(255,255,255,0.4)"  stroke-width="0.6" />
                <!-- Inner bright highlight — white shard showing light refraction -->
                <polygon
                  points="-3,-18 10,-2 6,10 -8,-4"
                  fill="#FFFFFF"
                  opacity="0.7"
                />
              </g>

              <!-- Orbiting cyan particles — 6 small dots rotating counter-
                   clockwise around the whole centerpiece, like energy motes. -->
              <g class="hex-particles" fill="#7FF9FF">
                <circle cx="0"   cy="-42" r="1.8" />
                <circle cx="36"  cy="-8"  r="1.3" />
                <circle cx="30"  cy="25"  r="1.6" />
                <circle cx="-8"  cy="42"  r="1.4" />
                <circle cx="-36" cy="15"  r="1.5" />
                <circle cx="-28" cy="-30" r="1.3" />
              </g>

              <!-- Lightning bolts — 4 zigzag paths shooting outward from the
                   crystal's cardinal points. Each flickers on a staggered
                   animation-delay so together they create continuous magical
                   crackling rather than a single synchronized blink. -->
              <g class="hex-lightning" stroke="#7FF9FF" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path class="hex-lightning__bolt hex-lightning__bolt--1" d="M 0,-32 L 4,-40 L -3,-45 L 1,-52" />
                <path class="hex-lightning__bolt hex-lightning__bolt--2" d="M 26,0 L 35,-5 L 42,4 L 49,-2" />
                <path class="hex-lightning__bolt hex-lightning__bolt--3" d="M 0,32 L -4,40 L 3,46 L -1,52" />
                <path class="hex-lightning__bolt hex-lightning__bolt--4" d="M -26,0 L -36,5 L -43,-4 L -50,3" />
              </g>
            </svg>

            <div class="shuffle-stage__label">
              {{ 'shuffle.deciding' | t }}
            </div>

            @for (card of animatingCards(); track card.idx) {
              <div
                class="dealt-card"
                [class.dealt-card--blue]="card.team === 'blue'"
                [class.dealt-card--red]="card.team === 'red'"
                [style.--idx]="card.idx"
                [style.--team-side]="card.team === 'blue' ? -1 : 1"
                [style.--team-row]="card.row"
              >
                {{ card.name }}
              </div>
            }
          </div>
        } @else {
        <!-- Player list card -->
        <div class="glass-card shuffle-card">
          <!-- Decorative corner ornaments — matches home form aesthetic -->
          <div class="corner corner--tl"></div>
          <div class="corner corner--tr"></div>
          <div class="corner corner--bl"></div>
          <div class="corner corner--br"></div>

          <div class="player-list">
            @for (name of players(); track $index; let idx = $index) {
              <div class="player-row">
                <span class="player-row__number">{{ idx + 1 }}</span>
                <input
                  type="text"
                  class="player-row__input"
                  [ngModel]="name"
                  (ngModelChange)="updatePlayer(idx, $event)"
                  [placeholder]="playerPlaceholder(idx + 1)"
                  [disabled]="isShuffling()"
                  maxlength="24"
                  (keyup.enter)="onPlayerEnter(idx)"
                />
                @if (players().length > MIN_PLAYERS) {
                  <button
                    type="button"
                    class="player-row__remove"
                    (click)="removePlayer(idx)"
                    [disabled]="isShuffling()"
                    [attr.aria-label]="'shuffle.removePlayer' | t"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                }
              </div>
            }

            @if (players().length < MAX_PLAYERS) {
              <button
                type="button"
                class="add-player-btn"
                (click)="addPlayer()"
                [disabled]="isShuffling()"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                {{ 'shuffle.addPlayer' | t }}
              </button>
            }
          </div>

          <!-- Options -->
          <div class="shuffle-options">
            <label class="shuffle-option">
              <input
                type="checkbox"
                [checked]="randomChampions()"
                (change)="toggleRandomChampions()"
                [disabled]="isShuffling()"
              />
              <span class="shuffle-option__box" aria-hidden="true"></span>
              <span class="shuffle-option__label">{{ 'shuffle.options.randomChampions' | t }}</span>
            </label>

            <label class="shuffle-option">
              <input
                type="checkbox"
                [checked]="randomRoles()"
                (change)="toggleRandomRoles()"
                [disabled]="isShuffling()"
              />
              <span class="shuffle-option__box" aria-hidden="true"></span>
              <span class="shuffle-option__label">{{ 'shuffle.options.randomRoles' | t }}</span>
            </label>

            <label class="shuffle-option" [class.shuffle-option--disabled]="!randomChampions()">
              <input
                type="checkbox"
                [checked]="roleAppropriate()"
                (change)="toggleRoleAppropriate()"
                [disabled]="!randomChampions() || isShuffling()"
              />
              <span class="shuffle-option__box" aria-hidden="true"></span>
              <span class="shuffle-option__label">{{ 'shuffle.options.roleAppropriate' | t }}</span>
            </label>
          </div>

          <!-- Shuffle button -->
          <button
            type="button"
            class="btn-gold shuffle-btn"
            (click)="shuffle()"
            [disabled]="!canShuffle() || isShuffling()"
          >
            @if (isShuffling()) {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="animate-spin">
                <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
              </svg>
              <span>{{ 'shuffle.shuffling' | t }}</span>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
              <span>{{ 'shuffle.shuffleButton' | t }}</span>
            }
          </button>

          @if (needMorePlayers()) {
            <div class="shuffle-hint">{{ 'shuffle.needMorePlayers' | t }}</div>
          }
        </div>

        <!-- Results -->
        @if (result(); as r) {
          <div class="shuffle-results">
            <div class="team team--blue">
              <h2 class="team__title">{{ 'shuffle.blueTeam' | t }}</h2>
              <div class="team__roster">
                @for (player of r.blueTeam; track $index; let idx = $index) {
                  <div
                    class="player-card"
                    [style.animation-delay]="(idx * 60) + 'ms'"
                  >
                    @if (player.champion) {
                      <img
                        class="player-card__portrait"
                        [src]="gameState.getChampionImageUrl(player.champion.imageFileName)"
                        [alt]="player.champion.name"
                        loading="lazy"
                      />
                    } @else {
                      <div class="player-card__portrait player-card__portrait--empty">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="var(--lol-gold-4)">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                    }
                    <div class="player-card__info">
                      <div class="player-card__name-row">
                        @if (player.role) {
                          <div class="player-card__role-icon" [attr.title]="roleLabel(player.role) | t">
                            @switch (player.role) {
                              @case ('TOP') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/>
                                  <polygon fill="#c8aa6e" points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>
                                </svg>
                              }
                              @case ('JUNGLE') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path fill="#c8aa6e" fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>
                                </svg>
                              }
                              @case ('MIDDLE') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/>
                                  <polygon fill="#c8aa6e" points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>
                                </svg>
                              }
                              @case ('BOTTOM') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/>
                                  <polygon fill="#c8aa6e" points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>
                                </svg>
                              }
                              @case ('UTILITY') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path fill="#c8aa6e" fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>
                                </svg>
                              }
                            }
                          </div>
                        }
                        <div class="player-card__name">{{ player.name }}</div>
                      </div>
                      @if (player.champion) {
                        <div class="player-card__champion">{{ player.champion.name }}</div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="team team--red">
              <h2 class="team__title">{{ 'shuffle.redTeam' | t }}</h2>
              <div class="team__roster">
                @for (player of r.redTeam; track $index; let idx = $index) {
                  <div
                    class="player-card"
                    [style.animation-delay]="((idx + r.blueTeam.length) * 60) + 'ms'"
                  >
                    @if (player.champion) {
                      <img
                        class="player-card__portrait"
                        [src]="gameState.getChampionImageUrl(player.champion.imageFileName)"
                        [alt]="player.champion.name"
                        loading="lazy"
                      />
                    } @else {
                      <div class="player-card__portrait player-card__portrait--empty">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="var(--lol-gold-4)">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                    }
                    <div class="player-card__info">
                      <div class="player-card__name-row">
                        @if (player.role) {
                          <div class="player-card__role-icon" [attr.title]="roleLabel(player.role) | t">
                            @switch (player.role) {
                              @case ('TOP') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/>
                                  <polygon fill="#c8aa6e" points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>
                                </svg>
                              }
                              @case ('JUNGLE') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path fill="#c8aa6e" fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>
                                </svg>
                              }
                              @case ('MIDDLE') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/>
                                  <polygon fill="#c8aa6e" points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>
                                </svg>
                              }
                              @case ('BOTTOM') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path opacity="0.5" fill="#785a28" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/>
                                  <polygon fill="#c8aa6e" points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>
                                </svg>
                              }
                              @case ('UTILITY') {
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="20" height="20">
                                  <path fill="#c8aa6e" fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>
                                </svg>
                              }
                            }
                          </div>
                        }
                        <div class="player-card__name">{{ player.name }}</div>
                      </div>
                      @if (player.champion) {
                        <div class="player-card__champion">{{ player.champion.name }}</div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <button type="button" class="btn-outline shuffle-again-btn" (click)="shuffle()" [disabled]="isShuffling()">
            {{ 'shuffle.shuffleAgain' | t }}
          </button>
        }
        }
      </div>
    </div>
  `,
  styles: [`
    .shuffle-page {
      min-height: 100vh;
      padding: 2rem 1rem 3rem;
      position: relative;
      overflow: hidden;
    }

    .shuffle-page::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background:
        radial-gradient(circle at 20% 10%, rgba(200,155,60,0.06), transparent 40%),
        radial-gradient(circle at 80% 90%, rgba(10,200,185,0.05), transparent 40%),
        var(--lol-void);
    }

    .shuffle-container {
      max-width: 960px;
      margin: 0 auto;
    }

    /* Hero — matches home component's hero styling for consistency */
    .shuffle-hero {
      text-align: center;
      margin-bottom: 2.5rem;
      animation: shuffle-fade-in 0.5s ease-out;
    }
    .shuffle-hero__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 5rem;
      height: 5rem;
      margin-bottom: 1rem;
      border-radius: 50%;
      border: 1px solid var(--lol-gold-3);
      background: radial-gradient(circle, rgba(200,155,60,0.25), transparent 70%);
      box-shadow: 0 0 24px rgba(200,155,60,0.3);
    }
    .shuffle-hero__title {
      font-family: 'Cinzel', serif;
      font-size: clamp(2rem, 5vw, 3rem);
      color: var(--lol-gold-1);
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .shuffle-hero__subtitle {
      color: var(--lol-text-muted);
      font-size: 0.9rem;
      letter-spacing: 0.02em;
    }

    /* Input card — glass card with corner ornaments */
    .shuffle-card {
      position: relative;
      padding: 2rem;
      background: rgba(1,10,19,0.6);
      border: 1px solid var(--lol-gold-5);
      border-radius: 2px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    }
    .corner {
      position: absolute;
      width: 2rem;
      height: 2rem;
      pointer-events: none;
    }
    .corner--tl { top: 0; left: 0; border-top: 2px solid var(--lol-gold-3); border-left: 2px solid var(--lol-gold-3); }
    .corner--tr { top: 0; right: 0; border-top: 2px solid var(--lol-gold-3); border-right: 2px solid var(--lol-gold-3); }
    .corner--bl { bottom: 0; left: 0; border-bottom: 2px solid var(--lol-gold-3); border-left: 2px solid var(--lol-gold-3); }
    .corner--br { bottom: 0; right: 0; border-bottom: 2px solid var(--lol-gold-3); border-right: 2px solid var(--lol-gold-3); }

    /* Player list */
    .player-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-bottom: 1.5rem;
    }
    .player-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .player-row__number {
      width: 1.75rem;
      height: 1.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: 'Cinzel', serif;
      font-size: 0.75rem;
      color: var(--lol-gold-2);
      border: 1px solid var(--lol-gold-5);
      border-radius: 50%;
      flex-shrink: 0;
    }
    .player-row__input {
      flex: 1;
      padding: 0.65rem 0.85rem;
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      color: var(--lol-gold-1);
      background: rgba(1,10,19,0.7);
      border: 1px solid var(--lol-gold-5);
      border-radius: 2px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .player-row__input:focus {
      outline: none;
      border-color: var(--lol-gold-3);
      box-shadow: 0 0 0 1px var(--lol-gold-3), 0 0 12px rgba(200,155,60,0.2);
    }
    .player-row__input::placeholder {
      color: var(--lol-text-dim);
    }
    .player-row__input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .player-row__remove {
      width: 1.75rem;
      height: 1.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--lol-text-muted);
      background: transparent;
      border: 1px solid transparent;
      border-radius: 2px;
      cursor: pointer;
      transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
      flex-shrink: 0;
    }
    .player-row__remove:hover:not(:disabled) {
      color: var(--lol-red);
      border-color: var(--lol-red-2);
      background: rgba(232,64,87,0.08);
    }

    .add-player-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1rem;
      margin-top: 0.25rem;
      font-family: 'Cinzel', serif;
      font-size: 0.7rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--lol-gold-2);
      background: transparent;
      border: 1px dashed var(--lol-gold-5);
      border-radius: 2px;
      cursor: pointer;
      transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
      align-self: flex-start;
    }
    .add-player-btn:hover:not(:disabled) {
      color: var(--lol-gold-1);
      border-color: var(--lol-gold-3);
      background: rgba(200,155,60,0.06);
    }
    .add-player-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Options — custom checkboxes styled to match */
    .shuffle-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.25rem 0;
      margin-bottom: 1.25rem;
      border-top: 1px solid var(--lol-gold-5);
      border-bottom: 1px solid var(--lol-gold-5);
    }
    .shuffle-option {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      user-select: none;
    }
    .shuffle-option--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .shuffle-option input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .shuffle-option__box {
      width: 1.1rem;
      height: 1.1rem;
      border: 1px solid var(--lol-gold-4);
      border-radius: 2px;
      background: rgba(1,10,19,0.7);
      flex-shrink: 0;
      position: relative;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .shuffle-option input[type="checkbox"]:checked + .shuffle-option__box {
      background: linear-gradient(180deg, var(--lol-gold-3), var(--lol-gold-4));
      border-color: var(--lol-gold-3);
    }
    .shuffle-option input[type="checkbox"]:checked + .shuffle-option__box::after {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23010A13'%3E%3Cpath d='M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E") no-repeat center / 90%;
    }
    .shuffle-option input[type="checkbox"]:focus-visible + .shuffle-option__box {
      box-shadow: 0 0 0 2px var(--lol-cyan);
    }
    .shuffle-option__label {
      font-size: 0.85rem;
      color: var(--lol-gold-1);
      letter-spacing: 0.02em;
    }

    /* Shuffle button — use the existing btn-gold style from global */
    .shuffle-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }

    .shuffle-hint {
      margin-top: 0.75rem;
      padding: 0.6rem 0.8rem;
      border-radius: 2px;
      background: rgba(232,64,87,0.08);
      border: 1px solid var(--lol-red-2);
      color: #FCA5A5;
      font-size: 0.78rem;
      text-align: center;
    }

    /* Results — two columns */
    .shuffle-results {
      margin-top: 2.5rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }
    @media (max-width: 720px) {
      .shuffle-results {
        grid-template-columns: 1fr;
      }
    }

    .team {
      padding: 1rem;
      border-radius: 2px;
      background: rgba(1,10,19,0.6);
      border: 1px solid;
    }
    .team--blue {
      border-color: var(--lol-blue-team);
      box-shadow: 0 0 24px rgba(74,144,226,0.15);
      background: linear-gradient(180deg, rgba(74,144,226,0.08), rgba(1,10,19,0.6) 60%);
    }
    .team--red {
      border-color: var(--lol-red);
      box-shadow: 0 0 24px rgba(232,64,87,0.15);
      background: linear-gradient(180deg, rgba(232,64,87,0.08), rgba(1,10,19,0.6) 60%);
    }
    .team__title {
      font-family: 'Cinzel', serif;
      font-size: 0.9rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 1rem;
      padding-bottom: 0.6rem;
      border-bottom: 1px solid var(--lol-gold-5);
    }
    .team--blue .team__title { color: var(--lol-blue-team); }
    .team--red .team__title { color: var(--lol-red); }
    .team__roster {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    /* Player result cards */
    .player-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem;
      background: rgba(1,10,19,0.55);
      border: 1px solid var(--lol-gold-5);
      border-radius: 2px;
      opacity: 0;
      animation: player-card-slide 0.4s ease-out forwards;
    }
    @keyframes player-card-slide {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    .player-card__portrait {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border: 1px solid var(--lol-gold-4);
      border-radius: 2px;
      flex-shrink: 0;
    }
    .player-card__portrait--empty {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(200,155,60,0.08);
    }
    .player-card__info {
      flex: 1;
      min-width: 0;
    }
    .player-card__name-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .player-card__role-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      opacity: 0.85;
    }
    .player-card__role-icon svg {
      display: block;
    }
    .player-card__name {
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--lol-gold-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .player-card__champion {
      margin-top: 0.2rem;
      font-size: 0.72rem;
      color: var(--lol-text-muted);
    }

    .shuffle-again-btn {
      display: block;
      margin: 2rem auto 0;
      min-width: 180px;
    }

    @keyframes shuffle-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate-spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* =========================================================================
       Shuffle stage — animation overlay shown only while isShuffling() is true.
       =========================================================================
       Layout: relative positioned container framed by gold corner ornaments
       (reusing the glass-card .corner--* classes from above) with a subtle
       inset gold glow + radial gradient backdrop so it visually echoes the
       input form card without being a hard-bordered box.

       Centerpiece is a multi-layered SVG sigil (Summoner's Sigil) with
       rotating hex rings and a pulsing crystal core — replaces the naked
       gold orb so the animation feels like it belongs in a LoL-themed app.

       CSS custom properties for responsive dealing:
         --deal-x         : horizontal offset of final team column from center
         --deal-y-spacing : vertical gap between player cards within a team

       Cards read their individual --idx (deal order), --team-side (±1 for
       left/right), and --team-row (normalized slot number) from inline style
       bindings and use those inside @keyframes deal to compute their end
       transform. Browser support: Chrome 85+, Firefox 79+, Safari 14.1+.
    */
    .shuffle-stage {
      position: relative;
      min-height: 540px;
      margin: 1rem 0 2rem;
      padding: 2.5rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      /* Subtle radial gold wash from the centerpiece + vertical darkening
         toward the edges. No solid border — the corner ornaments carry the
         frame visual. Inset shadow ties the surface together. */
      background:
        radial-gradient(ellipse at center, rgba(200, 155, 60, 0.09) 0%, transparent 55%),
        linear-gradient(180deg, rgba(1, 10, 19, 0.35) 0%, rgba(1, 10, 19, 0.75) 100%);
      box-shadow:
        inset 0 0 100px rgba(200, 155, 60, 0.06),
        inset 0 0 40px rgba(10, 200, 185, 0.04);
      animation: stage-fade-in 0.35s ease-out;
      /* Responsive deal-out distance. Desktop needs wider spread so cards
         don't overlap; mobile uses a tighter layout. */
      --deal-x: 220px;
      --deal-y-spacing: 62px;
    }

    /* Scope the shared .corner--* ornaments to the stage so they're bigger
       and thicker than on the input card — the stage is ~3x the size and
       small corners would look lost on it. */
    .shuffle-stage > .corner {
      width: 3rem;
      height: 3rem;
      z-index: 0;
    }
    .shuffle-stage > .corner--tl { border-top-width: 2px; border-left-width: 2px; }
    .shuffle-stage > .corner--tr { border-top-width: 2px; border-right-width: 2px; }
    .shuffle-stage > .corner--bl { border-bottom-width: 2px; border-left-width: 2px; }
    .shuffle-stage > .corner--br { border-bottom-width: 2px; border-right-width: 2px; }

    @media (max-width: 640px) {
      .shuffle-stage {
        min-height: 470px;
        padding: 1.75rem 0.75rem;
        --deal-x: 115px;
        --deal-y-spacing: 52px;
      }
      .shuffle-stage > .corner {
        width: 2rem;
        height: 2rem;
      }
    }

    @keyframes stage-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* =========================================================================
       Hextech Crystal — Arcane-inspired SVG centerpiece.
       =========================================================================
       Four independently-animated layers:
         • .hex-frame     — outer gold hex ring rotating clockwise (16 s loop)
         • .hex-crystal   — central cyan rhombus pulsing scale + brightness
         • .hex-particles — 6 cyan dots orbiting counter-clockwise (4 s loop)
         • .hex-lightning__bolt--N — 4 zigzag paths flickering on staggered
                                     delays for continuous magical crackling

       All CSS animations use transform-box: fill-box + transform-origin:
       center so rotations happen around each group's own center rather than
       the SVG viewBox origin. This is the canonical pattern for animating
       SVG groups with CSS transforms.

       Drop-shadow stack combines cyan (inner hextech glow) and gold (outer
       ambient aura matching the app palette). Uses drop-shadow not
       box-shadow so the glow hugs the actual filled pixels of the crystal
       and frame, not their bounding rectangles.
    */
    .shuffle-stage__hextech {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 200px;
      height: 200px;
      margin: -100px 0 0 -100px;
      filter:
        drop-shadow(0 0 16px rgba(10, 200, 185, 0.55))
        drop-shadow(0 0 32px rgba(200, 155, 60, 0.35))
        drop-shadow(0 0 64px rgba(10, 200, 185, 0.2));
      pointer-events: none;
      z-index: 1;
      animation: hextech-appear 0.7s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    }

    @keyframes hextech-appear {
      0% {
        opacity: 0;
        transform: scale(0.35) rotate(-45deg);
      }
      100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
    }

    /* Outer gold frame rotates slowly clockwise — long duration so it feels
       majestic rather than frantic. */
    .hex-frame {
      transform-box: fill-box;
      transform-origin: center;
      animation: hex-frame-rotate 16s linear infinite;
    }

    @keyframes hex-frame-rotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* Crystal pulses scale and brightness together — "heartbeat" of the gem,
       fast enough (1.4 s) to feel alive without being distracting. */
    .hex-crystal {
      transform-box: fill-box;
      transform-origin: center;
      animation: hex-crystal-pulse 1.4s ease-in-out infinite;
    }

    @keyframes hex-crystal-pulse {
      0%, 100% {
        transform: scale(1);
        filter: brightness(1);
      }
      50% {
        transform: scale(1.1);
        filter: brightness(1.45);
      }
    }

    /* Energy motes orbiting counter-clockwise — opposite direction from the
       frame for visual contrast (both spinning the same way would look like
       the whole centerpiece is drifting). */
    .hex-particles {
      transform-box: fill-box;
      transform-origin: center;
      animation: hex-particles-orbit 4s linear infinite;
    }

    @keyframes hex-particles-orbit {
      from { transform: rotate(0deg); }
      to   { transform: rotate(-360deg); }
    }

    /* Lightning bolts flicker on staggered delays so together they look
       like constant crackling rather than synchronized blinking. Each bolt
       spends most of the cycle hidden (opacity 0) with brief bright flashes
       at ~85-94% of the cycle. Brightness filter amps the spark intensity. */
    .hex-lightning__bolt {
      opacity: 0;
      animation: hex-bolt-flicker 2.2s ease-in-out infinite;
    }
    .hex-lightning__bolt--1 { animation-delay: 0s;    }
    .hex-lightning__bolt--2 { animation-delay: 0.55s; }
    .hex-lightning__bolt--3 { animation-delay: 1.1s;  }
    .hex-lightning__bolt--4 { animation-delay: 1.65s; }

    @keyframes hex-bolt-flicker {
      0%, 82%, 100% { opacity: 0; filter: brightness(1); }
      85%           { opacity: 0.95; filter: brightness(1.9); }
      88%           { opacity: 0.3;  filter: brightness(1.3); }
      91%           { opacity: 1;    filter: brightness(2.2); }
      94%           { opacity: 0.5;  filter: brightness(1.4); }
      96%           { opacity: 0;    filter: brightness(1); }
    }

    /* Label below the sigil — Cinzel gold text with subtle pulse synced to
       the core crystal. Decorative diamond glyph before and after mimics the
       gold-divider style used on the home hero. */
    .shuffle-stage__label {
      position: absolute;
      top: calc(50% + 120px);
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Cinzel', serif;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--lol-gold-1);
      text-shadow:
        0 0 16px var(--lol-gold-3),
        0 0 32px rgba(200, 155, 60, 0.5);
      animation: label-pulse 1.2s ease-in-out infinite;
      white-space: nowrap;
      z-index: 2;
    }

    .shuffle-stage__label::before,
    .shuffle-stage__label::after {
      content: '◆';
      color: var(--lol-gold-3);
      font-size: 0.7rem;
      opacity: 0.8;
    }

    @keyframes label-pulse {
      0%, 100% { opacity: 0.75; }
      50%      { opacity: 1; }
    }

    /* Individual dealt card — player name flying out from center to its
       final team position. Each card reads its position from CSS variables
       set in the template, so all cards share a single @keyframes rule.

       Visual language matches the glass-card inputs: dark translucent
       background + gold border + inset highlight for dimensional depth. */
    .dealt-card {
      position: absolute;
      top: 50%;
      left: 50%;
      min-width: 130px;
      padding: 0.7rem 1.1rem;
      background:
        linear-gradient(180deg, rgba(200, 155, 60, 0.08) 0%, transparent 50%),
        rgba(1, 10, 19, 0.92);
      border: 1px solid var(--lol-gold-3);
      color: var(--lol-gold-1);
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 0.85rem;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-radius: 2px;
      /* Layered shadows: outer glow for drama, inset highlight for glass
         effect, subtle drop for separation from stage background. */
      box-shadow:
        0 4px 16px rgba(200, 155, 60, 0.35),
        inset 0 1px 0 rgba(255, 240, 200, 0.1);
      /* Start invisible at center; @keyframes deal moves us out. */
      opacity: 0;
      transform: translate(-50%, -50%) scale(0);
      animation: card-deal 1.2s cubic-bezier(0.2, 0.85, 0.2, 1.05) forwards;
      /* Stagger between consecutive cards — each card delayed 100 ms after
         the previous so the deal feels like a sequence, not a simultaneous
         explosion. */
      animation-delay: calc(var(--idx, 0) * 100ms);
      z-index: 3;
    }

    /* Team-specific glow — cards inherit the color of the side they're
       heading to, even during the animation, so users can visually track
       "this one's going left (blue), that one's going right (red)". The
       gold inset highlight is preserved from the base style so team-colored
       cards still feel like part of the app's gold-accented design system. */
    .dealt-card--blue {
      border-color: var(--lol-blue-team);
      background:
        linear-gradient(180deg, rgba(74, 144, 226, 0.18) 0%, transparent 55%),
        rgba(1, 10, 19, 0.92);
      box-shadow:
        0 4px 20px rgba(74, 144, 226, 0.5),
        0 0 30px rgba(74, 144, 226, 0.25),
        inset 0 1px 0 rgba(180, 210, 255, 0.2);
    }
    .dealt-card--red {
      border-color: var(--lol-red);
      background:
        linear-gradient(180deg, rgba(232, 64, 87, 0.18) 0%, transparent 55%),
        rgba(1, 10, 19, 0.92);
      box-shadow:
        0 4px 20px rgba(232, 64, 87, 0.5),
        0 0 30px rgba(232, 64, 87, 0.25),
        inset 0 1px 0 rgba(255, 180, 195, 0.2);
    }

    /* Four-keyframe deal curve:
       0%   — invisible pin-point at center, pre-rotated by 180° toward the
              team side (negative for blue, positive for red). Creates the
              "spinning as it emerges" effect.
       22%  — pops into view at center scale-overshoot 1.25, halfway through
              the rotation. This is the "card revealed" moment.
       65%  — traveling outward, ~66% of the way to the final x. Rotation
              fully settled.
       100% — final resting position at full team spread (--deal-x on the
              side direction, --team-row × --deal-y-spacing vertically).
              Back to scale 1.
    */
    @keyframes card-deal {
      0% {
        opacity: 0;
        transform:
          translate(-50%, -50%)
          scale(0)
          rotate(calc(var(--team-side) * -180deg));
      }
      22% {
        opacity: 1;
        transform:
          translate(-50%, -50%)
          scale(1.25)
          rotate(calc(var(--team-side) * -60deg));
      }
      65% {
        opacity: 1;
        transform:
          translate(
            calc(-50% + var(--team-side) * var(--deal-x) * 0.7),
            calc(-50% + var(--team-row) * var(--deal-y-spacing))
          )
          scale(1.05)
          rotate(0deg);
      }
      100% {
        opacity: 1;
        transform:
          translate(
            calc(-50% + var(--team-side) * var(--deal-x)),
            calc(-50% + var(--team-row) * var(--deal-y-spacing))
          )
          scale(1)
          rotate(0deg);
      }
    }
  `],
})
export class TeamShuffleComponent implements OnInit {
  readonly MIN_PLAYERS = 2;
  readonly MAX_PLAYERS = 10;

  private api = inject(ApiService);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);

  /** Live list of player name inputs. Starts with 4 empty slots (2v2). */
  readonly players = signal<string[]>(['', '', '', '']);

  /** Toggle: assign a random champion to each shuffled player. */
  readonly randomChampions = signal(false);

  /** Toggle: randomly assign a lane role (TOP/JG/MID/BOT/SUP) to each player. */
  readonly randomRoles = signal(false);

  /** Toggle: filter random champions by the player's assigned role. */
  readonly roleAppropriate = signal(false);

  /** True while the shuffle animation / fake delay is running. */
  readonly isShuffling = signal(false);

  /**
   * Cards currently being animated on the shuffle stage. Empty when idle.
   * Populated immediately before the ~2.4 s dealing animation starts, cleared
   * when the animation ends and `result` takes over. Each card's CSS
   * custom properties (--idx, --team-side, --team-row) drive its individual
   * animation-delay and final position.
   */
  readonly animatingCards = signal<AnimCard[]>([]);

  /** Latest shuffle output. Null until the user first clicks Shuffle. */
  readonly result = signal<ShuffleResult | null>(null);

  /** Cached champion list — fetched once via the ApiService shareReplay. */
  private readonly championsCache = signal<Champion[]>([]);

  /**
   * Derived: true when at least MIN_PLAYERS valid (non-empty) names are
   * entered. Controls the shuffle button's disabled state.
   */
  readonly canShuffle = computed(() => this.validNames().length >= this.MIN_PLAYERS);

  /**
   * Derived: true when the user has typed fewer than MIN_PLAYERS names.
   * Drives the inline hint below the shuffle button.
   */
  readonly needMorePlayers = computed(
    () => !this.canShuffle() && this.players().some((n) => n.trim().length > 0),
  );

  /**
   * True only in a real browser — false during server-side prerender so
   * API fetches don't fire against a backend that isn't reachable at
   * build time (prerender crashed with "Http failure response for
   * http://ng-localhost/api/data/version: 0 undefined" until we started
   * guarding fetches like this).
   */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
    this.seo.updatePageMeta({
      title: 'Team Shuffle — DraftSense',
      description: 'Randomly split up to 10 players into Blue and Red teams, with optional random champion assignment and role-appropriate picks. Perfect for custom lobbies and internal scrims.',
      url: 'https://draftsense.net/shuffle',
    });

    if (!this.isBrowser) return;

    // Fetch the LoL patch version so champion portraits resolve to the right
    // Data Dragon CDN path. Cheap — returns a 10-byte string — and only runs
    // if not already populated by an earlier visit to the home page.
    if (this.gameState.ddragonVersion() === '14.24.1') {
      this.api.getVersion().subscribe({
        next: (v) => this.gameState.ddragonVersion.set(v.replace(/"/g, '')),
        // Errors are non-fatal — falls back to the hardcoded default.
      });
    }
  }

  // ─── Player list mutators ──────────────────────────────────────────────

  updatePlayer(index: number, value: string): void {
    const next = [...this.players()];
    next[index] = value;
    this.players.set(next);
  }

  addPlayer(): void {
    if (this.players().length >= this.MAX_PLAYERS) return;
    this.players.set([...this.players(), '']);
  }

  removePlayer(index: number): void {
    if (this.players().length <= this.MIN_PLAYERS) return;
    this.players.set(this.players().filter((_, i) => i !== index));
  }

  /**
   * Pressing Enter on the last input auto-adds another row (unless at max).
   * Pressing Enter on any other row jumps focus to the next input — but that
   * requires DOM access which adds complexity; skipping for now and just
   * handling "add player on enter at last row" as the main convenience.
   */
  onPlayerEnter(index: number): void {
    if (index === this.players().length - 1 && this.players().length < this.MAX_PLAYERS) {
      this.addPlayer();
    }
  }

  // ─── Option toggles ────────────────────────────────────────────────────

  toggleRandomChampions(): void {
    const newValue = !this.randomChampions();
    this.randomChampions.set(newValue);
    // Turning off random champions forces role-appropriate off too, since
    // role filtering without a champion to pick makes no sense.
    if (!newValue) {
      this.roleAppropriate.set(false);
    }
  }

  toggleRandomRoles(): void {
    this.randomRoles.set(!this.randomRoles());
  }

  toggleRoleAppropriate(): void {
    if (!this.randomChampions()) return;
    this.roleAppropriate.set(!this.roleAppropriate());
  }

  // ─── Shuffle ───────────────────────────────────────────────────────────

  async shuffle(): Promise<void> {
    const names = this.validNames();
    if (names.length < this.MIN_PLAYERS) return;

    // Flip to shuffling state IMMEDIATELY so the input card @if hides and
    // the user sees the stage appear. The actual card list is set a moment
    // later, after we've optionally fetched champions and computed the
    // shuffle result. During that brief window (0 ms on cached subsequent
    // shuffles, ~200 ms on first-time network fetch), the stage just shows
    // the pulsing orb + "Rolling fates..." label — no dead state.
    this.isShuffling.set(true);
    this.result.set(null);
    this.animatingCards.set([]);

    // Fetch champions lazily — only if the user has enabled random champs
    // AND we haven't already cached them this session. Done BEFORE setting
    // animatingCards so the animation starts with everything ready.
    if (this.randomChampions() && this.championsCache().length === 0) {
      try {
        const champs = await firstValueFrom(this.api.getChampions());
        this.championsCache.set(champs);
      } catch {
        // Network failed — disable champion picking for this shuffle,
        // user still gets team-name results (roles still work).
        this.randomChampions.set(false);
      }
    }

    // Run the actual shuffle synchronously. Cheap — even with 10 players and
    // role filtering through ~160 champions, the whole compute is < 1 ms.
    const shuffledNames = this.shuffleArray(names);
    const halfSize = Math.ceil(shuffledNames.length / 2);
    const blueNames = shuffledNames.slice(0, halfSize);
    const redNames = shuffledNames.slice(halfSize);

    // Global set of assigned champion IDs — prevents the same champion from
    // appearing on both teams (LoL's blind-pick/draft rule). Passed into
    // both buildTeam calls so dedupe is cross-team, not per-team.
    const usedChampionIds = new Set<number>();
    const blueTeam = this.buildTeam(blueNames, usedChampionIds);
    const redTeam = this.buildTeam(redNames, usedChampionIds);

    // Build the ordered list of animation cards. We INTERLEAVE dealing between
    // blue and red teams (blue[0], red[0], blue[1], red[1], ...) so it feels
    // like dealing from a single deck to two players in a card game, rather
    // than "all blue first, then all red". Visually more dynamic.
    //
    // Each card's `row` is normalized so the team is vertically centered
    // regardless of size — a 3-player team gets rows [-1, 0, 1], a 5-player
    // team gets [-2, -1, 0, 1, 2], etc. The CSS uses `--team-row * spacing`
    // to place the card at its final y position.
    const animCards: AnimCard[] = [];
    const maxTeamSize = Math.max(blueTeam.length, redTeam.length);
    let dealIdx = 0;
    for (let i = 0; i < maxTeamSize; i++) {
      if (i < blueTeam.length) {
        animCards.push({
          name: blueTeam[i].name,
          team: 'blue',
          row: i - (blueTeam.length - 1) / 2,
          idx: dealIdx++,
        });
      }
      if (i < redTeam.length) {
        animCards.push({
          name: redTeam[i].name,
          team: 'red',
          row: i - (redTeam.length - 1) / 2,
          idx: dealIdx++,
        });
      }
    }

    this.animatingCards.set(animCards);

    // Wait for the full deal animation to play out.
    // Timing:
    //   • N cards × 100 ms stagger = up to 900 ms for a 10-player shuffle
    //   • Last card's own animation duration = 1200 ms
    //   • Total for 10 players: 900 + 1200 = 2100 ms
    //   • +300 ms settle buffer before unmounting the stage = 2400 ms
    // For small shuffles (2v2) the total is shorter but we wait the full
    // duration so the stage doesn't flicker in and out.
    await new Promise((resolve) => setTimeout(resolve, 2400));

    this.result.set({ blueTeam, redTeam });
    this.animatingCards.set([]);
    this.isShuffling.set(false);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────

  /** Trimmed + non-empty player names. */
  private validNames(): string[] {
    return this.players().map((n) => n.trim()).filter((n) => n.length > 0);
  }

  /**
   * Fisher-Yates (Knuth) shuffle — unbiased, O(n), in-place on a copy.
   * Math.random() is cryptographically weak but fine for "split 10 friends
   * into teams for a custom game" — nobody's defrauding their ARAM lobby.
   */
  private shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Builds one team from a list of pre-shuffled names. Assigns roles in the
   * canonical LANE_ORDER when role-appropriate mode is active, picks champions
   * from either the full pool or a role-filtered pool, and prevents duplicates
   * via the shared `usedChampionIds` set.
   *
   * If the role-filtered pool is empty (unlikely but possible if all champions
   * in a role are already assigned to the other team), falls back to the full
   * pool minus used IDs. Last-resort: no champion assignment, the card just
   * shows the player name.
   */
  private buildTeam(names: string[], usedChampionIds: Set<number>): ShuffledPlayer[] {
    const team: ShuffledPlayer[] = [];
    // Roles can come from two sources:
    //   • "Random Roles" checkbox → shuffled order (each team gets a unique random assignment)
    //   • "Role Appropriate" checkbox → fixed canonical order (TOP/JG/MID/BOT/SUP)
    // Random Roles takes precedence when both are checked.
    const useRandomRoles = this.randomRoles();
    const useFixedRoles = this.roleAppropriate() && this.randomChampions();
    const useRoles = useRandomRoles || useFixedRoles;
    const pickChampions = this.randomChampions() && this.championsCache().length > 0;
    // Filter champion pool by role ONLY when "Role Appropriate" is explicitly on.
    // "Random Roles" alone shows role icons but doesn't restrict the champion pool.
    const filterByRole = useFixedRoles || (useRandomRoles && this.roleAppropriate());

    // Shuffle or use fixed role order depending on which checkbox is active.
    const roles = useRandomRoles ? this.shuffleArray([...LANE_ORDER]) : [...LANE_ORDER];

    for (let i = 0; i < names.length; i++) {
      const role = useRoles ? roles[i % roles.length] : undefined;
      let champion: Champion | undefined;

      if (pickChampions) {
        let pool = this.championsCache();
        if (role && filterByRole) {
          const roleFiltered = pool.filter((c) => c.positions.includes(role));
          if (roleFiltered.length > 0) pool = roleFiltered;
          // Else: fall through to full pool (no champions for this role)
        }
        const available = pool.filter((c) => !usedChampionIds.has(c.id));
        if (available.length > 0) {
          champion = available[Math.floor(Math.random() * available.length)];
          usedChampionIds.add(champion.id);
        }
      }

      team.push({ name: names[i], role, champion });
    }

    return team;
  }

  // ─── Template helpers ──────────────────────────────────────────────────

  /** Placeholder text for player inputs ("Player 1", "Player 2"...). */
  playerPlaceholder(index: number): string {
    // We don't actually use the index in the translation — the placeholder
    // is just "Player name" in all languages. Keeping the method for future
    // numbering if we want "Player 1", "Player 2" style.
    return '';
  }

  /**
   * Maps a LaneRole enum to its translation key. Reuses the existing
   * `lane.*` keys which are already translated for all 6 languages, so we
   * don't have to duplicate role labels.
   */
  roleLabel(role: LaneRole): TranslationKey {
    switch (role) {
      case 'TOP':     return 'lane.top';
      case 'JUNGLE':  return 'lane.jungle';
      case 'MIDDLE':  return 'lane.middle';
      case 'BOTTOM':  return 'lane.bottom';
      case 'UTILITY': return 'lane.utility';
    }
  }
}
