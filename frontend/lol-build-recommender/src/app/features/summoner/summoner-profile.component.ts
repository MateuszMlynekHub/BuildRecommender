import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SeoService } from '../../core/services/seo.service';
import { GameStateService } from '../../core/services/game-state.service';
import { environment } from '../../../environments/environment';

interface Participant {
  puuid: string; championId: number; championName: string; championImage: string;
  teamPosition: string; teamId: number; kills: number; deaths: number; assists: number;
  cs: number; wardsPlaced: number; damage: number; gold: number; level: number;
  win: boolean; items: number[];
}
interface MatchData { matchId: string; gameVersion: string; participants: Participant[]; }
interface RankedEntry { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number; }
interface TopChampion { championId: number; championName: string; championImage: string; games: number; wins: number; }
interface LaneStat { lane: string; games: number; }
interface PlayedWith { puuid: string; lastChampion: string; games: number; wins: number; }
interface Profile {
  puuid: string; gameName: string; tagLine: string; region: string;
  profileIconUrl: string; summonerLevel: number;
  rankedEntries: RankedEntry[]; topChampions: TopChampion[]; laneStats: LaneStat[];
  recentlyPlayedWith: PlayedWith[];
  matchCount: number; recentMatches: MatchData[];
}

const TIER_COLORS: Record<string, string> = {
  IRON:'#6B6B6B', BRONZE:'#8B6914', SILVER:'#8E9AA4', GOLD:'#C89B3C',
  PLATINUM:'#34B4B4', EMERALD:'#0D9E6E', DIAMOND:'#576BCE',
  MASTER:'#9D48E0', GRANDMASTER:'#E84057', CHALLENGER:'#F4C874',
};

@Component({
  selector: 'app-summoner-profile',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sp">
      <div class="sp__c">
        @if (loading()) {
          <div style="padding:4rem 1rem"><div class="shimmer" style="width:80px;height:80px;border-radius:50%;margin:0 auto"></div></div>
        } @else if (profile()) {
          @let p = profile()!;

          <!-- HEADER -->
          <div class="sp-hdr">
            @if (p.profileIconUrl) {
              <img class="sp-hdr__icon" [src]="p.profileIconUrl" width="68" height="68" />
            } @else {
              <div class="sp-hdr__icon sp-hdr__icon--empty">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="var(--lol-gold-3)">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            }
            <div class="sp-hdr__info">
              <h1 class="sp-hdr__name">{{ p.gameName }}<span class="sp-hdr__tag">#{{ p.tagLine }}</span></h1>
              @if (p.summonerLevel > 0) { <span class="sp-hdr__lvl">Lv. {{ p.summonerLevel }}</span> }
              <p class="sp-hdr__sub">{{ p.region }}</p>
            </div>
            <div class="sp-hdr__actions">
              <button class="sp-hdr__refresh" (click)="refresh()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                Update
              </button>
              <a routerLink="/summoner" class="sp-hdr__btn">Search</a>
            </div>
          </div>

          <div class="sp-lay">
            <!-- LEFT SIDEBAR -->
            <div class="sp-side">
              @for (entry of p.rankedEntries; track entry.queueType) {
                <div class="sp-rk">
                  <div class="sp-rk__type">{{ entry.queueType === 'RANKED_SOLO_5x5' ? 'Ranked Solo/Duo' : 'Ranked Flex' }}</div>
                  <div class="sp-rk__badge" [style.border-color]="tc(entry.tier)">
                    <span [style.color]="tc(entry.tier)">{{ entry.tier?.charAt(0) }}</span>
                  </div>
                  <div class="sp-rk__tier" [style.color]="tc(entry.tier)">{{ entry.tier }} {{ entry.rank }}</div>
                  <div class="sp-rk__lp">{{ entry.leaguePoints }} LP</div>
                  <div class="sp-rk__bar"><div class="sp-rk__fill" [style.width.%]="wr(entry)"></div></div>
                  <div class="sp-rk__rec">{{ entry.wins }}W {{ entry.losses }}L — {{ wr(entry).toFixed(0) }}%</div>
                </div>
              }
              @if (p.rankedEntries.length === 0) {
                <div class="sp-rk"><div class="sp-rk__tier" style="color:var(--lol-text-muted)">Unranked</div></div>
              }

              <!-- Top Champions -->
              @if (p.topChampions.length > 0) {
                <div class="sp-top">
                  <div class="sp-top__hdr">Most Played</div>
                  @for (c of p.topChampions; track c.championId) {
                    <div class="sp-top__row">
                      <img [src]="c.championImage" width="28" height="28" class="sp-top__img" />
                      <span class="sp-top__name">{{ c.championName }}</span>
                      <span class="sp-top__games">{{ c.games }}G</span>
                      <span class="sp-top__wr" [class.sp-top__wr--good]="c.wins * 2 >= c.games">{{ ((c.wins/c.games)*100).toFixed(0) }}%</span>
                    </div>
                  }
                </div>
              }

              <!-- Lane distribution -->
              @if (p.laneStats.length > 0) {
                <div class="sp-top">
                  <div class="sp-top__hdr">Preferred Role</div>
                  @for (l of p.laneStats; track l.lane) {
                    <div class="sp-top__row">
                      <span class="sp-top__name">{{ l.lane }}</span>
                      <span class="sp-top__games">{{ l.games }} games</span>
                    </div>
                  }
                </div>
              }

              <!-- Recently Played With -->
              @if (p.recentlyPlayedWith && p.recentlyPlayedWith.length > 0) {
                <div class="sp-top">
                  <div class="sp-top__hdr">Recently Played With</div>
                  @for (pw of p.recentlyPlayedWith; track pw.puuid) {
                    <div class="sp-top__row">
                      <span class="sp-top__name" style="font-size:.68rem">{{ pw.lastChampion }}</span>
                      <span class="sp-top__games">{{ pw.games }}G</span>
                      <span class="sp-top__wr" [class.sp-top__wr--good]="pw.wins * 2 >= pw.games">{{ pw.wins }}W/{{ pw.games - pw.wins }}L</span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- RIGHT: STATS + MATCHES -->
            <div class="sp-main">
              @if (stats()) {
                @let s = stats()!;
                <div class="sp-sum">
                  <div class="sp-ring">
                    <svg viewBox="0 0 36 36" class="sp-ring__svg">
                      <path class="sp-ring__bg" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/>
                      <path class="sp-ring__fg" [class.sp-ring__fg--good]="s.winRate>=50"
                        [attr.stroke-dasharray]="s.winRate+',100'"
                        d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/>
                    </svg>
                    <div class="sp-ring__txt">{{ s.winRate.toFixed(0) }}%</div>
                  </div>
                  <div class="sp-sum__kda">
                    <div class="sp-sum__rec">{{ s.totalGames }}G {{ s.wins }}W {{ s.losses }}L</div>
                    <div class="sp-sum__nums">
                      {{ s.avgKills.toFixed(1) }} / <span class="sp-sum__d">{{ s.avgDeaths.toFixed(1) }}</span> / {{ s.avgAssists.toFixed(1) }}
                    </div>
                    <div class="sp-sum__ratio">{{ s.kdaRatio }} : 1</div>
                  </div>
                  <div class="sp-sum__ex">
                    <div>CS <strong>{{ s.avgCs.toFixed(0) }}</strong></div>
                    <div>DMG <strong>{{ (s.avgDmg/1000).toFixed(1) }}k</strong></div>
                    <div>Gold <strong>{{ (s.avgGold/1000).toFixed(1) }}k</strong></div>
                  </div>
                </div>
              }

              <div class="sp-ml">
                <div class="sp-ml__hdr">Recent Games ({{ profile()?.recentMatches?.length }})</div>
                @for (match of p.recentMatches; track match.matchId; let i = $index) {
                  @let me = gp(match, p.puuid);
                  @if (me) {
                    <div class="sp-m" [class.sp-m--w]="me.win" [class.sp-m--l]="!me.win">
                      <div class="sp-m__r" (click)="tog(i)">
                        <img class="sp-m__ch" [src]="me.championImage" width="38" height="38" />
                        <div class="sp-m__nfo"><div class="sp-m__cn">{{ me.championName }}</div><div class="sp-m__rl">{{ me.teamPosition }}</div></div>
                        <div class="sp-m__kda"><div>{{ me.kills }}/<span class="sp-m__dd">{{ me.deaths }}</span>/{{ me.assists }}</div><div class="sp-m__kr">{{ kr(me) }}:1</div></div>
                        <div class="sp-m__ms"><span>{{ me.cs }}cs</span><span>{{ (me.damage/1000).toFixed(1) }}k</span></div>
                        <div class="sp-m__it">@for(iid of me.items.slice(0,6);track $index){<img [src]="gs.getItemImageUrl(iid+'.png')" width="20" height="20" loading="lazy"/>}</div>
                        <div class="sp-m__rs" [class.sp-m__rs--w]="me.win">{{ me.win ? 'W' : 'L' }}</div>
                        <span class="sp-m__ar">{{ exp()===i?'▲':'▼' }}</span>
                      </div>
                      @if (exp()===i) {
                        <div class="sp-m__dt">
                          @for(tid of [100,200];track tid){
                            <div class="sp-m__tm">
                              <div class="sp-m__th" [class.sp-m__th--b]="tid===100" [class.sp-m__th--r]="tid===200">{{ tid===100?'Blue':'Red' }} {{ gt(match,tid)[0]?.win?'Victory':'Defeat' }}</div>
                              <div class="sp-m__tr sp-m__tr--h"><span class="mc mc-c">Champ</span><span class="mc mc-k">KDA</span><span class="mc mc-d">DMG</span><span class="mc mc-s">CS</span><span class="mc mc-w">W</span><span class="mc mc-g">Gold</span><span class="mc mc-i">Items</span></div>
                              @for(pl of gt(match,tid);track pl.puuid){
                                <div class="sp-m__tr" [class.sp-m__tr--me]="pl.puuid===p.puuid">
                                  <span class="mc mc-c"><img [src]="pl.championImage" width="20" height="20" class="sp-m__pi" loading="lazy"/>{{ pl.championName }}</span>
                                  <span class="mc mc-k">{{ pl.kills }}/{{ pl.deaths }}/{{ pl.assists }}</span>
                                  <span class="mc mc-d">{{ (pl.damage/1000).toFixed(1) }}k</span>
                                  <span class="mc mc-s">{{ pl.cs }}</span>
                                  <span class="mc mc-w">{{ pl.wardsPlaced }}</span>
                                  <span class="mc mc-g">{{ (pl.gold/1000).toFixed(1) }}k</span>
                                  <span class="mc mc-i">@for(iid of pl.items.slice(0,6);track $index){<img [src]="gs.getItemImageUrl(iid+'.png')" width="16" height="16" loading="lazy"/>}</span>
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
    .sp{min-height:100vh;padding:2rem 1rem 3rem}.sp__c{max-width:1000px;margin:0 auto}
    .sp-hdr{display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--lol-gold-5);flex-wrap:wrap}
    .sp-hdr__icon{width:68px;height:68px;border-radius:50%;border:3px solid var(--lol-gold-3);object-fit:cover;flex-shrink:0}
    .sp-hdr__icon--empty{display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(200,155,60,.2),transparent 70%)}
    .sp-hdr__name{font-family:'Cinzel',serif;font-size:1.4rem;color:var(--lol-gold-1)}.sp-hdr__tag{color:var(--lol-text-muted);font-size:.85rem}
    .sp-hdr__lvl{display:inline-block;padding:.1rem .4rem;font-size:.6rem;background:rgba(200,155,60,.15);border:1px solid var(--lol-gold-5);border-radius:2px;color:var(--lol-gold-2);margin-left:.4rem;vertical-align:middle}
    .sp-hdr__sub{color:var(--lol-text-muted);font-size:.75rem}
    .sp-hdr__actions{margin-left:auto;display:flex;gap:.4rem}
    .sp-hdr__refresh,.sp-hdr__btn{display:inline-flex;align-items:center;gap:.3rem;padding:.3rem .6rem;font-size:.68rem;color:var(--lol-gold-2);background:transparent;border:1px solid var(--lol-gold-5);border-radius:2px;cursor:pointer;text-decoration:none;transition:all .15s}
    .sp-hdr__refresh:hover,.sp-hdr__btn:hover{border-color:var(--lol-gold-3);color:var(--lol-gold-1)}

    .sp-lay{display:grid;grid-template-columns:250px 1fr;gap:1rem}@media(max-width:768px){.sp-lay{grid-template-columns:1fr}}
    .sp-side{display:flex;flex-direction:column;gap:.75rem}

    /* Rank */
    .sp-rk{padding:1rem;background:rgba(1,10,19,.6);border:1px solid var(--lol-gold-5);border-radius:2px;text-align:center}
    .sp-rk__type{font-size:.6rem;color:var(--lol-text-dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem}
    .sp-rk__badge{width:52px;height:52px;border-radius:50%;border:3px solid;margin:0 auto .4rem;display:flex;align-items:center;justify-content:center;background:rgba(1,10,19,.6)}
    .sp-rk__badge span{font-family:'Cinzel',serif;font-size:1.3rem;font-weight:700}
    .sp-rk__tier{font-family:'Cinzel',serif;font-size:1rem;font-weight:700}
    .sp-rk__lp{font-size:.8rem;color:var(--lol-cyan);font-weight:600;margin:.1rem 0}
    .sp-rk__bar{height:5px;background:rgba(232,64,87,.25);border-radius:3px;margin:.35rem 0 .25rem;overflow:hidden}
    .sp-rk__fill{height:100%;background:#50E3C2;border-radius:3px;transition:width .4s}
    .sp-rk__rec{font-size:.65rem;color:var(--lol-text-muted)}

    /* Top champs / lanes */
    .sp-top{padding:.75rem;background:rgba(1,10,19,.6);border:1px solid var(--lol-gold-5);border-radius:2px}
    .sp-top__hdr{font-size:.65rem;color:var(--lol-text-dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem;padding-bottom:.3rem;border-bottom:1px solid var(--lol-gold-5)}
    .sp-top__row{display:flex;align-items:center;gap:.4rem;padding:.2rem 0;font-size:.72rem;color:var(--lol-gold-1)}
    .sp-top__img{width:28px;height:28px;border-radius:50%;border:1px solid var(--lol-gold-5)}
    .sp-top__name{flex:1}.sp-top__games{color:var(--lol-text-muted);font-size:.65rem}
    .sp-top__wr{font-weight:700;font-size:.68rem;color:var(--lol-text-muted);min-width:28px;text-align:right}
    .sp-top__wr--good{color:#50E3C2}

    /* Summary */
    .sp-sum{display:flex;align-items:center;gap:1rem;padding:.6rem .8rem;margin-bottom:.6rem;background:rgba(1,10,19,.6);border:1px solid var(--lol-gold-5);border-radius:2px;flex-wrap:wrap}
    .sp-ring{position:relative;width:56px;height:56px;flex-shrink:0}
    .sp-ring__svg{width:100%;height:100%;transform:rotate(-90deg)}
    .sp-ring__bg{fill:none;stroke:rgba(232,64,87,.25);stroke-width:3.5}
    .sp-ring__fg{fill:none;stroke:#E84057;stroke-width:3.5;stroke-linecap:round;transition:stroke-dasharray .5s}
    .sp-ring__fg--good{stroke:#50E3C2}
    .sp-ring__txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:.78rem;font-weight:700;color:var(--lol-gold-1)}
    .sp-sum__rec{font-size:.65rem;color:var(--lol-text-muted)}
    .sp-sum__nums{font-size:1rem;font-weight:700;color:var(--lol-gold-1)}.sp-sum__d{color:#E84057}
    .sp-sum__ratio{font-size:.68rem;color:var(--lol-text-muted)}
    .sp-sum__ex{margin-left:auto;font-size:.65rem;color:var(--lol-text-muted);display:flex;flex-direction:column;gap:.1rem}
    .sp-sum__ex strong{color:var(--lol-gold-1)}

    /* Match list */
    .sp-ml__hdr{font-family:'Cinzel',serif;font-size:.75rem;color:var(--lol-gold-2);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.4rem}
    .sp-ml{display:flex;flex-direction:column;gap:.3rem}
    .sp-m{background:rgba(1,10,19,.55);border:1px solid var(--lol-gold-5);border-radius:2px;border-left:3px solid var(--lol-gold-5);overflow:hidden}
    .sp-m--w{border-left-color:#50E3C2}.sp-m--l{border-left-color:#E84057}
    .sp-m__r{display:flex;align-items:center;gap:.4rem;padding:.4rem .5rem;cursor:pointer;transition:background .12s}
    .sp-m__r:hover{background:rgba(200,155,60,.04)}
    .sp-m__ch{width:38px;height:38px;border-radius:50%;border:2px solid var(--lol-gold-5);flex-shrink:0}
    .sp-m__nfo{min-width:60px}.sp-m__cn{font-size:.75rem;font-weight:600;color:var(--lol-gold-1)}.sp-m__rl{font-size:.55rem;color:var(--lol-text-dim);text-transform:uppercase}
    .sp-m__kda{min-width:65px;text-align:center}.sp-m__kda div:first-child{font-size:.75rem;color:var(--lol-gold-1);font-weight:600}.sp-m__dd{color:#E84057}.sp-m__kr{font-size:.58rem;color:var(--lol-text-muted)}
    .sp-m__ms{display:flex;flex-direction:column;font-size:.55rem;color:var(--lol-text-muted);min-width:40px;gap:.02rem}
    .sp-m__it{display:flex;gap:1px}.sp-m__it img{border-radius:2px;border:1px solid var(--lol-gold-5)}
    .sp-m__rs{font-family:'Cinzel',serif;font-size:.7rem;font-weight:700;min-width:18px;text-align:center;color:#E84057}.sp-m__rs--w{color:#50E3C2}
    .sp-m__ar{font-size:.5rem;color:var(--lol-text-dim)}

    /* Expanded */
    .sp-m__dt{padding:.4rem;border-top:1px solid var(--lol-gold-5);display:grid;grid-template-columns:1fr 1fr;gap:.4rem}
    @media(max-width:768px){.sp-m__dt{grid-template-columns:1fr}}
    .sp-m__th{font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:.2rem .3rem;border-radius:2px;margin-bottom:.15rem}
    .sp-m__th--b{color:#4A90E2;background:rgba(74,144,226,.08)}.sp-m__th--r{color:#E84057;background:rgba(232,64,87,.08)}
    .sp-m__tr{display:flex;align-items:center;gap:.15rem;padding:.15rem .2rem;font-size:.6rem;color:var(--lol-gold-1);border-radius:2px}
    .sp-m__tr--h{font-size:.5rem;color:var(--lol-text-dim);text-transform:uppercase;letter-spacing:.04em}
    .sp-m__tr--me{background:rgba(200,155,60,.1);font-weight:600}
    .sp-m__pi{width:20px;height:20px;border-radius:50%;border:1px solid var(--lol-gold-5);margin-right:.15rem;flex-shrink:0}
    .mc{display:inline-flex;align-items:center}.mc-c{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;gap:.15rem}
    .mc-k{width:46px;justify-content:center}.mc-d{width:32px;justify-content:flex-end;color:var(--lol-text-muted)}
    .mc-s{width:24px;justify-content:flex-end;color:var(--lol-text-muted)}.mc-w{width:18px;justify-content:flex-end;color:var(--lol-text-muted)}
    .mc-g{width:28px;justify-content:flex-end;color:var(--lol-gold-4)}.mc-i{display:flex;gap:1px;flex-shrink:0}.mc-i img{width:16px;height:16px;border-radius:1px;border:1px solid var(--lol-gold-5)}
  `],
})
export class SummonerProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  readonly gs = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private baseUrl = environment.apiUrl;
  private currentRegion = '';
  private currentName = '';
  private currentTag = '';

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly exp = signal<number | null>(null);

  readonly stats = computed(() => {
    const p = this.profile();
    if (!p?.recentMatches?.length) return null;
    let w=0,k=0,d=0,a=0,cs=0,dm=0,g=0,n=0;
    for (const m of p.recentMatches) {
      const me = m.participants.find(x => x.puuid === p.puuid);
      if (!me) continue; n++; if (me.win) w++;
      k+=me.kills;d+=me.deaths;a+=me.assists;cs+=me.cs;dm+=me.damage;g+=me.gold;
    }
    const dd=d||1;
    return { totalGames:n, wins:w, losses:n-w, winRate:n>0?(w/n)*100:0,
      avgKills:n>0?k/n:0, avgDeaths:n>0?d/n:0, avgAssists:n>0?a/n:0,
      avgCs:n>0?cs/n:0, avgDmg:n>0?dm/n:0, avgGold:n>0?g/n:0,
      kdaRatio:((k+a)/dd).toFixed(2) };
  });

  ngOnInit(): void {
    this.currentRegion = this.route.snapshot.paramMap.get('region') ?? 'euw1';
    this.currentName = this.route.snapshot.paramMap.get('name') ?? '';
    const parts = this.currentName.split('-');
    const gameName = parts.slice(0,-1).join('-') || parts[0];
    this.currentTag = parts[parts.length-1] || 'EUW';

    this.seo.updatePageMeta({
      title: `${gameName}#${this.currentTag} — Summoner Profile | DraftSense`,
      description: `LoL profile for ${gameName}#${this.currentTag}. Rank, match history, KDA.`,
    });
    if (!this.isBrowser) return;
    this.fetchProfile(gameName, this.currentTag, this.currentRegion);
  }

  refresh(): void {
    const parts = this.currentName.split('-');
    const gameName = parts.slice(0,-1).join('-') || parts[0];
    this.loading.set(true);
    this.fetchProfile(gameName, this.currentTag, this.currentRegion);
  }

  private fetchProfile(gameName: string, tagLine: string, region: string): void {
    this.http.get<Profile>(`${this.baseUrl}/game/summoner`, {
      params: { gameName, tagLine, region },
    }).subscribe({
      next: (data) => { this.profile.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  tog(i: number) { this.exp.set(this.exp()===i?null:i); }
  gp(m: MatchData, puuid: string) { return m.participants.find(p=>p.puuid===puuid); }
  gt(m: MatchData, tid: number) { return m.participants.filter(p=>p.teamId===tid); }
  kr(p: Participant) { return ((p.kills+p.assists)/(p.deaths||1)).toFixed(2); }
  wr(e: RankedEntry) { const t=e.wins+e.losses; return t>0?(e.wins/t)*100:0; }
  tc(tier: string) { return TIER_COLORS[tier]??'var(--lol-gold-3)'; }
}
