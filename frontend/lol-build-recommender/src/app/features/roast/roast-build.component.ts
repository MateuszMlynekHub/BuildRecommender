import { Component, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { TranslationService } from '../../core/services/translation.service';
import { TPipe } from '../../shared/pipes/t.pipe';
import { LolSelectComponent, SelectOption } from '../../shared/components/lol-select.component';
import { Region } from '../../core/models/region.model';
import { environment } from '../../../environments/environment';

interface RoastResult {
  score: number;
  grade: string;
  championName: string;
  actualItems: RoastItem[];
  optimalItems: RoastItem[];
  goodChoices: string[];
  badChoices: string[];
  roastComment: string;
}

interface RoastItem {
  itemId: number;
  itemName: string;
  imageUrl: string;
  isCorrect: boolean;
}

@Component({
  selector: 'app-roast-build',
  standalone: true,
  imports: [FormsModule, TPipe, LolSelectComponent],
  template: `
    <div class="roast-container">
      <h1 class="roast-title">{{ 'roast.title' | t }}</h1>
      <p class="roast-subtitle">{{ 'roast.subtitle' | t }}</p>

      <div class="roast-input-area">
        <div class="roast-form">
          <div class="roast-field">
            <label class="roast-label">{{ 'roast.inputLabel' | t }}</label>
            <div class="roast-id-row">
              <input class="roast-input" type="text" [(ngModel)]="gameName" placeholder="Name" />
              <span class="roast-hash">#</span>
              <input class="roast-input roast-input--tag" type="text" [(ngModel)]="tagLine" placeholder="Tag" />
            </div>
          </div>
          <div class="roast-field">
            <app-lol-select
              [options]="regionOptions()"
              [value]="selectedRegion"
              (valueChange)="selectedRegion = $event"
              size="sm"
            ></app-lol-select>
          </div>
          <button class="roast-analyze-btn" (click)="analyze()" [disabled]="loading()">
            @if (loading()) { <span class="roast-spinner"></span> }
            {{ 'roast.analyze' | t }}
          </button>
        </div>
      </div>

      @if (result()) {
        <div class="roast-card" [class]="'roast-card roast-grade-' + result()!.grade.toLowerCase()">
          <div class="roast-card-header">
            <div class="roast-grade-circle">
              <span class="roast-grade">{{ result()!.grade }}</span>
              <span class="roast-score-num">{{ result()!.score }}/100</span>
            </div>
            <div class="roast-card-info">
              <div class="roast-card-title">BUILD REPORT CARD</div>
              <div class="roast-card-champ">{{ result()!.championName }}</div>
            </div>
          </div>

          <div class="roast-builds-compare">
            <div class="roast-build-col">
              <div class="roast-col-label">{{ 'roast.actual' | t }}</div>
              <div class="roast-items-row">
                @for (item of result()!.actualItems; track item.itemId) {
                  <div class="roast-item" [class.roast-item--correct]="item.isCorrect" [class.roast-item--wrong]="!item.isCorrect">
                    <img [src]="item.imageUrl" width="36" height="36" class="roast-item-img" [title]="item.itemName" />
                  </div>
                }
              </div>
            </div>
            <div class="roast-build-col">
              <div class="roast-col-label">{{ 'roast.optimal' | t }}</div>
              <div class="roast-items-row">
                @for (item of result()!.optimalItems; track item.itemId) {
                  <div class="roast-item">
                    <img [src]="item.imageUrl" width="36" height="36" class="roast-item-img" [title]="item.itemName" />
                  </div>
                }
              </div>
            </div>
          </div>

          @if (result()!.goodChoices.length > 0) {
            <div class="roast-feedback roast-feedback--good">
              @for (msg of result()!.goodChoices; track $index) {
                <div class="roast-fb-item">&#10003; {{ msg }}</div>
              }
            </div>
          }
          @if (result()!.badChoices.length > 0) {
            <div class="roast-feedback roast-feedback--bad">
              @for (msg of result()!.badChoices; track $index) {
                <div class="roast-fb-item">&#10007; {{ msg }}</div>
              }
            </div>
          }

          @if (result()!.roastComment) {
            <div class="roast-comment">"{{ result()!.roastComment }}"</div>
          }

          <button class="roast-share-btn" (click)="copyToClipboard()">
            {{ 'roast.share' | t }}
          </button>
        </div>
      }

      @if (error()) {
        <div class="roast-error">{{ error() }}</div>
      }
    </div>
  `,
  styles: [`
    .roast-container { max-width: 700px; margin: 2rem auto; padding: 0 1rem; }
    .roast-title { font-size: 1.5rem; font-weight: 700; color: var(--lol-gold-1); margin-bottom: 0.25rem; }
    .roast-subtitle { font-size: 0.85rem; color: var(--lol-text-muted); margin-bottom: 1.5rem; }

    .roast-input-area {
      background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5);
      border-radius: 4px; padding: 1rem; margin-bottom: 1.5rem;
    }
    .roast-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end; }
    .roast-field { display: flex; flex-direction: column; gap: 0.25rem; }
    .roast-label { font-size: 0.75rem; color: var(--lol-gold-3); font-weight: 600; }
    .roast-id-row { display: flex; align-items: center; gap: 0; }
    .roast-input {
      background: rgba(0,0,0,0.3); border: 1px solid var(--lol-gold-5);
      color: var(--lol-text-primary, #ccc); padding: 0.4rem 0.6rem; font-size: 0.85rem;
      border-radius: 3px 0 0 3px; width: 150px;
    }
    .roast-input--tag { border-radius: 0 3px 3px 0; width: 80px; }
    .roast-hash { color: var(--lol-gold-3); font-weight: 700; padding: 0 4px; background: rgba(0,0,0,0.3); border-top: 1px solid var(--lol-gold-5); border-bottom: 1px solid var(--lol-gold-5); line-height: 2.1; }
    .roast-select {
      background: rgba(0,0,0,0.4); color: var(--lol-gold-3); border: 1px solid var(--lol-gold-5);
      border-radius: 3px; padding: 0.4rem 0.6rem; font-size: 0.85rem;
    }
    .roast-analyze-btn {
      background: linear-gradient(135deg, #f44336, #d32f2f);
      color: #fff; border: none; border-radius: 3px; padding: 0.5rem 1.5rem;
      font-weight: 700; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;
    }
    .roast-analyze-btn:disabled { opacity: 0.5; }
    .roast-spinner {
      display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .roast-card {
      background: rgba(1,10,19,0.7); border: 2px solid var(--lol-gold-3);
      border-radius: 8px; padding: 1.5rem; position: relative; overflow: hidden;
    }
    .roast-grade-a, .roast-grade-s { border-color: #4caf50; }
    .roast-grade-b { border-color: var(--lol-gold-3); }
    .roast-grade-c { border-color: #ff9800; }
    .roast-grade-d, .roast-grade-f { border-color: #f44336; }

    .roast-card-header { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
    .roast-grade-circle {
      width: 70px; height: 70px; border-radius: 50%; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(200,170,110,0.1); border: 2px solid var(--lol-gold-3);
    }
    .roast-grade { font-size: 1.8rem; font-weight: 900; color: var(--lol-gold-1); line-height: 1; }
    .roast-score-num { font-size: 0.65rem; color: var(--lol-text-muted); }
    .roast-card-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lol-gold-3); }
    .roast-card-champ { font-size: 1.1rem; font-weight: 700; color: var(--lol-gold-1); }

    .roast-builds-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    .roast-col-label { font-size: 0.7rem; text-transform: uppercase; color: var(--lol-gold-3); margin-bottom: 0.3rem; font-weight: 700; }
    .roast-items-row { display: flex; gap: 4px; flex-wrap: wrap; }
    .roast-item { position: relative; }
    .roast-item-img { border-radius: 3px; border: 2px solid transparent; }
    .roast-item--correct .roast-item-img { border-color: #4caf50; }
    .roast-item--wrong .roast-item-img { border-color: #f44336; }

    .roast-feedback { margin-bottom: 0.5rem; }
    .roast-feedback--good .roast-fb-item { color: #4caf50; font-size: 0.8rem; padding: 0.15rem 0; }
    .roast-feedback--bad .roast-fb-item { color: #f44336; font-size: 0.8rem; padding: 0.15rem 0; }

    .roast-comment {
      font-style: italic; color: var(--lol-text-muted); font-size: 0.9rem;
      padding: 0.75rem; background: rgba(0,0,0,0.3); border-radius: 4px;
      margin: 0.75rem 0; text-align: center;
    }

    .roast-share-btn {
      background: linear-gradient(135deg, var(--lol-gold-3), var(--lol-gold-5));
      color: #0a0a0a; border: none; border-radius: 3px; padding: 0.5rem 1.5rem;
      font-weight: 700; cursor: pointer; font-size: 0.85rem; width: 100%; margin-top: 0.5rem;
    }

    .roast-error { color: var(--lol-red, #f44336); text-align: center; padding: 1rem; }
  `],
})
export class RoastBuildComponent {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly baseUrl = environment.apiUrl;

  gameName = '';
  tagLine = '';
  selectedRegion = 'euw1';
  readonly loading = signal(false);
  readonly result = signal<RoastResult | null>(null);
  readonly error = signal('');
  readonly regions = signal<Region[]>([]);
  readonly regionOptions = computed<SelectOption[]>(() =>
    this.regions().map(r => ({ value: r.id, label: r.name }))
  );

  ngOnInit() {
    this.api.getRegions().subscribe({ next: (r) => this.regions.set(r) });
  }

  analyze() {
    if (!this.gameName || !this.tagLine) return;

    this.loading.set(true);
    this.error.set('');
    this.result.set(null);

    this.http.get<RoastResult>(`${this.baseUrl}/build/roast`, {
      params: {
        gameName: this.gameName,
        tagLine: this.tagLine,
        region: this.selectedRegion,
      },
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to analyze build');
        this.loading.set(false);
      },
    });
  }

  copyToClipboard() {
    if (!this.isBrowser || !this.result()) return;
    const r = this.result()!;
    const text = `BUILD REPORT CARD - ${r.championName}\nScore: ${r.grade} (${r.score}/100)\n${r.roastComment}\n\nCheck your build at DraftSense!`;
    navigator.clipboard.writeText(text);
  }
}
