import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SeoService } from '../../core/services/seo.service';
import { GameStateService } from '../../core/services/game-state.service';
import { environment } from '../../../environments/environment';

interface MatchParticipant {
  puuid: string; championId: number; championName: string; championImage: string;
  teamPosition: string; teamId: number;
  kills: number; deaths: number; assists: number;
  cs: number; wardsPlaced: number; damage: number; gold: number; level: number;
  win: boolean; items: number[];
}
interface MatchData { matchId: string; gameVersion: string; participants: MatchParticipant[]; }
interface RankedEntry { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number; }
interface SummonerProfile {
  puuid: string; gameName: string; tagLine: string; region: string;
  rankedEntries: RankedEntry[]; matchCount: number; recentMatches: MatchData[];
}

@Component({
  selector: 'app-summoner-profile',
  standalone: true,
  imports: [RouterLink],
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
          <a routerLink="/summoner" class="sp-back">Back to search</a>
        } @else if (profile()) {
          @let p = profile()!;

          <!-- Header -->
          <div class="sp-header">
            <div class="sp-header__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="var(--lol-gold-3)">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div class="sp-header__info">
              <h1 class="sp-header__name">{{ p.gameName }}<span class="sp-header__tag">#{{ p.tagLine }}</span></h1>
              <p class="sp-header__region">{{ p.region }}</p>
            </div>
          </div>

          <div class="sp-layout">
            <!-- Left: Rank -->
            <div class="sp-sidebar">
              @for (entry of p.rankedEntries; track entry.queueType) {
                <div class="sp-rank">
                  <div class="sp-rank__type">{{ entry.queueType === 'RANKED_SOLO_5x5' ? 'Ranked Solo/Duo' : 'Ranked Flex' }}</div>
                  <div class="sp-rank__tier">{{ entry.tier }} {{ entry.rank }}</div>
                  <div class="sp-rank__lp">{{ entry.leaguePoints }} LP</div>
                  <div class="sp-rank__record">{{ entry.wins }}W {{ entry.losses }}L — {{ winRatePct(entry) }}% WR</div>
                </div>
              }
              @if (p.rankedEntries.length === 0) {
                <div class="sp-rank"><div class="sp-rank__tier">Unranked</div></div>
              }
            </div>

            <!-- Right: Stats + Matches -->
            <div class="sp-main">
              <!-- Summary stats -->
              @if (stats()) {
                @let s = stats()!;
                <div class="sp-stats">
                  <div class="sp-stat-block">
                    <div class="sp-stat-block__label">{{ s.totalGames }}G {{ s.wins }}W {{ s.losses }}L</div>
                    <div class="sp-stat-block__wr" [class.sp-wr--good]="s.winRate >= 50">{{ s.winRate.toFixed(0) }}%</div>
                  </div>
                  <div class="sp-stat-block">
                    <div class="sp-stat-block__label">Avg KDA</div>
                    <div class="sp-stat-block__val">{{ s.avgKills.toFixed(1) }} / {{ s.avgDeaths.toFixed(1) }} / {{ s.avgAssists.toFixed(1) }}</div>
                  </div>
                  <div class="sp-stat-block">
                    <div class="sp-stat-block__label">Avg CS</div>
                    <div class="sp-stat-block__val">{{ s.avgCs.toFixed(0) }}</div>
                  </div>
                </div>
              }

              <!-- Match list -->
              <div class="sp-matches">
                @for (match of p.recentMatches; track match.matchId; let i = $index) {
                  @let me = getPlayer(match, p.puuid);
                  @if (me) {
                    <div class="sp-match" [class.sp-match--win]="me.win" [class.sp-match--loss]="!me.win">
                      <div class="sp-match__summary" (click)="toggleMatch(i)">
                        <img class="sp-match__champ" [src]="me.championImage" [alt]="me.championName" width="40" height="40" />
                        <div class="sp-match__core">
                          <div class="sp-match__champ-name">{{ me.championName }}</div>
                          <div class="sp-match__role">{{ me.teamPosition }}</div>
                        </div>
                        <div class="sp-match__kda">
                          <span>{{ me.kills }}/{{ me.deaths }}/{{ me.assists }}</span>
                          <span class="sp-match__kda-ratio">{{ kdaRatio(me) }} KDA</span>
                        </div>
                        <div class="sp-match__stats-mini">
                          <span>{{ me.cs }} CS</span>
                          <span>{{ me.wardsPlaced }} Wards</span>
                        </div>
                        <div class="sp-match__items-mini">
                          @for (itemId of me.items.slice(0, 6); track $index) {
                            <img [src]="gameState.getItemImageUrl(itemId + '.png')" width="22" height="22"
                              loading="lazy" class="sp-match__item-img" />
                          }
                        </div>
                        <div class="sp-match__result" [class.sp-match__result--win]="me.win">
                          {{ me.win ? 'Win' : 'Loss' }}
                        </div>
                        <div class="sp-match__expand">{{ expandedMatch() === i ? '▲' : '▼' }}</div>
                      </div>

                      @if (expandedMatch() === i) {
                        <div class="sp-match__detail">
                          <div class="sp-match__teams-grid">
                            @for (teamId of [100, 200]; track teamId) {
                              <div class="sp-match__team-col">
                                <div class="sp-match__team-header" [class.sp-match__team-header--blue]="teamId === 100" [class.sp-match__team-header--red]="teamId === 200">
                                  {{ teamId === 100 ? 'Blue Team' : 'Red Team' }}
                                  {{ getTeam(match, teamId)[0]?.win ? '(Victory)' : '(Defeat)' }}
                                </div>
                                @for (part of getTeam(match, teamId); track part.puuid) {
                                  <div class="sp-match__player" [class.sp-match__player--me]="part.puuid === p.puuid">
                                    <img [src]="part.championImage" width="24" height="24" class="sp-match__player-img" loading="lazy" />
                                    <span class="sp-match__player-name">{{ part.championName }}</span>
                                    <span class="sp-match__player-kda">{{ part.kills }}/{{ part.deaths }}/{{ part.assists }}</span>
                                    <span class="sp-match__player-cs">{{ part.cs }}cs</span>
                                    <span class="sp-match__player-dmg">{{ (part.damage / 1000).toFixed(1) }}k</span>
                                    <span class="sp-match__player-gold">{{ (part.gold / 1000).toFixed(1) }}k</span>
                                    <div class="sp-match__player-items">
                                      @for (itemId of part.items.slice(0, 6); track $index) {
                                        <img [src]="gameState.getItemImageUrl(itemId + '.png')" width="18" height="18" loading="lazy" />
                                      }
                                    </div>
                                  </div>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .sp-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .sp-container { max-width: 960px; margin: 0 auto; }
    .sp-loading { padding: 4rem 1rem; }
    .sp-error { padding: 2rem; text-align: center; color: #E84057; border: 1px solid rgba(232,64,87,0.3); border-radius: 2px; background: rgba(232,64,87,0.06); }
    .sp-back { display: block; text-align: center; margin-top: 1rem; color: var(--lol-gold-3); font-size: 0.82rem; }

    .sp-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--lol-gold-5); }
    .sp-header__icon {
      width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 2px solid var(--lol-gold-3); background: radial-gradient(circle, rgba(200,155,60,0.2), transparent 70%);
    }
    .sp-header__name { font-family: 'Cinzel', serif; font-size: 1.5rem; color: var(--lol-gold-1); }
    .sp-header__tag { color: var(--lol-text-muted); font-size: 0.9rem; }
    .sp-header__region { color: var(--lol-text-muted); font-size: 0.78rem; }

    .sp-layout { display: grid; grid-template-columns: 240px 1fr; gap: 1.25rem; }
    @media (max-width: 768px) { .sp-layout { grid-template-columns: 1fr; } }

    /* Rank sidebar */
    .sp-sidebar { display: flex; flex-direction: column; gap: 0.75rem; }
    .sp-rank {
      padding: 1rem; background: rgba(1,10,19,0.55); border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .sp-rank__type { font-size: 0.68rem; color: var(--lol-text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; }
    .sp-rank__tier { font-family: 'Cinzel', serif; font-size: 1.1rem; color: var(--lol-gold-1); font-weight: 700; }
    .sp-rank__lp { font-size: 0.82rem; color: var(--lol-cyan); font-weight: 600; margin-top: 0.2rem; }
    .sp-rank__record { font-size: 0.72rem; color: var(--lol-text-muted); margin-top: 0.3rem; }

    /* Stats summary */
    .sp-stats {
      display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;
    }
    .sp-stat-block {
      flex: 1; min-width: 100px; padding: 0.6rem; background: rgba(1,10,19,0.55);
      border: 1px solid var(--lol-gold-5); border-radius: 2px; text-align: center;
    }
    .sp-stat-block__label { font-size: 0.68rem; color: var(--lol-text-muted); margin-bottom: 0.2rem; }
    .sp-stat-block__wr { font-family: 'Cinzel', serif; font-size: 1.2rem; font-weight: 700; color: var(--lol-text-muted); }
    .sp-stat-block__val { font-size: 0.88rem; font-weight: 600; color: var(--lol-gold-1); }
    .sp-wr--good { color: var(--lol-cyan); }

    /* Match list */
    .sp-matches { display: flex; flex-direction: column; gap: 0.4rem; }
    .sp-match {
      background: rgba(1,10,19,0.55); border: 1px solid var(--lol-gold-5); border-radius: 2px;
      border-left: 3px solid var(--lol-gold-5); overflow: hidden;
    }
    .sp-match--win { border-left-color: #50E3C2; }
    .sp-match--loss { border-left-color: #E84057; }

    .sp-match__summary {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.6rem; cursor: pointer;
      transition: background 0.12s;
    }
    .sp-match__summary:hover { background: rgba(200,155,60,0.04); }
    .sp-match__champ { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--lol-gold-5); flex-shrink: 0; }
    .sp-match__core { min-width: 70px; }
    .sp-match__champ-name { font-size: 0.78rem; font-weight: 600; color: var(--lol-gold-1); }
    .sp-match__role { font-size: 0.58rem; color: var(--lol-text-dim); text-transform: uppercase; }
    .sp-match__kda { text-align: center; min-width: 80px; }
    .sp-match__kda span { display: block; font-size: 0.78rem; color: var(--lol-gold-1); font-weight: 600; }
    .sp-match__kda-ratio { font-size: 0.62rem !important; color: var(--lol-text-muted) !important; font-weight: 400 !important; }
    .sp-match__stats-mini { display: flex; flex-direction: column; gap: 0.1rem; font-size: 0.62rem; color: var(--lol-text-muted); min-width: 55px; }
    .sp-match__items-mini { display: flex; gap: 1px; flex-shrink: 0; }
    .sp-match__item-img { border-radius: 2px; border: 1px solid var(--lol-gold-5); }
    .sp-match__result { font-family: 'Cinzel', serif; font-size: 0.68rem; font-weight: 700; min-width: 30px; text-align: center; color: #E84057; }
    .sp-match__result--win { color: #50E3C2; }
    .sp-match__expand { font-size: 0.6rem; color: var(--lol-text-dim); min-width: 14px; }

    /* Expanded match detail */
    .sp-match__detail { padding: 0.5rem; border-top: 1px solid var(--lol-gold-5); }
    .sp-match__teams-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    @media (max-width: 640px) { .sp-match__teams-grid { grid-template-columns: 1fr; } }
    .sp-match__team-col { }
    .sp-match__team-header {
      font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
      padding: 0.3rem 0.4rem; margin-bottom: 0.3rem; border-radius: 2px;
    }
    .sp-match__team-header--blue { color: #4A90E2; background: rgba(74,144,226,0.08); }
    .sp-match__team-header--red { color: #E84057; background: rgba(232,64,87,0.08); }
    .sp-match__player {
      display: flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.3rem; font-size: 0.65rem;
      border-radius: 2px; color: var(--lol-gold-1);
    }
    .sp-match__player--me { background: rgba(200,155,60,0.12); font-weight: 600; }
    .sp-match__player-img { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--lol-gold-5); flex-shrink: 0; }
    .sp-match__player-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .sp-match__player-kda { color: var(--lol-gold-2); min-width: 45px; }
    .sp-match__player-cs { color: var(--lol-text-muted); min-width: 28px; }
    .sp-match__player-dmg { color: var(--lol-text-muted); min-width: 30px; }
    .sp-match__player-gold { color: var(--lol-gold-4); min-width: 28px; }
    .sp-match__player-items { display: flex; gap: 1px; flex-shrink: 0; }
    .sp-match__player-items img { width: 18px; height: 18px; border-radius: 1px; border: 1px solid var(--lol-gold-5); }
  `],
})
export class SummonerProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private baseUrl = environment.apiUrl;

  readonly profile = signal<SummonerProfile | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly expandedMatch = signal<number | null>(null);

  readonly stats = computed(() => {
    const p = this.profile();
    if (!p || p.recentMatches.length === 0) return null;
    let wins = 0, kills = 0, deaths = 0, assists = 0, cs = 0, games = 0;
    for (const match of p.recentMatches) {
      const me = match.participants.find(part => part.puuid === p.puuid);
      if (!me) continue;
      games++;
      if (me.win) wins++;
      kills += me.kills; deaths += me.deaths; assists += me.assists; cs += me.cs;
    }
    return {
      totalGames: games, wins, losses: games - wins,
      winRate: games > 0 ? (wins / games) * 100 : 0,
      avgKills: games > 0 ? kills / games : 0,
      avgDeaths: games > 0 ? deaths / games : 0,
      avgAssists: games > 0 ? assists / games : 0,
      avgCs: games > 0 ? cs / games : 0,
    };
  });

  ngOnInit(): void {
    const region = this.route.snapshot.paramMap.get('region') ?? 'euw1';
    const name = this.route.snapshot.paramMap.get('name') ?? '';
    const parts = name.split('-');
    const gameName = parts.slice(0, -1).join('-') || parts[0];
    const tagLine = parts[parts.length - 1] || 'EUW';

    this.seo.updatePageMeta({
      title: `${gameName}#${tagLine} — Summoner Profile | DraftSense`,
      description: `League of Legends summoner profile for ${gameName}#${tagLine}. Rank, match history, KDA, and champion stats.`,
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

  toggleMatch(index: number): void {
    this.expandedMatch.set(this.expandedMatch() === index ? null : index);
  }

  getPlayer(match: MatchData, puuid: string): MatchParticipant | undefined {
    return match.participants.find(p => p.puuid === puuid);
  }

  getTeam(match: MatchData, teamId: number): MatchParticipant[] {
    return match.participants.filter(p => p.teamId === teamId);
  }

  kdaRatio(p: MatchParticipant): string {
    const d = p.deaths || 1;
    return ((p.kills + p.assists) / d).toFixed(2);
  }

  winRatePct(entry: RankedEntry): string {
    const total = entry.wins + entry.losses;
    return total > 0 ? ((entry.wins / total) * 100).toFixed(0) : '0';
  }
}
