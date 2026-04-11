import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Global `gtag` type declaration. The gtag snippet in index.html defines a
 * window-level function; TypeScript doesn't know about it by default. A loose
 * signature is sufficient here — we don't need full @types/gtag.js just to
 * call `gtag('consent', 'update', ...)`.
 */
declare function gtag(
  command: 'consent',
  action: 'update',
  params: {
    ad_storage: 'granted' | 'denied';
    ad_user_data: 'granted' | 'denied';
    ad_personalization: 'granted' | 'denied';
    analytics_storage: 'granted' | 'denied';
  }
): void;

/**
 * User's consent decision for analytics cookies. Three states so the banner
 * component can distinguish "never asked" (show banner) from "already answered"
 * (hide banner).
 */
export type ConsentStatus = 'unknown' | 'accepted' | 'rejected';

/**
 * Persisted shape in localStorage. Versioned so we can re-ask the user if the
 * policy changes (bump CONSENT_VERSION and older stored states become stale).
 */
interface StoredConsent {
  status: 'accepted' | 'rejected';
  timestamp: number;
  version: number;
}

/**
 * GDPR-compliant consent manager for Google Analytics.
 *
 * How the whole consent flow works:
 *   1. index.html inline script sets `gtag('consent', 'default', ALL_DENIED)`
 *      BEFORE gtag.js loads — no analytics data leaves the browser yet.
 *   2. The same inline script reads localStorage['draftsense:consent']. If the
 *      user previously accepted, it calls `gtag('consent', 'update', GRANTED)`
 *      synchronously, so the first GA pageview fires with the correct state.
 *   3. Angular bootstraps. This service reads the same localStorage key and
 *      initializes `status` and `visible` signals accordingly.
 *   4. If status is 'unknown', the CookieConsentComponent renders the banner
 *      on top of the app. User clicks Accept or Reject → service updates
 *      gtag consent, persists to localStorage, hides the banner.
 *   5. User can click the "Cookies" link in the footer to re-open the banner
 *      (Service.manageCookies) — current state stays in effect until they
 *      click Accept/Reject again.
 *
 * Signals used:
 *   • status  — the persisted decision ('unknown' | 'accepted' | 'rejected')
 *   • visible — whether the banner should be on screen right now. Starts as
 *               true when status is 'unknown', false otherwise. Decoupled from
 *               status so "manage cookies" can show the banner without
 *               mutating the underlying decision until the user clicks again.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly document = inject(DOCUMENT);

  /** Shared with the inline script in index.html — keep in sync. */
  private static readonly STORAGE_KEY = 'draftsense:consent';

  /**
   * Bump when the consent text materially changes (new data category, new
   * provider, new purpose). Stored values with an older version are treated
   * as 'unknown' so the user is re-asked.
   */
  private static readonly CONSENT_VERSION = 1;

  private readonly _status = signal<ConsentStatus>(this.loadStoredStatus());

  /** Persisted consent decision. Rendered by the banner component. */
  readonly status = this._status.asReadonly();

  /**
   * Whether the banner should be visible right now. True by default on first
   * visit (status === 'unknown') OR when the user explicitly clicks "Manage
   * cookies" in the footer. Hides on accept/reject.
   */
  private readonly _visible = signal<boolean>(this._status() === 'unknown');
  readonly visible = this._visible.asReadonly();

  /** User clicked "Accept". Grants all consent categories. */
  accept(): void {
    this._status.set('accepted');
    this._visible.set(false);
    this.persist('accepted');
    this.updateGtag('granted');
  }

  /** User clicked "Reject". Denies all consent categories. */
  reject(): void {
    this._status.set('rejected');
    this._visible.set(false);
    this.persist('rejected');
    this.updateGtag('denied');
  }

  /**
   * Re-open the banner (footer "Cookies" link). Preserves the current
   * accepted/rejected state — it only flips back when the user clicks
   * accept or reject inside the banner. This is the right UX for
   * "I'd like to change my mind" without silently wiping analytics state.
   */
  manageCookies(): void {
    this._visible.set(true);
  }

  private loadStoredStatus(): ConsentStatus {
    try {
      const raw = this.document.defaultView?.localStorage.getItem(ConsentService.STORAGE_KEY);
      if (!raw) return 'unknown';
      const parsed = JSON.parse(raw) as Partial<StoredConsent>;
      if (parsed.version !== ConsentService.CONSENT_VERSION) return 'unknown';
      if (parsed.status === 'accepted' || parsed.status === 'rejected') {
        return parsed.status;
      }
      return 'unknown';
    } catch {
      // Corrupt JSON, blocked storage, etc. — treat as "never asked".
      return 'unknown';
    }
  }

  private persist(status: 'accepted' | 'rejected'): void {
    const payload: StoredConsent = {
      status,
      timestamp: Date.now(),
      version: ConsentService.CONSENT_VERSION,
    };
    try {
      this.document.defaultView?.localStorage.setItem(
        ConsentService.STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // Private mode / Safari ITP / corporate policy — non-fatal. The session
      // still respects the choice; next visit will re-ask.
    }
  }

  /**
   * Tells gtag.js to flip all consent signals. With Consent Mode v2 the signals
   * are interdependent but setting them uniformly is the simplest correct
   * behavior — our banner only asks "analytics yes/no", not granular categories.
   * If we ever introduce ad remarketing or personalization, split the buttons.
   */
  private updateGtag(state: 'granted' | 'denied'): void {
    if (typeof gtag !== 'function') return;
    gtag('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
  }
}
