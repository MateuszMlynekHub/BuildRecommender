import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LanguageSwitcherComponent } from './shared/components/language-switcher.component';
import { CookieConsentComponent } from './shared/components/cookie-consent.component';
import { NavMenuComponent } from './shared/components/nav-menu.component';
import { TPipe } from './shared/pipes/t.pipe';
import { ConsentService } from './core/services/consent.service';

/**
 * Global `gtag` type declaration. The gtag snippet in index.html defines a
 * window-level function; TypeScript doesn't know about it by default. We
 * declare a loose signature here instead of pulling in `@types/gtag.js`
 * (extra dependency for one function call).
 */
declare function gtag(command: 'config', targetId: string, params?: Record<string, unknown>): void;

@Component({
  selector: 'app-root',
  // Imports required by the app.html template:
  //   - RouterOutlet renders the current route
  //   - NavMenuComponent is the top <app-nav-menu /> with Search/Shuffle tabs
  //   - LanguageSwitcherComponent is the <app-language-switcher /> in the footer
  //   - CookieConsentComponent is the GDPR banner rendered at the root
  //   - TPipe provides the `| t` translation pipe used by the footer copy
  imports: [RouterOutlet, NavMenuComponent, LanguageSwitcherComponent, CookieConsentComponent, TPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('lol-build-recommender');

  /**
   * Google Analytics measurement ID. Kept as a class constant rather than
   * hardcoded inside the subscribe callback so it can be swapped in one
   * place if we ever move to a second GA property (staging vs production).
   */
  private static readonly GA_MEASUREMENT_ID = 'G-B352Q2V3CW';

  /**
   * Public access to the consent service so the template footer can call
   * `consent.manageCookies()` when the user clicks the "Cookies" link.
   * Consent state itself is managed entirely inside the service — App only
   * forwards the reopen action.
   */
  readonly consent = inject(ConsentService);

  constructor() {
    const router = inject(Router);

    // SPA pageview tracking — Angular route changes don't trigger a full page
    // reload, so the gtag snippet in index.html only ever records the initial
    // landing. We re-configure GA on every NavigationEnd with the new path,
    // which GA4 treats as a fresh pageview. Without this, the entire user
    // journey through `/` → `/game` looks like a single-page bounce.
    //
    // Important: this fires regardless of consent state. GA's Consent Mode v2
    // buffers the events and only sends them if analytics_storage is granted,
    // so we don't need to gate the call here — double-gating is actually
    // harmful because the state can flip mid-session when the user accepts.
    //
    // The constructor is the right place for this: App is the root
    // component, instantiated exactly once at bootstrap. The subscription
    // lives for the lifetime of the app — no cleanup needed.
    router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        // Guard against missing gtag — happens if an ad blocker stripped
        // the script. Silently no-op rather than crashing the app.
        if (typeof gtag !== 'function') return;

        gtag('config', App.GA_MEASUREMENT_ID, {
          // Send the URL AFTER router normalization so redirects don't
          // log the pre-redirect path.
          page_path: event.urlAfterRedirects,
        });
      });
  }
}
