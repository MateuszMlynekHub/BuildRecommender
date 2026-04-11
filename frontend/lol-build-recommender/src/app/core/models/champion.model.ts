/**
 * Champion metadata served by the backend `/api/data/champions` endpoint.
 *
 * This interface is a partial mirror of the backend's `ChampionInfo` record —
 * we only type the fields the frontend actually reads. Fields like
 * `DamageProfile`, `AttributeRatings`, `SkillOrder` exist on the wire but
 * aren't declared here because no frontend component consumes them directly.
 * If you ever need them, extend this interface.
 *
 * The `positions` field is what the Team Shuffle feature uses to filter
 * role-appropriate champions (TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY). Each champion
 * lists 1–3 positions based on Meraki Analytics' role data.
 */
export interface Champion {
  /** Numeric champion ID (Riot's internal key). */
  id: number;

  /** Data Dragon string key (e.g. "MissFortune", "Khazix") — stable across patches. */
  key: string;

  /** Display name ("Miss Fortune", "Kha'Zix"). */
  name: string;

  /** Riot class tags: Marksman, Mage, Assassin, Fighter, Tank, Support. */
  tags: string[];

  /**
   * Natural lane positions from Meraki. Values are uppercase:
   *   "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY"
   * A champion with positions ["MIDDLE", "BOTTOM"] can flex between both.
   */
  positions: string[];

  /** File name used to build the Data Dragon portrait URL. */
  imageFileName: string;
}

/**
 * Uppercase lane identifier used by Riot's API and our backend. Kept as a
 * string union (not enum) so API responses deserialize directly.
 */
export type LaneRole = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';

/** Canonical order used everywhere lanes are iterated. */
export const LANE_ORDER: readonly LaneRole[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
