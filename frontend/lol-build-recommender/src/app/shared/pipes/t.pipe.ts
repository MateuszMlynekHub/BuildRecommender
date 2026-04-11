import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';
import { TranslationKey } from '../../core/i18n/translations';

/**
 * `t` pipe — looks up a translation key against the current language and
 * substitutes `{placeholder}` tokens from the optional args dict.
 *
 * Usage:
 *     {{ 'home.form.submit' | t }}
 *     {{ 'reason.armorVsAd' | t:{ percent: 65 } }}
 *     {{ reason.key | t:reason.args }}        <!-- from backend DTO -->
 *
 * Placeholder interpolation:
 *   Translation strings use `{name}` markers:
 *     "Armor vs AD team ({percent}%)"
 *   At render time, every `{name}` is replaced with `String(args[name])`.
 *   If a token has no matching arg, it's left as-is — useful for dev-time
 *   debugging when a backend reason is missing a field.
 *
 * Why `pure: false`:
 *   Angular's default `pure: true` memoizes a pipe's output by argument equality.
 *   The translation KEY rarely changes but the CURRENT LANGUAGE does, and a pure
 *   pipe wouldn't re-run when `setLang()` fires — stale strings would persist on
 *   screen after a language switch.
 *
 *   Making the pipe impure costs one dictionary lookup + N string replacements
 *   per key per CD cycle, which is nanoseconds per translation — well under the
 *   noise floor for an SPA with ~50 translated strings on screen at a time.
 *
 * Why accept `string` in addition to `TranslationKey`:
 *   Reason keys come from the backend DTO as untyped strings. Rather than cast
 *   at every call site, we widen the pipe's input type. Unknown keys fall back
 *   to the English translation or (as a last resort) the raw key so the UI
 *   never shows a blank slot.
 */
@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TPipe implements PipeTransform {
  private translation = inject(TranslationService);

  transform(key: TranslationKey | string, args?: Record<string, string | number> | null): string {
    // Read the signal so Angular tracks this pipe as a consumer — when the
    // signal mutates (user clicks a flag), the impure-pipe re-evaluation
    // picks up the new language on the next CD cycle.
    this.translation.currentLang();

    // Cast is safe: t() defensively handles any string, not just known keys.
    const raw = this.translation.t(key as TranslationKey);

    if (!args) return raw;

    // Replace every {name} token with the matching arg value. Simple string
    // replacement is fine — our keys are ASCII identifiers so no regex escaping
    // issues, and the args come from our own backend (no injection risk, and
    // Angular's interpolation escapes HTML on the way out anyway).
    return raw.replace(/\{(\w+)\}/g, (match, token: string) => {
      const value = args[token];
      return value !== undefined && value !== null ? String(value) : match;
    });
  }
}
