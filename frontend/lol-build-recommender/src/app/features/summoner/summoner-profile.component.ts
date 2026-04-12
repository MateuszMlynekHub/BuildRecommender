import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SeoService } from '../../core/services/seo.service';
import { environment } from '../../../environments/environment';
import { TPipe } from '../../shared/pipes/t.pipe';

interface MatchParticipant {
  puuid: string;
  championId: number;
  championName: string;
  championImage: string;
  teamPosition: string;
  teamId: number;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  items: number[];
}

interface MatchData {
  matchId: string;
  gameVersion: string;
  participants: MatchParticipant[];
}

interface SummonerProfile {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  matchCount: number;
  recentMatches: MatchData[];
}

@Component({
  selector: 'app-summoner-profile',
  standalone: true,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sp-page">
      <div class="sp-container">
        @if (loading()) {
          <div class="sp-loading">
            <div class="shimmer" style="width:80px;height:80px;border-radius:50%;margin:2rem auto"></div>
            <div class="shimmer" style="width:200px;height:20px;margin:1rem auto;border-radius:2px"></div>
          </div>
        } @else if (error()) {
          <div class="sp-error">{{ error() }}</div>
        } @else if (profile()) {
          @let p = profile()!;
          <div class="sp-hero">
            <div class="sp-hero__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="var(--lol-gold-3)">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <h1 class="sp-hero__name">{{ p.gameName }}<span class="sp-hero__tag">#{{ p.tagLine }}</span></h1>
            <p class="sp-hero__region">{{ p.region }} — {{ p.matchCount }} ranked matches</p>
          </div>

          @if (p.recentMatches.length > 0) {
            <section class="sp-section">
              <h2 class="sp-section__title">Recent Matches</h2>
              @for (match of p.recentMatches; track match.matchId) {
                @let me = getPlayer(match, p.puuid);
                <div class="sp-match" [class.sp-match--win]="me?.win" [class.sp-match--loss]="me && !me.win">
                  @if (me) {
                    <div class="sp-match__hero">
                      <img class="sp-match__champ" [src]="me.championImage" [alt]="me.championName" width="40" height="40" />
                      <div class="sp-match__info">
                        <div class="sp-match__name">{{ me.championName }}</div>
                        <div class="sp-match__kda">{{ me.kills }}/{{ me.deaths }}/{{ me.assists }}</div>
                      </div>
                      <div class="sp-match__result" [class.sp-match__result--win]="me.win">{{ me.win ? 'Victory' : 'Defeat' }}</div>
                      <div class="sp-match__role">{{ me.teamPosition }}</div>
                    </div>
                  }
                  <div class="sp-match__teams">
                    <div class="sp-match__team">
                      @for (part of getTeam(match, 100); track part.puuid) {
                        <div class="sp-match__player" [class.sp-match__player--me]="part.puuid === p.puuid">
                          <img [src]="part.championImage" [alt]="part.championName" width="22" height="22" loading="lazy" />
                          <span>{{ part.championName }}</span>
                          <span class="sp-match__player-kda">{{ part.kills }}/{{ part.deaths }}/{{ part.assists }}</span>
                        </div>
                      }
                    </div>
                    <div class="sp-match__vs">VS</div>
                    <div class="sp-match__team">
                      @for (part of getTeam(match, 200); track part.puuid) {
                        <div class="sp-match__player" [class.sp-match__player--me]="part.puuid === p.puuid">
                          <img [src]="part.championImage" [alt]="part.championName" width="22" height="22" loading="lazy" />
                          <span>{{ part.championName }}</span>
                          <span class="sp-match__player-kda">{{ part.kills }}/{{ part.deaths }}/{{ part.assists }}</span>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </section>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .sp-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .sp-container { max-width: 800px; margin: 0 auto; }
    .sp-loading { padding: 4rem 1rem; }
    .sp-error {
      padding: 2rem; text-align: center; color: #E84057;
      border: 1px solid rgba(232,64,87,0.3); border-radius: 2px;
      background: rgba(232,64,87,0.06); margin-top: 2rem;
    }

    .sp-hero { text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--lol-gold-5); }
    .sp-hero__icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 80px; height: 80px; margin-bottom: 0.75rem; border-radius: 50%;
      border: 2px solid var(--lol-gold-3); background: radial-gradient(circle, rgba(200,155,60,0.2), transparent 70%);
    }
    .sp-hero__name { font-family: 'Cinzel', serif; font-size: 1.8rem; color: var(--lol-gold-1); }
    .sp-hero__tag { color: var(--lol-text-muted); font-size: 1rem; }
    .sp-hero__region { color: var(--lol-text-muted); font-size: 0.82rem; margin-top: 0.3rem; }

    .sp-section__title {
      font-family: 'Cinzel', serif; font-size: 0.85rem; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--lol-gold-2); margin-bottom: 0.75rem;
      padding-bottom: 0.4rem; border-bottom: 1px solid var(--lol-gold-5);
    }

    .sp-match {
      margin-bottom: 0.6rem; padding: 0.6rem; background: rgba(1,10,19,0.55);
      border: 1px solid var(--lol-gold-5); border-radius: 2px; border-left: 3px solid var(--lol-gold-5);
    }
    .sp-match--win { border-left-color: #50E3C2; }
    .sp-match--loss { border-left-color: #E84057; }

    .sp-match__hero {
      display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;
      padding-bottom: 0.5rem; border-bottom: 1px solid rgba(120,90,40,0.1);
    }
    .sp-match__champ { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--lol-gold-4); }
    .sp-match__name { font-weight: 600; font-size: 0.88rem; color: var(--lol-gold-1); }
    .sp-match__kda { font-size: 0.78rem; color: var(--lol-text-muted); font-weight: 500; }
    .sp-match__result { margin-left: auto; font-family: 'Cinzel', serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; }
    .sp-match__result--win { color: #50E3C2; }
    .sp-match__result:not(.sp-match__result--win) { color: #E84057; }
    .sp-match__role { font-size: 0.6rem; color: var(--lol-text-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 50px; text-align: right; }

    .sp-match__teams { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; align-items: start; }
    .sp-match__team { display: flex; flex-direction: column; gap: 0.15rem; }
    .sp-match__vs { font-size: 0.6rem; color: var(--lol-text-dim); font-weight: 700; padding-top: 0.5rem; text-align: center; }
    .sp-match__player {
      display: flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; color: var(--lol-gold-1);
      padding: 0.1rem 0.2rem; border-radius: 2px;
    }
    .sp-match__player--me { background: rgba(200,155,60,0.12); font-weight: 600; }
    .sp-match__player img { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .sp-match__player span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sp-match__player-kda { margin-left: auto; color: var(--lol-text-muted); font-size: 0.62rem; flex-shrink: 0; }
  `],
})
export class SummonerProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private baseUrl = environment.apiUrl;

  readonly profile = signal<SummonerProfile | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const region = this.route.snapshot.paramMap.get('region') ?? 'euw1';
    const name = this.route.snapshot.paramMap.get('name') ?? '';
    const parts = name.split('-');
    const gameName = parts.slice(0, -1).join('-') || parts[0];
    const tagLine = parts[parts.length - 1] || 'EUW';

    this.seo.updatePageMeta({
      title: `${gameName}#${tagLine} — Summoner Profile | DraftSense`,
      description: `League of Legends summoner profile for ${gameName}#${tagLine}. Match history, KDA, and champion stats.`,
    });

    if (!this.isBrowser) return;

    this.http.get<SummonerProfile>(`${this.baseUrl}/game/summoner`, {
      params: { gameName, tagLine, region },
    }).subscribe({
      next: (data) => { this.profile.set(data); this.loading.set(false); },
      error: (err) => {
        this.error.set(err.status === 404 ? 'Summoner not found' : 'Failed to load profile');
        this.loading.set(false);
      },
    });
  }

  getPlayer(match: MatchData, puuid: string): MatchParticipant | undefined {
    return match.participants.find(p => p.puuid === puuid);
  }

  getTeam(match: MatchData, teamId: number): MatchParticipant[] {
    return match.participants.filter(p => p.teamId === teamId);
  }
}
