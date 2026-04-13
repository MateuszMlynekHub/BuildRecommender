import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SeoService } from '../../core/services/seo.service';
import { environment } from '../../../environments/environment';
import { LolSelectComponent, SelectOption } from '../../shared/components/lol-select.component';

const REGIONS = [
  { id: 'euw1', name: 'EU West' },
  { id: 'eun1', name: 'EU Nordic & East' },
  { id: 'na1', name: 'North America' },
  { id: 'kr', name: 'Korea' },
  { id: 'br1', name: 'Brazil' },
  { id: 'jp1', name: 'Japan' },
  { id: 'la1', name: 'LAN' },
  { id: 'la2', name: 'LAS' },
  { id: 'oc1', name: 'Oceania' },
  { id: 'tr1', name: 'Turkey' },
  { id: 'ru', name: 'Russia' },
];

const STORAGE_KEY = 'draftsense:summoner-search';

@Component({
  selector: 'app-summoner-search',
  standalone: true,
  imports: [FormsModule, LolSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-lg relative animate-in">
        <!-- Logo + title -->
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-full gold-border-bright" style="background: radial-gradient(circle, rgba(200,155,60,0.25), transparent 70%);">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="44" fill="var(--lol-gold-3)">
              <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </div>
          <h1 class="text-4xl md:text-5xl font-display text-gold-lite tracking-wide mb-3">Summoner Lookup</h1>
          <div class="gold-divider mb-3">
            <span class="text-gold text-lg">&#9670;</span>
          </div>
          <p class="text-muted text-sm md:text-base tracking-wide">Search any player by Riot ID</p>
        </div>

        <!-- Main search card -->
        <div class="glass-card p-8 relative">
          <!-- Decorative corner ornaments -->
          <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2" style="border-color: var(--lol-gold-3);"></div>
          <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2" style="border-color: var(--lol-gold-3);"></div>
          <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2" style="border-color: var(--lol-gold-3);"></div>
          <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2" style="border-color: var(--lol-gold-3);"></div>

          <div class="mb-6">
            <label class="block text-xs font-display uppercase tracking-widest mb-2 text-gold-soft">Riot ID</label>
            <div class="flex gap-2 items-stretch">
              <input
                type="text"
                [(ngModel)]="gameName"
                placeholder="Game Name"
                class="lol-input min-w-0"
                style="flex: 7 1 0%;"
                (keyup.enter)="search()"
              />
              <span class="flex items-center px-1 text-gold text-2xl font-display shrink-0">#</span>
              <input
                type="text"
                [(ngModel)]="tagLine"
                placeholder="Tag"
                class="lol-input min-w-0 uppercase"
                style="flex: 3 1 0%;"
                (keyup.enter)="search()"
              />
            </div>
          </div>

          <div class="mb-8">
            <label class="block text-xs font-display uppercase tracking-widest mb-2 text-gold-soft">Region</label>
            <app-lol-select
              [options]="regionOptions"
              [value]="region"
              (valueChange)="region = $event"
              [fullWidth]="true"
            ></app-lol-select>
          </div>

          <button
            (click)="search()"
            [disabled]="!canSearch() || searching()"
            class="btn-gold w-full flex items-center justify-center gap-3"
          >
            @if (searching()) {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="animate-spin">
                <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
              </svg>
              <span>Searching...</span>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <span>Search</span>
            }
          </button>

          @if (error()) {
            <div class="mt-5 p-4 rounded flex items-start gap-3 animate-in"
                 style="background: rgba(232, 64, 87, 0.1); border: 1px solid var(--lol-red);">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="var(--lol-red)" class="shrink-0 mt-0.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span class="text-sm" style="color: #FCA5A5;">{{ error() }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class SummonerSearchComponent implements OnInit {
  private router = inject(Router);
  private seo = inject(SeoService);
  private http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private baseUrl = environment.apiUrl;

  readonly regions = REGIONS;
  readonly regionOptions: SelectOption[] = REGIONS.map(r => ({ value: r.id, label: r.name }));
  gameName = '';
  tagLine = '';
  region = 'euw1';
  readonly error = signal<string | null>(null);
  readonly searching = signal(false);

  ngOnInit(): void {
    this.seo.updatePageMeta({
      title: 'Summoner Lookup — Search Any Player | DraftSense',
      description: 'Search any League of Legends player by Riot ID. View match history, rank, KDA, and more.',
      url: 'https://draftsense.net/summoner',
    });
    this.loadSavedSearch();
  }

  canSearch(): boolean {
    return this.gameName.trim().length > 0 && this.tagLine.trim().length > 0;
  }

  search(): void {
    const name = this.gameName.trim();
    const tag = this.tagLine.trim();
    if (!name || !tag) { this.error.set('Enter both Game Name and Tag'); return; }

    this.error.set(null);
    this.searching.set(true);
    this.saveSearch();

    // Validate summoner exists before navigating
    this.http.get(`${this.baseUrl}/game/summoner`, {
      params: { gameName: name, tagLine: tag, region: this.region },
    }).subscribe({
      next: () => {
        this.searching.set(false);
        this.router.navigate(['/summoner', this.region, `${name}-${tag}`]);
      },
      error: (err) => {
        this.searching.set(false);
        if (err.status === 404) this.error.set('Summoner not found. Check name, tag, and region.');
        else if (err.status === 503) this.error.set('Riot API temporarily unavailable. Try again in a moment.');
        else this.error.set('Failed to find summoner. Please try again.');
      },
    });
  }

  private saveSearch(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        gameName: this.gameName, tagLine: this.tagLine, region: this.region,
      }));
    } catch {}
  }

  private loadSavedSearch(): void {
    if (!this.isBrowser) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { gameName?: string; tagLine?: string; region?: string };
      if (data.gameName) this.gameName = data.gameName;
      if (data.tagLine) this.tagLine = data.tagLine;
      if (data.region) this.region = data.region;
    } catch {}
  }
}
