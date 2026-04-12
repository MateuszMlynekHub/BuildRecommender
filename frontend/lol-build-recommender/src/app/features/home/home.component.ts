import { Component, PLATFORM_ID, inject, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { Region } from '../../core/models/region.model';
import { TPipe } from '../../shared/pipes/t.pipe';
import { TranslationKey } from '../../core/i18n/translations';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  template: `
    <!-- Full-viewport hero with Summoner's Rift splash backdrop -->
    <div class="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10">
      <!-- Splash background layer -->
      <div class="absolute inset-0 -z-10">
        <div
          class="absolute inset-0 bg-cover bg-center"
          style="
            background-image: url('https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt9daf7fb37df4d8a4/6075c1d9e8811b5bbb8aad47/Homepage_Art_MSI2021.jpg');
            filter: brightness(0.25) saturate(1.2);
          "
        ></div>
        <div class="absolute inset-0" style="background: linear-gradient(180deg, rgba(1,10,19,0.7) 0%, rgba(1,10,19,0.95) 100%);"></div>
      </div>

      <div class="w-full max-w-lg relative animate-in">
        <!-- Logo + title -->
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-full gold-border-bright" style="background: radial-gradient(circle, rgba(200,155,60,0.25), transparent 70%);">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="44" fill="var(--lol-gold-3)">
              <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2zM3 13.18v4L12 22l9-4.82v-4L12 18l-9-4.82z"/>
            </svg>
          </div>
          <h1 class="text-4xl md:text-5xl font-display text-gold-lite tracking-wide mb-3">
            {{ 'home.hero.title1' | t }} <span class="text-gold">{{ 'home.hero.title2' | t }}</span>
          </h1>
          <div class="gold-divider mb-3">
            <span class="text-gold text-lg">◆</span>
          </div>
          <p class="text-muted text-sm md:text-base tracking-wide">
            {{ 'home.hero.subtitle' | t }}
          </p>
        </div>

        <!-- Main search card -->
        <div class="glass-card p-8 relative">
          <!-- Decorative corner ornaments -->
          <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2" style="border-color: var(--lol-gold-3);"></div>
          <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2" style="border-color: var(--lol-gold-3);"></div>
          <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2" style="border-color: var(--lol-gold-3);"></div>
          <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2" style="border-color: var(--lol-gold-3);"></div>

          <div class="mb-6">
            <label class="block text-xs font-display uppercase tracking-widest mb-2 text-gold-soft">{{ 'home.form.riotId' | t }}</label>
            <div class="flex gap-2 items-stretch">
              <input
                type="text"
                [(ngModel)]="gameName"
                [placeholder]="'home.form.riotId.name.placeholder' | t"
                class="lol-input min-w-0"
                style="flex: 7 1 0%;"
                (keyup.enter)="findGame()"
              />
              <span class="flex items-center px-1 text-gold text-2xl font-display shrink-0">#</span>
              <input
                type="text"
                [(ngModel)]="tagLine"
                [placeholder]="'home.form.riotId.tag.placeholder' | t"
                class="lol-input min-w-0 uppercase"
                style="flex: 3 1 0%;"
                (keyup.enter)="findGame()"
              />
            </div>
          </div>

          <div class="mb-8">
            <label for="ds-region-select" class="block text-xs font-display uppercase tracking-widest mb-2 text-gold-soft">{{ 'home.form.region' | t }}</label>
            <div class="relative">
              <select
                id="ds-region-select"
                [(ngModel)]="selectedRegion"
                [attr.aria-label]="'home.form.region' | t"
                class="lol-input w-full appearance-none pr-10 cursor-pointer"
              >
                @for (region of regions(); track region.id) {
                  <option [value]="region.id" style="background-color: var(--lol-abyss)">{{ region.name }}</option>
                }
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"
                   class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                   fill="var(--lol-gold-3)">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </div>
          </div>

          <button
            (click)="findGame()"
            [disabled]="loading()"
            class="btn-gold w-full flex items-center justify-center gap-3"
          >
            @if (loading()) {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="animate-spin">
                <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
              </svg>
              <span>{{ 'home.form.submit.loading' | t }}</span>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <span>{{ 'home.form.submit' | t }}</span>
            }
          </button>

          @if (errorKey(); as key) {
            <div class="mt-5 p-4 rounded flex items-start gap-3 animate-in"
                 style="background: rgba(232, 64, 87, 0.1); border: 1px solid var(--lol-red);">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="var(--lol-red)" class="shrink-0 mt-0.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span class="text-sm" style="color: #FCA5A5;">{{ key | t }}</span>
            </div>
          }
        </div>

        <!-- Footer hint -->
        <div class="text-center mt-8 text-xs text-muted tracking-wider">
          <span class="inline-flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-cyan pulse-live" style="background-color: var(--lol-cyan);"></span>
            {{ 'home.hero.footerHint' | t }}
          </span>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- SEO content section — below the fold on desktop, visible on scroll. -->
    <!-- Natural H2/H3 + keyword-rich paragraphs feed Google's content model -->
    <!-- without stuffing. Each section corresponds to a keyword cluster from -->
    <!-- the target keyword list (counter-builds, roles, meta, adaptive).    -->
    <!-- ================================================================== -->
    <section class="seo-content">
      <div class="seo-content__inner">
        <h2 class="seo-h2">{{ 'home.seo.h2.features' | t }}</h2>
        <p class="seo-p">{{ 'home.seo.features.p1' | t }}</p>

        <h3 class="seo-h3">{{ 'home.seo.h3.counterBuild' | t }}</h3>
        <p class="seo-p">{{ 'home.seo.counterBuild.p1' | t }}</p>

        <h3 class="seo-h3">{{ 'home.seo.h3.rolesChampions' | t }}</h3>
        <p class="seo-p">{{ 'home.seo.rolesChampions.p1' | t }}</p>

        <h3 class="seo-h3">{{ 'home.seo.h3.metaBuilds' | t }}</h3>
        <p class="seo-p">{{ 'home.seo.metaBuilds.p1' | t }}</p>

        <h3 class="seo-h3">{{ 'home.seo.h3.adaptive' | t }}</h3>
        <p class="seo-p">{{ 'home.seo.adaptive.p1' | t }}</p>

        <p class="seo-disclaimer">{{ 'home.seo.disclaimer' | t }}</p>
      </div>
    </section>
  `,
  styles: [`
    /* SEO content — visible, not hidden. Google penalizes display:none text.
       Styled as a subtle dark backdrop under the hero so it's discoverable
       without competing visually with the primary CTA (search form). */
    .seo-content {
      position: relative;
      padding: 3rem 1rem 4rem;
      background: linear-gradient(180deg, rgba(1,10,19,0.95) 0%, rgba(1,10,19,1) 100%);
      border-top: 1px solid var(--lol-gold-5);
    }
    .seo-content__inner {
      max-width: 960px;
      margin: 0 auto;
    }
    .seo-h2 {
      font-family: 'Cinzel', serif;
      font-size: 1.5rem;
      line-height: 1.3;
      color: var(--lol-gold-2);
      margin-bottom: 1rem;
      letter-spacing: 0.02em;
    }
    .seo-h3 {
      font-family: 'Cinzel', serif;
      font-size: 1.1rem;
      line-height: 1.35;
      color: var(--lol-gold-3);
      margin-top: 2rem;
      margin-bottom: 0.6rem;
      letter-spacing: 0.01em;
    }
    .seo-p {
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      line-height: 1.7;
      color: var(--lol-text-muted);
      margin-bottom: 1rem;
    }
    .seo-disclaimer {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(200, 155, 60, 0.15);
      font-family: 'Inter', sans-serif;
      font-size: 0.72rem;
      line-height: 1.6;
      color: var(--lol-text-dim);
      font-style: italic;
    }
  `],
})
export class HomeComponent implements OnInit {
  private api = inject(ApiService);
  private gameState = inject(GameStateService);
  private router = inject(Router);
  private seo = inject(SeoService);

  // True only when running in a real browser. False during server-side
  // prerendering — so HTTP fetches and localStorage reads that would
  // otherwise crash the build can short-circuit cleanly. The static HTML
  // rendered on the server shows the loading state, and the client fills
  // in real data on hydration.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Key for persisting the last-used Riot ID + region in the browser.
  // Reloading the app or coming back later will auto-fill the form.
  private static readonly STORAGE_KEY = 'lol-build-recommender:search';

  gameName = '';
  tagLine = '';
  selectedRegion = 'euw1';
  regions = signal<Region[]>([]);
  loading = signal(false);
  // Error state holds a translation KEY, not a raw localized string. The
  // template pipes the key through `| t` so switching language flips the
  // error message in place without needing a re-fetch.
  errorKey = signal<TranslationKey | null>(null);

  ngOnInit() {
    // SEO — home is the primary landing page and the canonical for
    // "lol build recommender" style queries. Keep the description packed with
    // the keywords users actually search for.
    // This runs on both server (prerender) and client — the SEO service
    // sets <meta> tags via the DOM token which Angular's server renderer
    // provides as a synthetic DOM, so meta tags correctly land in the
    // prerendered HTML.
    this.seo.updatePageMeta({
      title: 'DraftSense — LoL Builds & Counter Items | League of Legends',
      description: 'Free LoL build tool. Counter items based on enemy team comp — anti-heal, tenacity, armor & MR picks. Challenger meta builds for every champion and role.',
      url: 'https://draftsense.net/',
    });

    // Everything below touches localStorage or fires HTTP — both would
    // fail during server-side prerendering. Skip on the server, run on
    // the client. The initial paint from the prerendered HTML shows the
    // form with hardcoded default region fallback baked in, and client
    // hydration replaces it with fresh Riot data.
    if (!this.isBrowser) return;

    // Restore the last-used search from localStorage before any network calls.
    this.loadSavedSearch();

    this.api.getRegions().subscribe({
      next: (regions) => this.regions.set(regions),
      error: () => {
        this.regions.set([
          { id: 'euw1', name: 'Europe West' },
          { id: 'eun1', name: 'Europe Nordic & East' },
          { id: 'na1', name: 'North America' },
          { id: 'kr', name: 'Korea' },
          { id: 'br1', name: 'Brazil' },
        ]);
      },
    });

    this.api.getVersion().subscribe({
      next: (v) => this.gameState.ddragonVersion.set(v.replace(/"/g, '')),
    });
  }

  private loadSavedSearch() {
    try {
      const raw = localStorage.getItem(HomeComponent.STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { gameName?: string; tagLine?: string; region?: string };
      if (data.gameName) this.gameName = data.gameName;
      if (data.tagLine) this.tagLine = data.tagLine;
      if (data.region) this.selectedRegion = data.region;
    } catch {
      // Corrupted JSON or no storage access — ignore and use defaults.
    }
  }

  private saveSearch(gameName: string, tagLine: string, region: string) {
    try {
      localStorage.setItem(
        HomeComponent.STORAGE_KEY,
        JSON.stringify({ gameName, tagLine, region }),
      );
    } catch {
      // Private-mode / storage blocked — ignore, auto-fill is a convenience.
    }
  }

  findGame() {
    if (!this.gameName.trim() || !this.tagLine.trim()) {
      this.errorKey.set('home.form.error.emptyFields');
      return;
    }

    this.loading.set(true);
    this.errorKey.set(null);

    const gameName = this.gameName.trim();
    const tagLine = this.tagLine.trim();
    const region = this.selectedRegion;

    // Persist before the request — so even if the game fetch fails (player not in game),
    // the next visit still remembers the last Riot ID.
    this.saveSearch(gameName, tagLine, region);

    this.api.findActiveGame(gameName, tagLine, region).subscribe({
      next: (game) => {
        this.loading.set(false);
        this.gameState.game.set(game);
        // Persist search params in the URL so a page refresh can re-fetch the game.
        this.router.navigate(['/game'], { queryParams: { gameName, tagLine, region } });
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.errorKey.set('home.form.error.notInGame');
        } else if (err.status === 403 || err.status === 401) {
          this.errorKey.set('home.form.error.apiKey');
        } else {
          this.errorKey.set('home.form.error.generic');
        }
      },
    });
  }
}
