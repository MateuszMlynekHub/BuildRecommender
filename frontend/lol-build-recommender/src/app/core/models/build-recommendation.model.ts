export interface BuildRecommendation {
  championId: number;
  championName: string;
  enemyThreatProfile: ThreatProfile;
  variants: BuildVariant[];
  requestedRole?: string;
  effectiveRole?: string;
  /**
   * Structured, localizable anomaly note. When set, the UI renders the key
   * through the t pipe with args as placeholder substitutions. Null when
   * the build is based on the requested role directly (no anomaly).
   */
  anomaly?: AnomalyInfo | null;
  /** Q/W/E max priority + level-1 pick. Null for pure utility champs (Yuumi etc.). */
  skillOrder?: SkillOrder | null;
}

/**
 * Structured anomaly note from the backend. `key` is a stable translation
 * key ("anomaly.offMeta" / "anomaly.noData") and `args` supplies the
 * placeholder values — champion name and lane translation keys that the
 * UI resolves recursively via the t pipe.
 */
export interface AnomalyInfo {
  key: string;
  args?: Record<string, string | number> | null;
}

/**
 * Structured item reason — each entry in `RecommendedItem.reasons` is now
 * a key + optional args dict, so the UI re-localizes reasons on language
 * switch without a re-fetch.
 */
export interface RecommendationReason {
  key: string;
  args?: Record<string, string | number> | null;
}

export interface SkillOrder {
  /** Slot the player should put their first point into: "Q" | "W" | "E". */
  firstSkill: 'Q' | 'W' | 'E' | string;
  /** Max priority for basic abilities — leftmost is maxed first. Always 3 entries. */
  priority: string[];
  /** Short description of how this order was derived. */
  source: string;
  qName: string;
  wName: string;
  eName: string;
  rName: string;
  /** 18-entry per-level sequence: which ability to level up at champion level i+1. */
  levels: string[];
}

export interface BuildVariant {
  style: 'standard' | 'aggressive' | 'defensive' | string;
  /** Translation key for the tab label (e.g. "build.variant.standard"). */
  labelKey: string;
  /** Translation key for the under-tab description (e.g. "build.variant.standard.description"). */
  descriptionKey: string;
  items: RecommendedItem[];
  /**
   * Sub-components that should be purchased very early even though the final item sits
   * later in the main build order (e.g., Tear of the Goddess rush for Manamune builds).
   * Rendered as a separate row above the main build.
   */
  earlyComponents?: EarlyComponent[];
}

export interface RecommendedItem {
  item: ItemInfo;
  score: number;
  /** Structured reasons — each entry renders via the t pipe with its own args. */
  reasons: RecommendationReason[];
}

export interface EarlyComponent {
  /** The component to rush (e.g., Tear of the Goddess). */
  component: ItemInfo;
  /** The full item in the main build this component upgrades into. */
  buildsInto: ItemInfo;
  /** Translation key for the rush reason (e.g. "earlyComponent.tearRush"). */
  reasonKey: string;
  /** Placeholder args for the rush reason (e.g. { item: "Manamune" }). */
  reasonArgs?: Record<string, string | number> | null;
}

export interface ThreatProfile {
  adRatio: number;
  apRatio: number;
  healingThreat: number;
  /** 0–1 enemy shielding output. Tracked separately from healing because Grievous
   *  Wounds does NOT counter shields — a team of Lulu/Janna/Karma reads "low heal,
   *  high shield" and should steer us toward raw damage rather than Morellonomicon. */
  shieldThreat: number;
  ccThreat: number;
  /** Subset of ccThreat restricted to enemies who also engage (Leona/Naut/Rell). This
   *  is the CC that actually reaches a backline carry; tenacity priority uses this
   *  slice rather than raw ccThreat. */
  engageCcThreat: number;
  /** CC from non-engage champions (Thresh Q at range, Janna peel tornadoes). Diagnostic
   *  only — high peelCcThreat with low engageCcThreat means the displayed CC% is less
   *  threatening than it looks. */
  peelCcThreat: number;
  /** 0–1 enemy hard-engage/dive potential (Malphite/Amumu/Nautilus/Hecarim). Distinct
   *  from ccThreat — drives Zhonya's / Banshee's / Edge of Night / Gargoyle's Stoneplate
   *  decisions, not generic tenacity. */
  engageThreat: number;
  /** 0–1 long-range poke pressure (Xerath/Ziggs/Varus/Caitlyn/Nidalee). Drives HP
   *  sustain items (Rod of Ages, Warmog's, Spirit Visage, Maw of Malmortius). */
  pokeThreat: number;
  /** 0–1 %max-HP / true damage pressure (Vayne/Kog'Maw/Fiora/Cho'Gath/Gwen). Flips
   *  HP stacking recommendation toward resists — Warmog's makes you take MORE damage
   *  from a Vayne, not less. */
  trueDamageThreat: number;
  /** True when ≥1 enemy is a typical crit-building carry. Triggers Randuin's hint. */
  hasCritCarry: boolean;
  /** True when ≥1 enemy has stealth/camouflage. UI hint: buy Control Wards. */
  hasInvisibleEnemy: boolean;
  tankLevel: number;
}

export interface ItemInfo {
  id: number;
  name: string;
  description: string;
  plainText: string;
  tags: string[];
  gold: { total: number; base: number; purchasable: boolean };
  imageFileName: string;
  /** Full CDN URL to the item icon for the current patch — sent by the backend. */
  imageUrl?: string;
}
