namespace LoLBuildRecommender.Core.Models;

public record BuildRecommendation
{
    public int ChampionId { get; init; }
    public string ChampionName { get; init; } = string.Empty;
    public TeamThreatProfile EnemyThreatProfile { get; init; } = new();
    public List<BuildVariant> Variants { get; init; } = [];

    /// <summary>The role the request asked for (e.g., "UTILITY" when Aatrox was assigned bot lane).</summary>
    public string RequestedRole { get; init; } = string.Empty;

    /// <summary>
    /// The role actually used to source historical data + scoring archetype. Differs from
    /// <see cref="RequestedRole"/> when the champion has no historical picks in the requested role
    /// and we fall back to their natural position (e.g., Aatrox UTILITY → TOP meta).
    /// </summary>
    public string EffectiveRole { get; init; } = string.Empty;

    /// <summary>
    /// Structured anomaly note (localizable). Set when the build's role doesn't match
    /// the request or no historical data was available. Null when the build is based on
    /// the requested role directly. The frontend renders <see cref="AnomalyInfo.Key"/>
    /// through its translation service with <see cref="AnomalyInfo.Args"/> as placeholder
    /// substitutions.
    /// </summary>
    public AnomalyInfo? Anomaly { get; init; }

    /// <summary>
    /// Recommended skill leveling order (Q/W/E priority + level-1 pick). Null for pure
    /// utility champs where Meraki's leveling data doesn't expose damage scaling
    /// (e.g., Yuumi). Rendered as its own section below the item build.
    /// </summary>
    public SkillOrder? SkillOrder { get; init; }
}

public record BuildVariant
{
    /// <summary>Machine-friendly style key: "standard" | "aggressive" | "defensive".</summary>
    public string Style { get; init; } = string.Empty;

    /// <summary>
    /// Translation key for the variant label. Frontend renders this via the t pipe;
    /// the mapping lives in both the backend and frontend variantLabelKey() — the two
    /// must stay in sync.
    /// </summary>
    public string LabelKey { get; init; } = string.Empty;

    /// <summary>
    /// Translation key for the variant description. Same deal as <see cref="LabelKey"/>.
    /// </summary>
    public string DescriptionKey { get; init; } = string.Empty;

    /// <summary>Final 6-item build in recommended buy order.</summary>
    public List<RecommendedItem> Items { get; init; } = [];

    /// <summary>
    /// Sub-components that should be purchased very early even though the full item they
    /// build into sits later in the main buy order. Currently used for Tear of the Goddess
    /// (Manamune/Archangel's/Fimbulwinter lines) — the passive stacks over time, so the
    /// sooner you own the Tear, the stronger the completed item is.
    /// </summary>
    public List<EarlyComponent> EarlyComponents { get; init; } = [];
}

/// <summary>
/// A single "rush this component early" recommendation. The component is NOT in the main
/// <see cref="BuildVariant.Items"/> list — it's an additional hint the UI shows above/before
/// the main build order so the player knows to swing by the shop early.
/// </summary>
public record EarlyComponent
{
    public ItemInfo Component { get; init; } = null!;

    /// <summary>The full item in the main build that this component upgrades into.</summary>
    public ItemInfo BuildsInto { get; init; } = null!;

    /// <summary>
    /// Translation key explaining WHY this component should be rushed. Args typically
    /// include {item} — the full item name the component builds into. Frontend resolves
    /// the key via the t pipe.
    /// </summary>
    public string ReasonKey { get; init; } = string.Empty;

    /// <summary>
    /// Substitution values for placeholders in <see cref="ReasonKey"/>'s translation
    /// (e.g., {item} → "Manamune"). Keys match the <c>{name}</c> tokens inside the
    /// translated strings.
    /// </summary>
    public Dictionary<string, object>? ReasonArgs { get; init; }
}

public record RecommendedItem
{
    public ItemInfo Item { get; init; } = null!;
    public double Score { get; init; }

    /// <summary>
    /// Structured reasons behind this item pick, each a translation key + args. The
    /// frontend renders them through the t pipe so the message flips language when
    /// the user switches the language switcher, with no re-fetch required.
    /// </summary>
    public List<RecommendationReason> Reasons { get; init; } = [];
}

/// <summary>
/// A single localizable reason for picking (or avoiding) an item. Structured as a stable
/// translation key plus a dict of placeholder values that the frontend interpolates into
/// the translated string.
///
/// Example:
///   Key: "reason.armorVsAd"
///   Args: { "percent", 65 }
/// Renders as:
///   PL: "Armor vs drużyna AD (65%)"
///   EN: "Armor vs AD team (65%)"
///
/// Adding a new reason:
///   1. Pick a stable key under "reason.*" namespace
///   2. Add it to translations.ts with all 6 language values
///   3. Push from BuildRecommenderService via `reasons.Add(new RecommendationReason {...})`
/// </summary>
public record RecommendationReason
{
    /// <summary>Stable translation key — MUST be listed in frontend TranslationKey union.</summary>
    public string Key { get; init; } = string.Empty;

    /// <summary>
    /// Placeholder substitution values. Keys match <c>{token}</c> literals inside the
    /// translated string template. Null when the translation has no placeholders.
    /// </summary>
    public Dictionary<string, object>? Args { get; init; }
}

/// <summary>
/// Structured anomaly note — see <see cref="BuildRecommendation.Anomaly"/>. Shape matches
/// <see cref="RecommendationReason"/> on purpose: key + optional args dict, rendered via
/// the frontend t pipe.
/// </summary>
public record AnomalyInfo
{
    public string Key { get; init; } = string.Empty;
    public Dictionary<string, object>? Args { get; init; }
}

public record TeamThreatProfile
{
    public double AdRatio { get; init; }
    public double ApRatio { get; init; }
    public double HealingThreat { get; init; }
    /// <summary>
    /// Scalar 0-1 for enemy team's shield output. Tracked separately from HealingThreat
    /// because Grievous Wounds items do NOT counter shields — a team of Lulu/Janna/Karma
    /// looks like "low heal, high shield" and should drive raw-damage picks rather than
    /// Morellonomicon/Chempunk.
    /// </summary>
    public double ShieldThreat { get; init; }
    public double CcThreat { get; init; }
    /// <summary>
    /// CC that will actually lock you down — the CC load from enemies who also have
    /// engage/dive tools. A Thresh hook is hard CC but comes from his hand to you; a
    /// Malphite ult is hard CC that arrives ON your face. Tenacity items should be
    /// prioritized by this metric rather than raw <see cref="CcThreat"/> so a team of
    /// 5 peel supports doesn't force a Mercury's Treads rush on the mid laner.
    /// </summary>
    public double EngageCcThreat { get; init; }
    /// <summary>
    /// CC that pins the enemy for allies to hit but doesn't threaten me directly (Thresh
    /// Q aimed away, Janna Q that knocks me back out of combat, peel W's). Diagnostic —
    /// not currently a scoring driver; exposed so the UI can explain high CcThreat with
    /// low EngageCcThreat.
    /// </summary>
    public double PeelCcThreat { get; init; }
    /// <summary>
    /// 0-1 scalar for enemy team's hard-engage / dive potential (Malphite/Amumu/Naut/
    /// Hecarim/Leona/Rell). Distinct from <see cref="CcThreat"/> because engage is about
    /// gap-closing + lockdown onto the backline — drives defensive active items like
    /// Zhonya's, Banshee's Veil, Edge of Night, Gargoyle's Stoneplate.
    /// </summary>
    public double EngageThreat { get; init; }
    /// <summary>
    /// 0-1 scalar for long-range poke harass (Xerath/Ziggs/Varus/Jayce/Caitlyn). Drives
    /// HP sustain items like Rod of Ages, Warmog's, Maw of Malmortius, Spirit Visage —
    /// items that let you weather the laning phase instead of getting burst-defense items.
    /// </summary>
    public double PokeThreat { get; init; }
    /// <summary>
    /// 0-1 scalar for %max-HP or true-damage pressure (Vayne/Kog'Maw/Fiora/Cho'Gath/
    /// Gwen/Twitch/Pyke/Akali R). When this is high, HP stacking (Warmog's, Heartsteel)
    /// loses value because the damage either scales with target HP or bypasses resists —
    /// armor/MR become relatively better than raw HP.
    /// </summary>
    public double TrueDamageThreat { get; init; }
    /// <summary>
    /// True when at least one enemy is a typical crit-building carry (Caitlyn/Jinx/Yasuo/…).
    /// Triggers a Randuin's Omen score bonus for tanks since its passive specifically
    /// reduces incoming crit damage.
    /// </summary>
    public bool HasCritCarry { get; init; }
    /// <summary>
    /// True when at least one enemy has a stealth/camouflage mechanic (Evelynn/Twitch/
    /// Akali/Shaco/Rengar/Khazix/Talon/Wukong/Teemo). Surfaced as a UI hint about Control
    /// Wards / Oracle Lens — no build-time item counter applies.
    /// </summary>
    public bool HasInvisibleEnemy { get; init; }
    public double TankLevel { get; init; }
    public int EnemyCount { get; init; }
    public int TankCount { get; init; }
    public int AssassinCount { get; init; }
    public int MageCount { get; init; }
    public int MarksmanCount { get; init; }
    public int FighterCount { get; init; }
    public int BurstCount { get; init; }
}

public record EnemyClassification
{
    public int ChampionId { get; init; }
    public string ChampionName { get; init; } = string.Empty;
    /// <summary>
    /// Data Dragon champion key (e.g., "MissFortune", "Khazix"). Used for lookups
    /// against curated override tables — display <see cref="ChampionName"/> has spaces
    /// and punctuation ("Miss Fortune", "Kha'Zix") that don't match.
    /// </summary>
    public string ChampionKey { get; init; } = string.Empty;
    public DamageType PrimaryDamage { get; init; }
    public ThreatType ThreatType { get; init; }
    public bool HasHealing { get; init; }
    public double HealingIntensity { get; init; }
    /// <summary>
    /// 0-1 scalar for shielding output, curated per-champion. Orthogonal to
    /// <see cref="HealingIntensity"/> because shield counters (none really, anti-shield
    /// items are narrow) differ from heal counters (Grievous Wounds).
    /// </summary>
    public double ShieldIntensity { get; init; }
    /// <summary>0–1 per-champion engage/dive score from curated override table.</summary>
    public double EngageScore { get; init; }
    /// <summary>0–1 per-champion long-range poke score from curated override table.</summary>
    public double PokeScore { get; init; }
    /// <summary>0–1 per-champion %max-HP / true damage score from curated override table.</summary>
    public double TrueDamageScore { get; init; }
    public bool HasHardCC { get; init; }
    /// <summary>
    /// 0.0–1.0 scalar CC load (count of hard-CC abilities divided by 3, clamped). Used
    /// in place of <see cref="HasHardCC"/> by the team threat profile so single-CC
    /// champions don't saturate the team's CcThreat at 100%.
    /// </summary>
    public double CcScore { get; init; }
    /// <summary>
    /// Meraki 1-3 damage rating. Used to weight AD/AP contributions in the threat profile
    /// so an enchanter dealing magic damage counts less toward ApRatio than a dedicated
    /// mage like Vel'Koz.
    /// </summary>
    public int DamageRating { get; init; }
    public double TankScore { get; init; }
    public string[] Tags { get; init; } = [];
}
