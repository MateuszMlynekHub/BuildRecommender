import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TPipe } from '../pipes/t.pipe';

interface NavItem {
  route: string;
  label: string;
  translate?: boolean;  // true = label is a translation key
  icon: string;         // SVG path(s) inside viewBox 0 0 24 24
  accent?: boolean;
  exact?: boolean;
}

const MAIN_LINKS: NavItem[] = [
  { route: '/',           label: 'nav.searchGame', translate: true, exact: true,
    icon: 'M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' },
  { route: '/summoner',   label: 'Summoner',
    icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
  { route: '/champions',  label: 'nav.champions', translate: true,
    icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
  { route: '/tier-list',  label: 'nav.tierList', translate: true,
    icon: 'M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z' },
  { route: '/draft',      label: 'nav.draft', translate: true,
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z' },
  { route: '/meta',       label: 'nav.meta', translate: true,
    icon: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z' },
  { route: '/pro-builds', label: 'Pro Builds',
    icon: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z' },
  { route: '/shuffle',     label: 'nav.teamShuffle', translate: true,
    icon: 'M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z' },
];

const TOOLS_LINKS: NavItem[] = [
  { route: '/multisearch', label: 'Multi-search',
    icon: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
  { route: '/simulator',   label: 'nav.simulator', translate: true,
    icon: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' },
  { route: '/gold-advisor', label: 'nav.goldAdvisor', translate: true,
    icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
  { route: '/leaderboard',  label: 'nav.leaderboard', translate: true,
    icon: 'M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z' },
  { route: '/mode-tierlist', label: 'Modes',
    icon: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z' },
  { route: '/duo-synergy',   label: 'Duo',
    icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
];

const VIRAL_LINKS: NavItem[] = [
  { route: '/roast',          label: 'nav.roast', translate: true, accent: true, exact: true,
    icon: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z' },
  { route: '/build-battle',   label: 'Build Battle',
    icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z' },
  { route: '/wrapped',        label: 'Wrapped',
    icon: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z' },
  { route: '/best-builders',  label: 'Best Builders',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' },
  { route: '/roast/team',     label: 'Team Report',
    icon: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z' },
];

@Component({
  selector: 'app-nav-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="nav" [attr.aria-label]="'nav.ariaLabel' | t">
      <!-- Mobile burger -->
      <button class="nav__burger" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          @if (menuOpen()) {
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          } @else {
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          }
        </svg>
      </button>

      <div class="nav__bar" [class.nav__bar--open]="menuOpen()" (click)="closeMobileOnLink($event)">
        <!-- Main links — always visible -->
        @for (item of mainLinks; track item.route) {
          <a [routerLink]="item.route"
             [routerLinkActiveOptions]="{ exact: !!item.exact }"
             routerLinkActive="nav__link--active"
             class="nav__link"
             [class.nav__link--accent]="item.accent">
            <svg class="nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              width="15" height="15" fill="currentColor" aria-hidden="true">
              <path [attr.d]="item.icon"/>
            </svg>
            <span>{{ item.translate ? (item.label | t) : item.label }}</span>
          </a>
        }

        <!-- TOOLS dropdown (desktop) / section (mobile) -->
        <div class="nav__dropdown" (mouseenter)="toolsOpen.set(true)" (mouseleave)="toolsOpen.set(false)">
          <button class="nav__link nav__link--trigger" [class.nav__link--open]="toolsOpen()">
            <svg class="nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
            </svg>
            <span>Tools</span>
            <svg class="nav__chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              width="12" height="12" fill="currentColor">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
            </svg>
          </button>
          <div class="nav__dropdown-panel" [class.nav__dropdown-panel--open]="toolsOpen()">
            @for (item of toolsLinks; track item.route) {
              <a [routerLink]="item.route" routerLinkActive="nav__drop-link--active" class="nav__drop-link">
                <svg class="nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                  width="15" height="15" fill="currentColor" aria-hidden="true">
                  <path [attr.d]="item.icon"/>
                </svg>
                <span>{{ item.translate ? (item.label | t) : item.label }}</span>
              </a>
            }
          </div>
        </div>

        <!-- VIRAL dropdown -->
        <div class="nav__dropdown" (mouseenter)="viralOpen.set(true)" (mouseleave)="viralOpen.set(false)">
          <button class="nav__link nav__link--trigger nav__link--accent" [class.nav__link--open]="viralOpen()">
            <svg class="nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
            </svg>
            <span>Roast</span>
            <svg class="nav__chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              width="12" height="12" fill="currentColor">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
            </svg>
          </button>
          <div class="nav__dropdown-panel" [class.nav__dropdown-panel--open]="viralOpen()">
            @for (item of viralLinks; track item.route) {
              <a [routerLink]="item.route"
                 [routerLinkActiveOptions]="{ exact: !!item.exact }"
                 routerLinkActive="nav__drop-link--active"
                 class="nav__drop-link"
                 [class.nav__drop-link--accent]="item.accent">
                <svg class="nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                  width="15" height="15" fill="currentColor" aria-hidden="true">
                  <path [attr.d]="item.icon"/>
                </svg>
                <span>{{ item.translate ? (item.label | t) : item.label }}</span>
              </a>
            }
          </div>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    /* ===== Bar ===== */
    .nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: rgba(1,10,19,0.85);
      border-bottom: 1px solid var(--lol-gold-5);
      box-shadow: 0 4px 12px rgba(0,0,0,0.45);
      padding: env(safe-area-inset-top,0) 0 0 0;
    }
    @supports (backdrop-filter: blur(10px)) {
      .nav { background: rgba(1,10,19,0.65); backdrop-filter: blur(10px) saturate(1.1); }
    }
    .nav__bar {
      max-width: 1320px; height: 3rem; margin: 0 auto; padding: 0 0.75rem;
      display: flex; align-items: center; justify-content: center; gap: 0.15rem;
    }

    /* ===== Link ===== */
    .nav__link {
      display: inline-flex; align-items: center; gap: 0.35rem;
      height: 100%; padding: 0 0.7rem;
      color: var(--lol-gold-3,#c89b3c); text-decoration: none;
      font-family: 'Cinzel',serif; font-size: 0.68rem; font-weight: 600;
      letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap;
      border-bottom: 2px solid transparent;
      transition: color .15s, border-color .15s, background .15s;
      background: none; border-top: none; border-left: none; border-right: none;
      cursor: pointer;
    }
    .nav__link:hover { color: var(--lol-gold-1,#f0e6d2); background: rgba(200,155,60,0.08); }
    .nav__link--active { color: var(--lol-gold-1); border-bottom-color: var(--lol-gold-3); text-shadow: 0 0 10px rgba(200,155,60,0.35); }
    .nav__link--accent { color: #ff6b35; }
    .nav__link--accent:hover { color: #ff9066; background: rgba(255,107,53,0.08); }
    .nav__link--trigger { gap: 0.25rem; }
    .nav__link:focus-visible { outline: 2px solid var(--lol-cyan); outline-offset: -2px; }

    .nav__icon { flex-shrink: 0; color: inherit; }
    .nav__chevron { flex-shrink: 0; transition: transform .2s; }
    .nav__link--open .nav__chevron { transform: rotate(180deg); }

    /* ===== Dropdown ===== */
    .nav__dropdown { position: relative; height: 100%; display: flex; align-items: center; }
    .nav__dropdown-panel {
      position: absolute; top: 100%; left: 0; min-width: 200px;
      background: rgba(1,10,19,0.97); border: 1px solid var(--lol-gold-5);
      border-radius: 0 0 4px 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      padding: 0.35rem 0;
      opacity: 0; visibility: hidden; transform: translateY(-4px);
      transition: opacity .15s, transform .15s, visibility .15s;
    }
    .nav__dropdown-panel--open { opacity: 1; visibility: visible; transform: translateY(0); }

    .nav__drop-link {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; text-decoration: none;
      color: var(--lol-gold-3,#c89b3c); font-size: 0.75rem; font-weight: 600;
      letter-spacing: 0.05em; transition: background .12s, color .12s;
    }
    .nav__drop-link:hover { background: rgba(200,155,60,0.1); color: var(--lol-gold-1); }
    .nav__drop-link--active { color: var(--lol-gold-1); background: rgba(200,155,60,0.08); }
    .nav__drop-link--accent { color: #ff6b35; }
    .nav__drop-link--accent:hover { color: #ff9066; }

    /* ===== Burger ===== */
    .nav__burger {
      display: none; position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
      background: transparent; border: none; color: var(--lol-gold-2); cursor: pointer; padding: 0.25rem; z-index: 2;
    }

    /* ===== Mobile ===== */
    @media (max-width: 900px) {
      .nav__burger { display: flex; }
      .nav__bar {
        position: absolute; top: 100%; left: 0; right: 0;
        height: auto; max-height: 0; overflow-y: auto;
        flex-direction: column; align-items: stretch; gap: 0; padding: 0;
        background: rgba(1,10,19,0.97); border-bottom: 1px solid var(--lol-gold-5);
        transition: max-height .3s ease;
      }
      .nav__bar--open { max-height: 85vh; padding: 0.25rem 0; }

      .nav__link {
        height: auto; padding: 0.6rem 1.2rem; font-size: 0.75rem;
        border-bottom: none; border-left: 2px solid transparent;
      }
      .nav__link--active { border-left-color: var(--lol-gold-3); background: rgba(200,155,60,0.06); border-bottom: none; }

      /* Dropdowns become always-open sections on mobile */
      .nav__dropdown { flex-direction: column; height: auto; }
      .nav__link--trigger {
        padding: 0.5rem 1.2rem; font-size: 0.6rem; color: var(--lol-text-muted);
        letter-spacing: 0.12em; pointer-events: none;
      }
      .nav__chevron { display: none; }
      .nav__dropdown-panel {
        position: static; opacity: 1; visibility: visible; transform: none;
        background: transparent; border: none; box-shadow: none; padding: 0;
        min-width: auto;
      }
      .nav__drop-link { padding: 0.5rem 1.2rem 0.5rem 2.2rem; font-size: 0.75rem; }
    }
  `],
})
export class NavMenuComponent {
  readonly menuOpen = signal(false);
  readonly toolsOpen = signal(false);
  readonly viralOpen = signal(false);

  readonly mainLinks = MAIN_LINKS;
  readonly toolsLinks = TOOLS_LINKS;
  readonly viralLinks = VIRAL_LINKS;

  closeMobileOnLink(e: Event) {
    if ((e.target as HTMLElement).closest('a')) {
      this.menuOpen.set(false);
      this.toolsOpen.set(false);
      this.viralOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const el = (e.target as HTMLElement);
    if (!el.closest('.nav__dropdown')) {
      this.toolsOpen.set(false);
      this.viralOpen.set(false);
    }
  }
}
