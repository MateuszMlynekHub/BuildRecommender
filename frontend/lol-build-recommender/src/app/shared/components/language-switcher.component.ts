import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';
import { LANG_META, Lang } from '../../core/i18n/translations';
import { TPipe } from '../pipes/t.pipe';

/**
 * Compact language switcher rendered in the app footer.
 *
 * Layout: horizontal row of 2-letter pill buttons (PL / EN / DE / ES / RU / UA).
 * The active language is highlighted with the gold accent color used across
 * the LoL-themed UI; inactive languages are muted.
 *
 * Accessibility:
 *   • Buttons use `aria-pressed` to communicate toggle state to screen readers.
 *   • Each button has a `title` with the endonym ("Polski", "Deutsch", etc.)
 *     so hovering reveals the full language name without cluttering the UI.
 *   • The group wrapper has `role="group"` and an `aria-label` localized via
 *     the translation service so screen readers announce the purpose of the
 *     widget regardless of the currently selected language.
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lang-switcher" role="group" [attr.aria-label]="'lang.label' | t">
      @for (lang of langs; track lang) {
        <button
          type="button"
          class="lang-btn"
          [class.lang-btn--active]="lang === current()"
          [attr.aria-pressed]="lang === current()"
          [attr.title]="meta[lang].label"
          (click)="select(lang)"
        >
          {{ meta[lang].code }}
        </button>
      }
    </div>
  `,
  styles: [`
    .lang-switcher {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .lang-btn {
      padding: 0.15rem 0.5rem;
      font-size: 0.65rem;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.1em;
      color: var(--lol-text-muted);
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
      line-height: 1.4;
    }

    .lang-btn:hover {
      color: var(--lol-gold-2);
      background: rgba(200, 155, 60, 0.08);
    }

    .lang-btn:focus-visible {
      outline: 2px solid var(--lol-cyan);
      outline-offset: 2px;
    }

    .lang-btn--active {
      color: var(--lol-gold-1);
      background: rgba(200, 155, 60, 0.15);
      border-color: var(--lol-gold-4);
    }

    .lang-btn--active:hover {
      color: var(--lol-gold-1);
      background: rgba(200, 155, 60, 0.2);
    }
  `],
})
export class LanguageSwitcherComponent {
  private readonly translation = inject(TranslationService);

  readonly langs = this.translation.supportedLangs;
  readonly current = this.translation.currentLang;
  readonly meta = LANG_META;

  select(lang: Lang): void {
    this.translation.setLang(lang);
  }
}
