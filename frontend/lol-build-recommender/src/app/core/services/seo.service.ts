import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

/**
 * Per-route SEO metadata updater.
 *
 * Works alongside the static tags in `index.html` — that file is what Googlebot
 * sees on the *first* crawl of every URL before it executes JavaScript. On the
 * second render pass (Googlebot's JS-enabled crawl), this service updates the
 * title, description, Open Graph and Twitter tags so each route has its own
 * unique metadata — which is what Google eventually indexes.
 *
 * Components opt in by injecting the service and calling `updatePageMeta()` in
 * `ngOnInit`. Values that aren't passed fall back to the defaults from
 * index.html, so you only need to override what actually differs per route.
 *
 * Canonical URL is also rewritten per navigation so deep links don't all
 * report the same canonical — prevents Google from collapsing separate routes
 * into one indexed page.
 */

/** Shape of the metadata a route can override. */
export interface PageMeta {
  /** Full <title>. Appended with " — DraftSense" automatically unless already present. */
  title: string;
  /** Short description (140–160 chars ideal). Used for description + og:description + twitter:description. */
  description: string;
  /** Absolute URL of the current route. Optional — omit to keep the last-set canonical. */
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);

  /**
   * Brand suffix appended to every page title. Keeps the "DraftSense" brand
   * always visible in tab bars and search results without requiring every
   * component to remember to include it.
   */
  private readonly brandSuffix = ' — DraftSense';

  /**
   * Update the full set of SEO-critical tags for the current route. Idempotent —
   * safe to call multiple times (e.g. on route param changes).
   */
  updatePageMeta(meta: PageMeta): void {
    const fullTitle = meta.title.endsWith(this.brandSuffix.trim()) ||
                      meta.title.includes('DraftSense')
      ? meta.title
      : `${meta.title}${this.brandSuffix}`;

    this.titleService.setTitle(fullTitle);

    // Upsert pattern — updateTag adds the tag if missing, updates in place if
    // present. Using the selector form instead of name="..." overloads so OG
    // (`property=`) and Twitter (`name=`) tags both update cleanly.
    this.metaService.updateTag({ name: 'description', content: meta.description });
    this.metaService.updateTag({ property: 'og:title', content: fullTitle });
    this.metaService.updateTag({ property: 'og:description', content: meta.description });
    this.metaService.updateTag({ name: 'twitter:title', content: fullTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: meta.description });

    if (meta.url) {
      this.metaService.updateTag({ property: 'og:url', content: meta.url });
      this.setCanonical(meta.url);
    }
  }

  /**
   * Canonical URL management. Google uses the <link rel="canonical"> to
   * decide which URL to index when the same content is reachable via multiple
   * paths. Must be an absolute URL including protocol and host.
   */
  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }
}
