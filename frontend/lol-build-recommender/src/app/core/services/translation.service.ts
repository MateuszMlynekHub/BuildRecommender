import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Lang, SUPPORTED_LANGS, TRANSLATIONS, TranslationKey } from '../i18n/translations';

/**
 * Runtime translation service — signal-based so templates re-render the
 * moment a user picks a new language from the switcher.
 *
 * Responsibilities:
 *   • Detect the initial language (localStorage → navigator.language → 'pl').
 *   • Expose the current language as a readable signal.
 *   • Provide `t(key)` for imperative use and `TPipe` for templates.
 *   • Keep <html lang="..."> in sync so browser reader modes and screen
 *     readers announce the right locale after a switch.
 *   • Persist the user's choice so next visit boots in their language.
 *
 * This is a hand-rolled alternative to @angular/localize — chosen because
 * runtime switching without a page reload is a better UX for a single-page
 * gaming tool, and the string count is small enough (~30 keys) that a full
 * i18n framework would be overkill.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly document = inject(DOCUMENT);

  /** localStorage key — prefixed to avoid collisions with other apps on the domain. */
  private readonly STORAGE_KEY = 'df:lang';

  /**
   * Writable signal holding the current language. Private setter through
   * `setLang()` so persistence + <html lang> update can't be bypassed.
   */
  private readonly _currentLang = signal<Lang>(this.detectInitialLang());

  /** Public read-only view of the current language for components to bind. */
  readonly currentLang = this._currentLang.asReadonly();

  /** Available languages — mirror of the constant, re-exported for convenience. */
  readonly supportedLangs = SUPPORTED_LANGS;

  constructor() {
    // Keep the document's lang attribute in sync with the signal. This runs
    // on construction (initial value) and every time setLang() fires, so
    // both navigator-autodetect and manual switches update the DOM.
    // Screen readers and browser reader-mode both read this attribute.
    effect(() => {
      this.document.documentElement.lang = this._currentLang();
    });
  }

  /**
   * Imperative translation lookup. Components generally use the `t` pipe
   * in templates; this method exists for services and computed signals
   * that need a translated string outside a template.
   */
  t(key: TranslationKey): string {
    const lang = this._currentLang();
    // Fall back to English if a key is missing in the selected language
    // (shouldn't happen — the Dict type enforces full coverage — but we
    // defensively handle it in case translations.ts drifts).
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  }

  /**
   * Switch language. Persists to localStorage so the next session boots
   * in the same language.
   */
  setLang(lang: Lang): void {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    this._currentLang.set(lang);
    try {
      this.document.defaultView?.localStorage.setItem(this.STORAGE_KEY, lang);
    } catch {
      // localStorage throws on private mode in some browsers. Non-fatal —
      // the switch still works for the current session.
    }
  }

  /**
   * Resolution order:
   *   1. Previously-chosen language from localStorage (sticky preference).
   *   2. navigator.language two-letter prefix, IF it matches one of the 6
   *      supported languages — so Polish/German/Spanish/Russian/Ukrainian
   *      browsers land on their native UI automatically.
   *   3. Fall back to English — the app's international default. Browsers
   *      set to unsupported languages (French, Japanese, etc.) see English
   *      instead of Polish, which matches the app's primary SEO language
   *      and avoids forcing users into a language they don't read.
   */
  private detectInitialLang(): Lang {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(this.STORAGE_KEY);
      if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored)) {
        return stored as Lang;
      }
    } catch {
      // localStorage access blocked — fall through to navigator detection.
    }

    const nav = this.document.defaultView?.navigator.language?.slice(0, 2).toLowerCase() ?? '';
    if ((SUPPORTED_LANGS as readonly string[]).includes(nav)) {
      return nav as Lang;
    }
    return 'en';
  }
}
