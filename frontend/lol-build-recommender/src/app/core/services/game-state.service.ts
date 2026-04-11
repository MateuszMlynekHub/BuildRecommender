import { Injectable, signal } from '@angular/core';
import { ActiveGame } from '../models/active-game.model';
import { BuildRecommendation } from '../models/build-recommendation.model';

@Injectable({ providedIn: 'root' })
export class GameStateService {
  game = signal<ActiveGame | null>(null);
  selectedChampionId = signal<number | null>(null);
  buildRecommendation = signal<BuildRecommendation | null>(null);
  ddragonVersion = signal<string>('14.24.1');

  getItemImageUrl(imageFileName: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion()}/img/item/${imageFileName}`;
  }

  getChampionImageUrl(imageFileName: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion()}/img/champion/${imageFileName}`;
  }
}
