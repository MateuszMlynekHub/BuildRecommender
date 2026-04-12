import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SeoService } from '../../core/services/seo.service';
import { environment } from '../../../environments/environment';

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
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ss-page">
      <div class="ss-container">
        <div class="ss-hero">
          <div class="ss-hero__icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="var(--lol-gold-3)">
              <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </div>
          <h1 class="ss-hero__title">Summoner Lookup</h1>
          <p class="ss-hero__sub">Search any player by Riot ID</p>
        </div>

        <div class="ss-form">
          <div class="ss-form__row">
            <input type="text" class="ss-form__input ss-form__input--name" placeholder="Game Name"
              [(ngModel)]="gameName" (keyup.enter)="search()" />
            <span class="ss-form__hash">#</span>
            <input type="text" class="ss-form__input ss-form__input--tag" placeholder="Tag"
              [(ngModel)]="tagLine" (keyup.enter)="search()" />
          </div>
          <div class="ss-form__row">
            <select class="ss-form__select" [(ngModel)]="region">
              @for (r of regions; track r.id) {
                <option [value]="r.id">{{ r.name }}</option>
              }
            </select>
            <button class="ss-form__btn" (click)="search()" [disabled]="!canSearch() || searching()">
              @if (searching()) {
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="spin">
                  <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
              }
              Search
            </button>
          </div>
          @if (error()) {
            <div class="ss-form__error">{{ error() }}</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ss-page { min-height: 100vh; padding: 2rem 1rem; display: flex; align-items: center; justify-content: center; }
    .ss-container { max-width: 480px; width: 100%; }
    .ss-hero { text-align: center; margin-bottom: 2rem; }
    .ss-hero__icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 80px; height: 80px; margin-bottom: 0.75rem; border-radius: 50%;
      border: 2px solid var(--lol-gold-3); background: radial-gradient(circle, rgba(200,155,60,0.2), transparent 70%);
    }
    .ss-hero__title { font-family: 'Cinzel', serif; font-size: 1.8rem; color: var(--lol-gold-1); }
    .ss-hero__sub { color: var(--lol-text-muted); font-size: 0.82rem; margin-top: 0.3rem; }
    .ss-form {
      padding: 1.5rem; background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5);
      border-radius: 2px; box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    }
    .ss-form__row { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; }
    .ss-form__hash { color: var(--lol-gold-3); font-size: 1.2rem; font-weight: 700; }
    .ss-form__input {
      flex: 1; padding: 0.65rem 0.85rem; font-size: 0.9rem; color: var(--lol-gold-1);
      background: rgba(1,10,19,0.7); border: 1px solid var(--lol-gold-5); border-radius: 2px;
      font-family: 'Inter', sans-serif;
    }
    .ss-form__input:focus { outline: none; border-color: var(--lol-gold-3); }
    .ss-form__input::placeholder { color: var(--lol-text-dim); }
    .ss-form__input--name { flex: 3; }
    .ss-form__input--tag { flex: 1; min-width: 60px; text-transform: uppercase; }
    .ss-form__select {
      flex: 1; padding: 0.65rem; font-size: 0.85rem; color: var(--lol-gold-1);
      background: rgba(1,10,19,0.7); border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .ss-form__btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.65rem 1.25rem; font-family: 'Cinzel', serif; font-size: 0.78rem;
      font-weight: 600; letter-spacing: 0.06em; color: var(--lol-gold-1);
      background: linear-gradient(180deg, rgba(200,155,60,0.3), rgba(200,155,60,0.15));
      border: 1px solid var(--lol-gold-3); border-radius: 2px; cursor: pointer;
    }
    .ss-form__btn:hover:not(:disabled) { background: linear-gradient(180deg, rgba(200,155,60,0.4), rgba(200,155,60,0.2)); }
    .ss-form__btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ss-form__error {
      padding: 0.6rem 0.8rem; border-radius: 2px; background: rgba(232,64,87,0.08);
      border: 1px solid rgba(232,64,87,0.3); color: #FCA5A5; font-size: 0.78rem; text-align: center;
    }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `],
})
export class SummonerSearchComponent implements OnInit {
  private router = inject(Router);
  private seo = inject(SeoService);
  private http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private baseUrl = environment.apiUrl;

  readonly regions = REGIONS;
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
