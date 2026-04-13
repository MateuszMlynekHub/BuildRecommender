import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SeoService } from '../../core/services/seo.service';
import { environment } from '../../../environments/environment';

interface MasteryEntry {
  championId: number;
  championName: string;
  championImage: string;
  championLevel: number;
  championPoints: number;
}

@Component({
  selector: 'app-summoner-mastery',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sm">
      <div class="sm__c">
        <div class="sm__hdr">
          <a [routerLink]="['/summoner', region, name]" class="sm__back">&larr; Back to profile</a>
          <h1 class="sm__title">Champion Mastery</h1>
          <p class="sm__sub">{{ displayName }}</p>
        </div>

        @if (loading()) {
          <div class="sm__loading">Loading masteries...</div>
        } @else if (masteries().length === 0) {
          <div class="sm__empty">No mastery data available.</div>
        } @else {
          <div class="sm__total">{{ masteries().length }} champions played &mdash; {{ totalPoints() | number }} total points</div>
          <div class="sm__grid">
            <div class="sm__row sm__row--hdr">
              <span class="sm__col sm__col--rank">#</span>
              <span class="sm__col sm__col--champ">Champion</span>
              <span class="sm__col sm__col--lvl">Level</span>
              <span class="sm__col sm__col--pts">Points</span>
            </div>
            @for (m of masteries(); track m.championId; let i = $index) {
              <div class="sm__row" [class.sm__row--top3]="i < 3">
                <span class="sm__col sm__col--rank">{{ i + 1 }}</span>
                <span class="sm__col sm__col--champ">
                  <img [src]="m.championImage" width="32" height="32" class="sm__img" />
                  {{ m.championName }}
                </span>
                <span class="sm__col sm__col--lvl">
                  <img [src]="masteryIcon(m.championLevel)" width="24" height="24" />
                  {{ m.championLevel }}
                </span>
                <span class="sm__col sm__col--pts">{{ fmtPts(m.championPoints) }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .sm{min-height:100vh;padding:2rem 1rem 3rem}.sm__c{max-width:700px;margin:0 auto}
    .sm__hdr{margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--lol-gold-5)}
    .sm__back{font-size:.7rem;color:var(--lol-gold-3);text-decoration:none;transition:color .15s}.sm__back:hover{color:var(--lol-gold-1)}
    .sm__title{font-family:'Cinzel',serif;font-size:1.4rem;color:var(--lol-gold-1);margin:.3rem 0 .2rem}
    .sm__sub{font-size:.8rem;color:var(--lol-text-muted)}
    .sm__total{font-size:.7rem;color:var(--lol-text-muted);margin-bottom:.6rem}
    .sm__loading,.sm__empty{padding:3rem 1rem;text-align:center;color:var(--lol-text-muted)}
    .sm__grid{display:flex;flex-direction:column;gap:1px}
    .sm__row{display:flex;align-items:center;padding:.45rem .5rem;background:rgba(1,10,19,.55);border:1px solid var(--lol-gold-5);border-radius:2px;font-size:.75rem;color:var(--lol-gold-1)}
    .sm__row--hdr{font-size:.6rem;color:var(--lol-text-dim);text-transform:uppercase;letter-spacing:.06em;background:transparent;border:none;padding-bottom:.2rem}
    .sm__row--top3{background:rgba(200,155,60,.06);border-color:var(--lol-gold-4)}
    .sm__col--rank{width:32px;text-align:center;font-weight:700;color:var(--lol-text-muted);flex-shrink:0}
    .sm__col--champ{flex:1;display:flex;align-items:center;gap:.4rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sm__col--lvl{width:60px;display:flex;align-items:center;gap:.25rem;justify-content:center;flex-shrink:0}
    .sm__col--pts{width:70px;text-align:right;font-weight:600;color:var(--lol-cyan);flex-shrink:0}
    .sm__img{width:32px;height:32px;border-radius:50%;border:2px solid var(--lol-gold-5);flex-shrink:0}
  `],
})
export class SummonerMasteryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private baseUrl = environment.apiUrl;

  region = '';
  name = '';
  displayName = '';

  readonly masteries = signal<MasteryEntry[]>([]);
  readonly loading = signal(true);
  readonly totalPoints = signal(0);

  ngOnInit(): void {
    this.region = this.route.snapshot.paramMap.get('region') ?? 'euw1';
    this.name = this.route.snapshot.paramMap.get('name') ?? '';
    const parts = this.name.split('-');
    const gameName = parts.slice(0, -1).join('-') || parts[0];
    const tagLine = parts[parts.length - 1] || 'EUW';
    this.displayName = `${gameName}#${tagLine}`;

    this.seo.updatePageMeta({
      title: `${gameName}#${tagLine} — Champion Mastery | DraftSense`,
      description: `Full champion mastery list for ${gameName}#${tagLine}.`,
    });

    if (!this.isBrowser) return;
    this.http.get<MasteryEntry[]>(`${this.baseUrl}/game/mastery`, {
      params: { gameName, tagLine, region: this.region },
    }).subscribe({
      next: (data) => {
        this.masteries.set(data);
        this.totalPoints.set(data.reduce((sum, m) => sum + m.championPoints, 0));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  masteryIcon(level: number) {
    const mapped = level >= 10 ? 10 : level >= 9 ? 9 : level >= 8 ? 8 : level >= 7 ? 7 : level >= 6 ? 6 : level >= 5 ? 5 : level >= 4 ? 4 : 0;
    return `https://raw.communitydragon.org/latest/game/assets/ux/mastery/legendarychampionmastery/masterycrest_level${mapped}_minis.cm_updates.png`;
  }

  fmtPts(pts: number) { return pts >= 1000 ? (pts / 1000).toFixed(1) + 'k' : pts.toString(); }
}
