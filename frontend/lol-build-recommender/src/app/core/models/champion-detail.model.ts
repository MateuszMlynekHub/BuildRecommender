/**
 * Detailed champion data from Data Dragon's per-champion endpoint:
 *   /cdn/{version}/data/en_US/champion/{Key}.json
 *
 * This is richer than the list endpoint (champion.json) — includes
 * abilities, passive, stats, lore, tips, and skins.
 */

// ── DDragon detailed champion response ───────────────────────────────

export interface DDragonChampionDetailResponse {
  data: Record<string, DDragonChampionDetail>;
}

export interface DDragonChampionDetail {
  id: string;       // e.g. "Aatrox"
  key: string;      // e.g. "266" — numeric champion ID as a string
  name: string;     // e.g. "Aatrox"
  title: string;    // e.g. "the Darkin Blade"
  lore: string;
  tags: string[];
  info: DDragonChampionInfo;
  stats: DDragonChampionStats;
  spells: DDragonSpell[];
  passive: DDragonPassive;
  allytips: string[];
  enemytips: string[];
}

export interface DDragonChampionInfo {
  attack: number;
  defense: number;
  magic: number;
  difficulty: number;
}

export interface DDragonChampionStats {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  movespeed: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackrange: number;
  hpregen: number;
  hpregenperlevel: number;
  mpregen: number;
  mpregenperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
  attackspeed: number;
  attackspeedperlevel: number;
  crit: number;
  critperlevel: number;
}

export interface DDragonSpell {
  id: string;       // e.g. "AatroxQ"
  name: string;     // e.g. "The Darkin Blade"
  description: string;
  image: { full: string };
  cooldownBurn: string;
  costBurn: string;
  rangeBurn: string;
  maxrank: number;
}

export interface DDragonPassive {
  name: string;
  description: string;
  image: { full: string };
}

// ── Build stats from backend ─────────────────────────────────────────

export interface ChampionBuildStat {
  itemId: number;
  itemName: string;
  picks: number;
  wins: number;
}

export interface RunePage {
  primaryStyle: number;
  subStyle: number;
  perks: number[];
  statOffense: number;
  statFlex: number;
  statDefense: number;
  picks: number;
  wins: number;
  winRate: number;
}

export interface SpellSet {
  spell1Id: number;
  spell2Id: number;
  picks: number;
  wins: number;
  winRate: number;
}

export interface MatchupStat {
  opponentChampionId: number;
  opponentChampionKey: string;
  picks: number;
  wins: number;
  winRate: number;
}
