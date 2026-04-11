export interface ActiveGame {
  gameId: number;
  gameMode: string;
  gameLengthSeconds: number;
  searchedPuuid: string;
  teams: Team[];
  bans: BannedChampion[];
}

export interface Team {
  teamId: number;
  participants: Participant[];
}

export type Lane = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY' | '';

export interface Participant {
  puuid: string;
  riotId: string;
  championId: number;
  championName: string;
  championImageUrl: string;
  championTags: string[];
  teamId: number;
  spell1Id: number;
  spell2Id: number;
  perks: Perks;
  lane: Lane;
}

export interface Perks {
  perkIds: number[];
  perkStyle: number;
  perkSubStyle: number;
}

export interface BannedChampion {
  championId: number;
  teamId: number;
  championName: string;
  championImageUrl: string;
}
