export interface MultiSearchResult {
  gameName: string;
  tagLine: string;
  found: boolean;
  error?: string;
  profileIconUrl?: string;
  summonerLevel?: number;
  rankedEntries?: RankedEntryDto[];
  recentGames?: number;
  recentWins?: number;
  recentWinRate?: number;
  topChampions?: MultiSearchChampion[];
}

export interface RankedEntryDto {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface MultiSearchChampion {
  championId: number;
  championName: string;
  championImage: string;
  games: number;
  wins: number;
}
