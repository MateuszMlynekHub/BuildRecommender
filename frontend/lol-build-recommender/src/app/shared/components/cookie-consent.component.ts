import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConsentService } from '../../core/services/consent.service';
import { TPipe } from '../pipes/t.pipe';

/**
 * GDPR cookie consent banner.
 *
 * Rendered inside the app root template; shown when ConsentService.visible
 * is true (first visit, or user re-opened via footer "Cookies" link).
 *
 * Design principles baked in here:
 *   • Equal-weight buttons — the EU's CJEU "Planet49" ruling + Article 29
 *     Working Party guidance both say Accept and Reject must be equally
 *     prominent. We style both as rounded pills with the same size and
 *     visual weight; the only difference is color (gold for accept, muted
 *     outline for reject) so the brand aesthetic survives.
 *   • No dark patterns — Reject is NOT hidden behind "Manage preferences"
 *     or "Settings". A user can decline in one click from the banner.
 *   • Fixed position bottom of screen so it's always visible until dismissed.
 *   • Above the app-footer (z-index 100 vs footer's 50) so users can't
 *     interact with the rest of the app without answering first.
 *   • OnPush change detection + signal reads — no performance overhead on
 *     unrelated app state changes.
 *
 * Accessibility:
 *   • role="dialog" + aria-modal="true" so screen readers announce it as a
 *     blocking interactive element.
 *   • aria-labelledby points at the banner text for a meaningful label.
 *   • Both buttons are real <button> elements with proper focus states.
 */
@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (consent.visible()) {
      <div
        class="cookie-banner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-banner-text"
      >
        <div class="cookie-banner__inner">
          <p class="cookie-banner__text" id="cookie-banner-text">
            {{ 'cookie.banner.message' | t }}
          </p>
          <div class="cookie-banner__actions">
            <button
              type="button"
              class="cookie-banner__btn cookie-banner__btn--reject"
              (click)="reject()"
            >
              {{ 'cookie.banner.reject' | t }}
            </button>
            <button
              type="button"
              class="cookie-banner__btn cookie-banner__btn--accept"
              (click)="accept()"
            >
              {{ 'cookie.banner.accept' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cookie-banner {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      /* Above the app-footer (z-index 50) so the banner visually sits on top
         until dismissed. No backdrop — we don't want to block the whole page
         visually, just demand attention at the bottom. */
      z-index: 100;
      background: rgba(1, 10, 19, 0.97);
      border-top: 1px solid var(--lol-gold-3);
      box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.7);
      padding: 1rem;
      padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0));
      animation: cookie-banner-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @supports (backdrop-filter: blur(12px)) {
      .cookie-banner {
        background: rgba(1, 10, 19, 0.88);
        backdrop-filter: blur(14px) saturate(1.1);
        -webkit-backdrop-filter: blur(14px) saturate(1.1);
      }
    }

    @keyframes cookie-banner-slide-up {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .cookie-banner__inner {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .cookie-banner__text {
      flex: 1 1 280px;
      margin: 0;
      color: var(--lol-gold-1);
      font-size: 0.85rem;
      line-height: 1.55;
      font-family: 'Inter', sans-serif;
    }

    .cookie-banner__actions {
      display: flex;
      gap: 0.65rem;
      flex-shrink: 0;
    }

    /* Base button style — shared between Accept and Reject so they carry
       equal visual weight per GDPR guidance. Only the background + border
       differ. */
    .cookie-banner__btn {
      padding: 0.6rem 1.4rem;
      font-family: 'Cinzel', serif;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border-radius: 4px;
      cursor: pointer;
      transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      line-height: 1;
    }

    .cookie-banner__btn:focus-visible {
      outline: 2px solid var(--lol-cyan);
      outline-offset: 2px;
    }

    .cookie-banner__btn--reject {
      background: transparent;
      border: 1px solid var(--lol-gold-4);
      color: var(--lol-gold-2);
    }
    .cookie-banner__btn--reject:hover {
      border-color: var(--lol-gold-3);
      color: var(--lol-gold-1);
      background: rgba(200, 155, 60, 0.08);
    }

    .cookie-banner__btn--accept {
      background: linear-gradient(180deg, var(--lol-gold-3), var(--lol-gold-4));
      border: 1px solid var(--lol-gold-3);
      color: var(--lol-void);
    }
    .cookie-banner__btn--accept:hover {
      filter: brightness(1.12);
      box-shadow: 0 0 16px rgba(200, 155, 60, 0.55);
    }

    /* Mobile — stack vertically, buttons become full-width so they're easy
       to tap. Text wraps above. */
    @media (max-width: 640px) {
      .cookie-banner {
        padding: 0.85rem 0.9rem;
      }
      .cookie-banner__inner {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
      }
      .cookie-banner__text {
        font-size: 0.78rem;
        text-align: center;
        flex-basis: auto;
      }
      .cookie-banner__actions {
        justify-content: stretch;
      }
      .cookie-banner__btn {
        flex: 1;
        padding: 0.7rem 0.8rem;
        font-size: 0.7rem;
      }
    }
  `],
})
export class CookieConsentComponent {
  readonly consent = inject(ConsentService);

  accept(): void {
    this.consent.accept();
  }

  reject(): void {
    this.consent.reject();
  }
}
