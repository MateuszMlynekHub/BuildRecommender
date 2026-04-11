import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActiveGame } from '../models/active-game.model';
import { BuildRecommendation } from '../models/build-recommendation.model';
import { Region } from '../models/region.model';
import { Champion } from '../models/champion.model';

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

  getRegions(): Observable<Region[]> {
    return this.http.get<Region[]>(`${this.baseUrl}/data/regions`);
  }

  getVersion(): Observable<string> {
    return this.http.get(`${this.baseUrl}/data/version`, { responseType: 'text' });
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
}
