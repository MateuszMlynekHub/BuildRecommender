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

const TIER_COLORS: Record<string, string> = {
  IRON: '#6B6B6B', BRONZE: '#8B6914', SILVER: '#8E9AA4', GOLD: '#C89B3C',
  PLATINUM: '#34B4B4', EMERALD: '#0D9E6E', DIAMOND: '#576BCE',
  MASTER: '#9D48E0', GRANDMASTER: '#E84057', CHALLENGER: '#F4C874',
};

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
        } @else if (profile()) {
          @let p = profile()!;

          <!-- Header -->
          <div class="sp-header">
            <div class="sp-header__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="var(--lol-gold-3)">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div>
              <h1 class="sp-header__name">{{ p.gameName }}<span class="sp-header__tag">#{{ p.tagLine }}</span></h1>
              <p class="sp-header__region">{{ p.region }} — {{ p.matchCount }} ranked games found</p>
            </div>
            <a routerLink="/summoner" class="sp-header__search">Search another</a>
          </div>

          <div class="sp-layout">
            <!-- LEFT: Rank Cards -->
            <div class="sp-sidebar">
              @for (entry of p.rankedEntries; track entry.queueType) {
                <div class="sp-rank">
                  <div class="sp-rank__type">{{ entry.queueType === 'RANKED_SOLO_5x5' ? 'Ranked Solo/Duo' : 'Ranked Flex' }}</div>
                  <div class="sp-rank__emblem" [style.border-color]="tierColor(entry.tier)">
                    <span class="sp-rank__tier-letter" [style.color]="tierColor(entry.tier)">{{ entry.tier[0] }}</span>
                  </div>
                  <div class="sp-rank__info">
                    <div class="sp-rank__tier" [style.color]="tierColor(entry.tier)">{{ entry.tier }} {{ entry.rank }}</div>
                    <div class="sp-rank__lp">{{ entry.leaguePoints }} LP</div>
                    <div class="sp-rank__wr-bar">
                      <div class="sp-rank__wr-fill sp-rank__wr-fill--win" [style.width.%]="wrPct(entry)"></div>
                    </div>
                    <div class="sp-rank__record">{{ entry.wins }}W {{ entry.losses }}L — {{ wrPct(entry).toFixed(0) }}% WR</div>
                  </div>
                </div>
              }
              @if (p.rankedEntries.length === 0) {
                <div class="sp-rank"><div class="sp-rank__tier" style="color:var(--lol-text-muted)">Unranked</div></div>
              }
            </div>

            <!-- RIGHT: Stats + Matches -->
            <div class="sp-main">
              <!-- Summary bar -->
              @if (stats()) {
                @let s = stats()!;
                <div class="sp-summary">
                  <!-- Win rate ring -->
                  <div class="sp-wr-ring">
                    <svg viewBox="0 0 36 36" class="sp-wr-ring__svg">
                      <path class="sp-wr-ring__bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path class="sp-wr-ring__fill" [class.sp-wr-ring__fill--good]="s.winRate >= 50"
                        [attr.stroke-dasharray]="s.winRate + ', 100'"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div class="sp-wr-ring__text">{{ s.winRate.toFixed(0) }}%</div>
                  </div>

                  <div class="sp-summary__stats">
                    <div class="sp-summary__record">{{ s.totalGames }}G {{ s.wins }}W {{ s.losses }}L</div>
                    <div class="sp-summary__kda">
                      <span class="sp-summary__kda-num">{{ s.avgKills.toFixed(1) }}</span>
                      <span class="sp-summary__kda-sep">/</span>
                      <span class="sp-summary__kda-num sp-summary__kda-num--death">{{ s.avgDeaths.toFixed(1) }}</span>
                      <span class="sp-summary__kda-sep">/</span>
                      <span class="sp-summary__kda-num">{{ s.avgAssists.toFixed(1) }}</span>
                    </div>
                    <div class="sp-summary__kda-ratio">{{ s.kdaRatio }} : 1 KDA</div>
                  </div>

                  <div class="sp-summary__extra">
                    <div class="sp-summary__avg">Avg CS: <strong>{{ s.avgCs.toFixed(0) }}</strong></div>
                    <div class="sp-summary__avg">Avg DMG: <strong>{{ (s.avgDmg / 1000).toFixed(1) }}k</strong></div>
                    <div class="sp-summary__avg">Avg Gold: <strong>{{ (s.avgGold / 1000).toFixed(1) }}k</strong></div>
                  </div>
                </div>
              }

              <!-- Match list -->
              <div class="sp-matches">
                <div class="sp-matches__header">Recent Games</div>
                @for (match of p.recentMatches; track match.matchId; let i = $index) {
                  @let me = getPlayer(match, p.puuid);
                  @if (me) {
                    <div class="sp-match" [class.sp-match--win]="me.win" [class.sp-match--loss]="!me.win">
                      <!-- Collapsed row -->
                      <div class="sp-match__row" (click)="toggle(i)">
                        <img class="sp-match__champ" [src]="me.championImage" [alt]="me.championName" width="40" height="40" />
                        <div class="sp-match__info">
                          <div class="sp-match__name">{{ me.championName }}</div>
                          <div class="sp-match__sub">{{ me.teamPosition }} — Lv{{ me.level }}</div>
                        </div>
                        <div class="sp-match__kda">
                          <div>{{ me.kills }} / <span class="sp-match__d">{{ me.deaths }}</span> / {{ me.assists }}</div>
                          <div class="sp-match__ratio">{{ kdaRatio(me) }}:1</div>
                        </div>
                        <div class="sp-match__mini-stats">
                          <span>{{ me.cs }} CS</span>
                          <span>{{ (me.damage / 1000).toFixed(1) }}k DMG</span>
                          <span>{{ me.wardsPlaced }} Wards</span>
                        </div>
                        <div class="sp-match__items-row">
                          @for (itemId of me.items.slice(0, 6); track $index) {
                            <img [src]="gameState.getItemImageUrl(itemId + '.png')" width="22" height="22" class="sp-match__item" loading="lazy" />
                          }
                        </div>
                        <div class="sp-match__result" [class.sp-match__result--win]="me.win">{{ me.win ? 'Victory' : 'Defeat' }}</div>
                        <span class="sp-match__arrow">{{ expanded() === i ? '▲' : '▼' }}</span>
                      </div>

                      <!-- Expanded -->
                      @if (expanded() === i) {
                        <div class="sp-match__detail">
                          @for (tid of [100, 200]; track tid) {
                            <div class="sp-match__team">
                              <div class="sp-match__team-hdr" [class.sp-match__team-hdr--blue]="tid===100" [class.sp-match__team-hdr--red]="tid===200">
                                {{ tid === 100 ? 'Blue' : 'Red' }} — {{ getTeam(match, tid)[0]?.win ? 'Victory' : 'Defeat' }}
                              </div>
                              <div class="sp-match__table-hdr">
                                <span class="sp-mc sp-mc--champ">Champion</span>
                                <span class="sp-mc sp-mc--kda">KDA</span>
                                <span class="sp-mc sp-mc--dmg">DMG</span>
                                <span class="sp-mc sp-mc--cs">CS</span>
                                <span class="sp-mc sp-mc--ward">Ward</span>
                                <span class="sp-mc sp-mc--gold">Gold</span>
                                <span class="sp-mc sp-mc--items">Items</span>
                              </div>
                              @for (pl of getTeam(match, tid); track pl.puuid) {
                                <div class="sp-match__pl" [class.sp-match__pl--me]="pl.puuid === p.puuid">
                                  <span class="sp-mc sp-mc--champ">
                                    <img [src]="pl.championImage" width="22" height="22" class="sp-match__pl-img" />
                                    {{ pl.championName }}
                                  </span>
                                  <span class="sp-mc sp-mc--kda">{{ pl.kills }}/{{ pl.deaths }}/{{ pl.assists }}</span>
                                  <span class="sp-mc sp-mc--dmg">{{ (pl.damage/1000).toFixed(1) }}k</span>
                                  <span class="sp-mc sp-mc--cs">{{ pl.cs }}</span>
                                  <span class="sp-mc sp-mc--ward">{{ pl.wardsPlaced }}</span>
                                  <span class="sp-mc sp-mc--gold">{{ (pl.gold/1000).toFixed(1) }}k</span>
                                  <span class="sp-mc sp-mc--items">
                                    @for (iid of pl.items.slice(0,6); track $index) {
                                      <img [src]="gameState.getItemImageUrl(iid+'.png')" width="18" height="18" loading="lazy" />
                                    }
                                  </span>
                                </div>
                              }
                            </div>
                          }
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
    .sp-container { max-width: 1000px; margin: 0 auto; }
    .sp-loading { padding: 4rem 1rem; }

    /* Header */
    .sp-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid var(--lol-gold-5); flex-wrap: wrap; }
    .sp-header__icon {
      width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 3px solid var(--lol-gold-3); background: radial-gradient(circle, rgba(200,155,60,0.2), transparent 70%); flex-shrink: 0;
    }
    .sp-header__name { font-family: 'Cinzel', serif; font-size: 1.5rem; color: var(--lol-gold-1); }
    .sp-header__tag { color: var(--lol-text-muted); font-size: 0.9rem; }
    .sp-header__region { color: var(--lol-text-muted); font-size: 0.78rem; }
    .sp-header__search { margin-left: auto; font-size: 0.72rem; color: var(--lol-gold-4); text-decoration: none; border: 1px solid var(--lol-gold-5); padding: 0.3rem 0.6rem; border-radius: 2px; }
    .sp-header__search:hover { color: var(--lol-gold-2); border-color: var(--lol-gold-3); }

    /* Layout */
    .sp-layout { display: grid; grid-template-columns: 260px 1fr; gap: 1rem; }
    @media (max-width: 768px) { .sp-layout { grid-template-columns: 1fr; } }
    .sp-sidebar { display: flex; flex-direction: column; gap: 0.75rem; }

    /* Rank card */
    .sp-rank { padding: 1rem; background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5); border-radius: 2px; }
    .sp-rank__type { font-size: 0.62rem; color: var(--lol-text-dim); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.6rem; }
    .sp-rank__emblem {
      width: 56px; height: 56px; border-radius: 50%; border: 3px solid; margin: 0 auto 0.5rem;
      display: flex; align-items: center; justify-content: center; background: rgba(1,10,19,0.6);
    }
    .sp-rank__tier-letter { font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 700; }
    .sp-rank__info { text-align: center; }
    .sp-rank__tier { font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; }
    .sp-rank__lp { font-size: 0.82rem; color: var(--lol-cyan); font-weight: 600; margin: 0.15rem 0; }
    .sp-rank__wr-bar { height: 6px; background: rgba(232,64,87,0.3); border-radius: 3px; margin: 0.4rem 0 0.3rem; overflow: hidden; }
    .sp-rank__wr-fill--win { height: 100%; background: #50E3C2; border-radius: 3px; transition: width 0.4s ease; }
    .sp-rank__record { font-size: 0.68rem; color: var(--lol-text-muted); }

    /* Summary bar */
    .sp-summary {
      display: flex; align-items: center; gap: 1.25rem; padding: 0.75rem 1rem; margin-bottom: 0.75rem;
      background: rgba(1,10,19,0.6); border: 1px solid var(--lol-gold-5); border-radius: 2px; flex-wrap: wrap;
    }
    .sp-wr-ring { position: relative; width: 60px; height: 60px; flex-shrink: 0; }
    .sp-wr-ring__svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .sp-wr-ring__bg { fill: none; stroke: rgba(232,64,87,0.25); stroke-width: 3.5; }
    .sp-wr-ring__fill { fill: none; stroke: #E84057; stroke-width: 3.5; stroke-linecap: round; transition: stroke-dasharray 0.5s ease; }
    .sp-wr-ring__fill--good { stroke: #50E3C2; }
    .sp-wr-ring__text {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-family: 'Cinzel', serif; font-size: 0.82rem; font-weight: 700; color: var(--lol-gold-1);
    }
    .sp-summary__stats { }
    .sp-summary__record { font-size: 0.68rem; color: var(--lol-text-muted); margin-bottom: 0.15rem; }
    .sp-summary__kda { font-size: 1.1rem; font-weight: 700; }
    .sp-summary__kda-num { color: var(--lol-gold-1); }
    .sp-summary__kda-num--death { color: #E84057; }
    .sp-summary__kda-sep { color: var(--lol-text-dim); margin: 0 0.15rem; }
    .sp-summary__kda-ratio { font-size: 0.72rem; color: var(--lol-text-muted); }
    .sp-summary__extra { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.68rem; color: var(--lol-text-muted); margin-left: auto; }
    .sp-summary__extra strong { color: var(--lol-gold-1); }

    /* Matches */
    .sp-main { min-width: 0; }
    .sp-matches__header { font-family: 'Cinzel', serif; font-size: 0.8rem; color: var(--lol-gold-2); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
    .sp-matches { display: flex; flex-direction: column; gap: 0.35rem; }
    .sp-match { background: rgba(1,10,19,0.55); border: 1px solid var(--lol-gold-5); border-radius: 2px; border-left: 3px solid var(--lol-gold-5); overflow: hidden; }
    .sp-match--win { border-left-color: #50E3C2; }
    .sp-match--loss { border-left-color: #E84057; }

    .sp-match__row { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.5rem; cursor: pointer; transition: background 0.12s; }
    .sp-match__row:hover { background: rgba(200,155,60,0.04); }
    .sp-match__champ { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--lol-gold-5); flex-shrink: 0; }
    .sp-match__info { min-width: 65px; }
    .sp-match__name { font-size: 0.78rem; font-weight: 600; color: var(--lol-gold-1); }
    .sp-match__sub { font-size: 0.58rem; color: var(--lol-text-dim); }
    .sp-match__kda { min-width: 70px; text-align: center; }
    .sp-match__kda div:first-child { font-size: 0.78rem; color: var(--lol-gold-1); font-weight: 600; }
    .sp-match__d { color: #E84057; }
    .sp-match__ratio { font-size: 0.6rem; color: var(--lol-text-muted); }
    .sp-match__mini-stats { display: flex; flex-direction: column; font-size: 0.58rem; color: var(--lol-text-muted); min-width: 60px; gap: 0.05rem; }
    .sp-match__items-row { display: flex; gap: 1px; }
    .sp-match__item { border-radius: 2px; border: 1px solid var(--lol-gold-5); }
    .sp-match__result { font-family: 'Cinzel', serif; font-size: 0.65rem; font-weight: 700; min-width: 40px; text-align: center; color: #E84057; }
    .sp-match__result--win { color: #50E3C2; }
    .sp-match__arrow { font-size: 0.55rem; color: var(--lol-text-dim); }

    /* Expanded detail */
    .sp-match__detail { padding: 0.4rem; border-top: 1px solid var(--lol-gold-5); display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
    @media (max-width: 768px) { .sp-match__detail { grid-template-columns: 1fr; } }
    .sp-match__team-hdr { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.25rem 0.35rem; border-radius: 2px; margin-bottom: 0.2rem; }
    .sp-match__team-hdr--blue { color: #4A90E2; background: rgba(74,144,226,0.08); }
    .sp-match__team-hdr--red { color: #E84057; background: rgba(232,64,87,0.08); }

    .sp-match__table-hdr { display: flex; align-items: center; gap: 0.2rem; padding: 0.15rem 0.25rem; font-size: 0.52rem; color: var(--lol-text-dim); text-transform: uppercase; letter-spacing: 0.04em; }
    .sp-match__pl { display: flex; align-items: center; gap: 0.2rem; padding: 0.2rem 0.25rem; font-size: 0.62rem; color: var(--lol-gold-1); border-radius: 2px; }
    .sp-match__pl--me { background: rgba(200,155,60,0.1); font-weight: 600; }
    .sp-match__pl-img { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--lol-gold-5); flex-shrink: 0; margin-right: 0.15rem; }

    .sp-mc { display: inline-flex; align-items: center; }
    .sp-mc--champ { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; gap: 0.2rem; }
    .sp-mc--kda { width: 50px; justify-content: center; }
    .sp-mc--dmg { width: 35px; justify-content: flex-end; color: var(--lol-text-muted); }
    .sp-mc--cs { width: 28px; justify-content: flex-end; color: var(--lol-text-muted); }
    .sp-mc--ward { width: 24px; justify-content: flex-end; color: var(--lol-text-muted); }
    .sp-mc--gold { width: 30px; justify-content: flex-end; color: var(--lol-gold-4); }
    .sp-mc--items { display: flex; gap: 1px; flex-shrink: 0; }
    .sp-mc--items img { width: 16px; height: 16px; border-radius: 1px; border: 1px solid var(--lol-gold-5); }
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
  readonly expanded = signal<number | null>(null);

  readonly stats = computed(() => {
    const p = this.profile();
    if (!p || p.recentMatches.length === 0) return null;
    let wins = 0, kills = 0, deaths = 0, assists = 0, cs = 0, dmg = 0, gold = 0, games = 0;
    for (const match of p.recentMatches) {
      const me = match.participants.find(part => part.puuid === p.puuid);
      if (!me) continue;
      games++; if (me.win) wins++;
      kills += me.kills; deaths += me.deaths; assists += me.assists;
      cs += me.cs; dmg += me.damage; gold += me.gold;
    }
    const d = deaths || 1;
    return {
      totalGames: games, wins, losses: games - wins,
      winRate: games > 0 ? (wins / games) * 100 : 0,
      avgKills: games > 0 ? kills / games : 0,
      avgDeaths: games > 0 ? deaths / games : 0,
      avgAssists: games > 0 ? assists / games : 0,
      avgCs: games > 0 ? cs / games : 0,
      avgDmg: games > 0 ? dmg / games : 0,
      avgGold: games > 0 ? gold / games : 0,
      kdaRatio: ((kills + assists) / d).toFixed(2),
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
      description: `League of Legends profile for ${gameName}#${tagLine}. Rank, match history, KDA, champion stats.`,
    });

    if (!this.isBrowser) return;

    this.http.get<SummonerProfile>(`${this.baseUrl}/game/summoner`, {
      params: { gameName, tagLine, region },
    }).subscribe({
      next: (data) => { this.profile.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  toggle(i: number): void { this.expanded.set(this.expanded() === i ? null : i); }
  getPlayer(match: MatchData, puuid: string): MatchParticipant | undefined { return match.participants.find(p => p.puuid === puuid); }
  getTeam(match: MatchData, teamId: number): MatchParticipant[] { return match.participants.filter(p => p.teamId === teamId); }
  kdaRatio(p: MatchParticipant): string { return ((p.kills + p.assists) / (p.deaths || 1)).toFixed(2); }
  wrPct(e: RankedEntry): number { const t = e.wins + e.losses; return t > 0 ? (e.wins / t) * 100 : 0; }
  tierColor(tier: string): string { return TIER_COLORS[tier] ?? 'var(--lol-gold-3)'; }
}
