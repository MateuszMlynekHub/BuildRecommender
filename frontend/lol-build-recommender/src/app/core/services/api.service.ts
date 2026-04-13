import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActiveGame } from '../models/active-game.model';
import { BuildRecommendation, GoldRecommendation } from '../models/build-recommendation.model';
import { Region } from '../models/region.model';
import { Champion } from '../models/champion.model';
import { MultiSearchResult } from '../models/multisearch.model';
import {
  DDragonChampionDetail,
  DDragonChampionDetailResponse,
  ChampionBuildStat,
  RunePage,
  IndividualRuneStat,
  SpellSet,
  MatchupStat,
  TierListEntry,
  MetaShiftEntry,
  PatchTrend,
  BuildOrderEntry,
  SkillOrderEntry,
  StartingItemEntry,
  CounterTip,
  DuoSynergy,
  ModeTierListResponse,
  ProBuild,
} from '../models/champion-detail.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  /**
   * Cached champion list observable. The first subscriber triggers the HTTP
   * call; subsequent subscribers get the cached response without hitting the
   * backend again. shareReplay(1) keeps the latest value around for the whole
   * app lifetime — champion data doesn't change within a session.
   */
  private championsCache$?: Observable<Champion[]>;

  findActiveGame(gameName: string, tagLine: string, region: string): Observable<ActiveGame> {
    return this.http.get<ActiveGame>(`${this.baseUrl}/game/active`, {
      params: { gameName, tagLine, region },
    });
  }

  getRecommendedBuild(
    championId: number,
    enemyChampionIds: number[],
    allyChampionIds: number[],
    role?: string
  ): Observable<BuildRecommendation> {
    const params: Record<string, string> = {
      championId: championId.toString(),
      enemyChampions: enemyChampionIds.join(','),
      allyChampions: allyChampionIds.join(','),
    };
    if (role) params['role'] = role;
    return this.http.get<BuildRecommendation>(`${this.baseUrl}/build/recommend`, { params });
  }

  getGoldEfficientItems(
    gold: number,
    championId?: number,
    role?: string,
  ): Observable<GoldRecommendation> {
    const params: Record<string, string> = { gold: gold.toString() };
    if (championId) params['championId'] = championId.toString();
    if (role) params['role'] = role;
    return this.http.get<GoldRecommendation>(`${this.baseUrl}/build/gold-efficient`, { params });
  }

  getRegions(): Observable<Region[]> {
    return this.http.get<Region[]>(`${this.baseUrl}/data/regions`);
  }

  getVersion(): Observable<string> {
    return this.http.get(`${this.baseUrl}/data/version`, { responseType: 'text' });
  }

  /**
   * Detailed champion data from DDragon per-champion endpoint. Called directly
   * from the frontend — DDragon is a public CDN with CORS headers, no API key.
   * Returns abilities, passive, stats, lore, tips.
   */
  getChampionDetail(key: string, version: string): Observable<DDragonChampionDetail> {
    return this.http
      .get<DDragonChampionDetailResponse>(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${key}.json`
      )
      .pipe(map((res) => Object.values(res.data)[0]));
  }

  /**
   * Build stats for a specific champion + lane from the BuildStats SQLite DB.
   * Returns top items sorted by pick frequency on the current patch.
   */
  getChampionBuildStats(championId: number, lane: string, count = 10): Observable<ChampionBuildStat[]> {
    return this.http.get<ChampionBuildStat[]>(
      `${this.baseUrl}/data/buildstats/${championId}/${lane}`,
      { params: { count: count.toString() } },
    );
  }

  getChampionRunes(championId: number, lane: string, count = 5): Observable<RunePage[]> {
    return this.http.get<RunePage[]>(
      `${this.baseUrl}/data/buildstats/${championId}/${lane}/runes`,
      { params: { count: count.toString() } },
    );
  }

  getIndividualRuneStats(championId: number, lane: string): Observable<IndividualRuneStat[]> {
    return this.http.get<IndividualRuneStat[]>(
      `${this.baseUrl}/data/buildstats/${championId}/${lane}/runes/individual`,
    );
  }

  getChampionSpells(championId: number, lane: string, count = 5): Observable<SpellSet[]> {
    return this.http.get<SpellSet[]>(
      `${this.baseUrl}/data/buildstats/${championId}/${lane}/spells`,
      { params: { count: count.toString() } },
    );
  }

  getMetaShift(): Observable<MetaShiftEntry[]> {
    return this.http.get<MetaShiftEntry[]>(`${this.baseUrl}/data/metashift`);
  }

  getTierList(role?: string): Observable<TierListEntry[]> {
    const params: Record<string, string> = {};
    if (role) params['role'] = role;
    return this.http.get<TierListEntry[]>(`${this.baseUrl}/data/tierlist`, { params });
  }

  getChampionStartingItems(championId: number, lane: string, count = 5): Observable<StartingItemEntry[]> {
    return this.http.get<StartingItemEntry[]>(
      `${this.baseUrl}/data/buildstats/${championId}/${lane}/startingitems`,
      { params: { count: count.toString() } },
    );
  }

  getChampionBuildOrders(championId: number, lane: string, count = 5): Observable<BuildOrderEntry[]> {
    return this.http.get<BuildOrderEntry[]>(
      `${this.baseUrl}/data/buildstats/${championId}/${lane}/buildorder`,
      { params: { count: count.toString() } },
    );
  }

  getChampionSkillOrders(championId: number, lane: string, count = 5): Observable<SkillOrderEntry[]> {
    return this.http.get<SkillOrderEntry[]>(
      `${this.baseUrl}/data/buildstats/${championId}/${lane}/skillorder`,
      { params: { count: count.toString() } },
    );
  }

  getChampionMatchups(championId: number, lane: string, count = 10): Observable<MatchupStat[]> {
    return this.http.get<MatchupStat[]>(
      `${this.baseUrl}/data/buildstats/${championId}/${lane}/matchups`,
      { params: { count: count.toString() } },
    );
  }

  getPatchTrends(championId: number, role?: string): Observable<PatchTrend[]> {
    const params: Record<string, string> = {};
    if (role) params['role'] = role;
    return this.http.get<PatchTrend[]>(`${this.baseUrl}/data/trends/${championId}`, { params });
  }

  getCounterTips(championId: number, opponentId: number): Observable<CounterTip[]> {
    return this.http.get<CounterTip[]>(
      `${this.baseUrl}/data/countertips/${championId}/${opponentId}`,
    );
  }

  /**
   * Full champion catalog with positions/tags. Used by TeamShuffleComponent
   * to filter champions by role. Backend returns a Dictionary<int, ChampionInfo>
   * which serializes as a JSON object keyed by numeric id as string — we
   * flatten it to an array for easier consumption (pickRandomFromArray is
   * simpler than pickRandomFromDict).
   *
   * Cached via shareReplay so switching between `/` and `/shuffle` doesn't
   * re-fetch ~150 champions on every navigation.
   */
  multiSearch(players: string, region: string): Observable<{ players: MultiSearchResult[] }> {
    return this.http.get<{ players: MultiSearchResult[] }>(`${this.baseUrl}/game/multisearch`, {
      params: { players, region },
    });
  }

  getSummonerProfile(gameName: string, tagLine: string, region: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/game/summoner`, {
      params: { gameName, tagLine, region },
    });
  }

  getChampions(): Observable<Champion[]> {
    if (!this.championsCache$) {
      this.championsCache$ = this.http
        .get<Record<string, Champion>>(`${this.baseUrl}/data/champions`)
        .pipe(
          // Dictionary → array. Object.values works because JSON serializes
          // Dictionary<int, T> as { "1": T, "2": T, ... } on the wire.
          map((dict) => Object.values(dict)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.championsCache$;
  }

  getModeTierList(mode: string, role?: string): Observable<ModeTierListResponse> {
    const params: Record<string, string> = {};
    if (role) params['role'] = role;
    return this.http.get<ModeTierListResponse>(`${this.baseUrl}/data/tierlist/${mode}`, { params });
  }

  getDuoSynergies(lane?: string): Observable<DuoSynergy[]> {
    const params: Record<string, string> = {};
    if (lane) params['lane'] = lane;
    return this.http.get<DuoSynergy[]>(`${this.baseUrl}/data/duosynergy`, { params });
  }

  getProBuilds(region: string = 'euw1', count: number = 20): Observable<ProBuild[]> {
    return this.http.get<ProBuild[]>(`${this.baseUrl}/data/probuilds`, {
      params: { region, count: count.toString() },
    });
  }
}
