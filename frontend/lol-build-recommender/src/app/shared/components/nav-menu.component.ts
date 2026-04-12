import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TPipe } from '../pipes/t.pipe';

/**
 * Top-of-page navigation between the two main app features.
 *
 * Currently two tabs:
 *   • Search Game   — the existing live-match + build recommender flow (/).
 *   • Team Shuffle  — the lobby randomizer (/shuffle).
 *
 * Design:
 *   • Fixed at the top of the viewport, above everything else. Pairs with
 *     the fixed footer to bookend the app UI.
 *   • Translucent dark background with gold accents, matching LoL client chrome.
 *   • routerLinkActive handles active-tab highlighting without a manual
 *     subscription to router events. For the root "/" route we pass
 *     `{exact: true}` so it doesn't also match /game or /shuffle.
 *   • OnPush — no component state that triggers change detection, only
 *     router state which RouterLinkActive already tracks.
 *
 * Accessibility:
 *   • <nav> landmark element (implicit role="navigation")
 *   • aria-label from translation so screen readers announce "Main navigation"
 *   • Active tab gets aria-current="page"
 */
@Component({
  selector: 'app-nav-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="app-nav" [attr.aria-label]="'nav.ariaLabel' | t">
      <div class="app-nav__inner">
        <a
          routerLink="/"
          [routerLinkActiveOptions]="{ exact: true }"
          routerLinkActive="app-nav__tab--active"
          #searchLink="routerLinkActive"
          [attr.aria-current]="searchLink.isActive ? 'page' : null"
          class="app-nav__tab"
        >
          <!-- Compass/search icon — gold glyph matching the LoL client's lobby
               "find match" button. Inline SVG keeps zero external assets. -->
          <svg
            class="app-nav__icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <span>{{ 'nav.searchGame' | t }}</span>
        </a>

        <a
          routerLink="/shuffle"
          routerLinkActive="app-nav__tab--active"
          #shuffleLink="routerLinkActive"
          [attr.aria-current]="shuffleLink.isActive ? 'page' : null"
          class="app-nav__tab"
        >
          <!-- Shuffle/dice icon — signals randomization. -->
          <svg
            class="app-nav__icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
          </svg>
          <span>{{ 'nav.teamShuffle' | t }}</span>
        </a>

        <a
          routerLink="/champions"
          routerLinkActive="app-nav__tab--active"
          #champsLink="routerLinkActive"
          [attr.aria-current]="champsLink.isActive ? 'page' : null"
          class="app-nav__tab"
        >
          <svg
            class="app-nav__icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>{{ 'nav.champions' | t }}</span>
        </a>
      </div>
    </nav>
  `,
  styles: [`
    .app-nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 50;
      background: rgba(1, 10, 19, 0.85);
      border-bottom: 1px solid var(--lol-gold-5);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
      padding: env(safe-area-inset-top, 0) 0 0 0;
    }

    @supports (backdrop-filter: blur(10px)) {
      .app-nav {
        background: rgba(1, 10, 19, 0.65);
        backdrop-filter: blur(10px) saturate(1.1);
        -webkit-backdrop-filter: blur(10px) saturate(1.1);
      }
    }

    .app-nav__inner {
      max-width: 1280px;
      height: 3rem;
      margin: 0 auto;
      padding: 0 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .app-nav__tab {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      height: 100%;
      padding: 0 1.25rem;
      color: var(--lol-text-muted);
      text-decoration: none;
      font-family: 'Cinzel', serif;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border-bottom: 2px solid transparent;
      transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
    }

    .app-nav__tab:hover {
      color: var(--lol-gold-2);
      background: rgba(200, 155, 60, 0.06);
    }

    .app-nav__tab:focus-visible {
      outline: 2px solid var(--lol-cyan);
      outline-offset: -2px;
    }

    .app-nav__tab--active {
      color: var(--lol-gold-1);
      border-bottom-color: var(--lol-gold-3);
      text-shadow: 0 0 12px rgba(200, 155, 60, 0.4);
    }

    .app-nav__icon {
      flex-shrink: 0;
      color: inherit;
    }

    /* Mobile — tighten spacing and hide icons on very narrow screens
       so both tab labels fit. */
    @media (max-width: 480px) {
      .app-nav__inner {
        padding: 0 0.5rem;
      }
      .app-nav__tab {
        padding: 0 0.65rem;
        font-size: 0.68rem;
        letter-spacing: 0.08em;
      }
      .app-nav__icon {
        display: none;
      }
    }
  `],
})
export class NavMenuComponent {}
