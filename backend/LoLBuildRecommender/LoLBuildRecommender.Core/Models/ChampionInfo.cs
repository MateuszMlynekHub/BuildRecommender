namespace LoLBuildRecommender.Core.Models;

public record ChampionInfo
{
    public int Id { get; init; }
    public string Key { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string[] Tags { get; init; } = [];
    public string[] Roles { get; init; } = [];
    public string[] Positions { get; init; } = [];
    public string AdaptiveType { get; init; } = "PHYSICAL_DAMAGE";
    public DamageProfile DamageProfile { get; init; } = new();
    public AttributeRatings AttributeRatings { get; init; } = new();
    public string ImageFileName { get; init; } = string.Empty;
    public bool HasHealing { get; init; }
    public bool HasHardCC { get; init; }
    public bool Resourceless { get; init; }
    // 0.0–1.0 intensity of champion's self/team healing. 0 = no heal, 0.33 = one weak ability
    // heal, 1.0 = dedicated sustain champion (Soraka/Yuumi/Zac). Used by the threat profile
    // so anti-heal priority scales with how much healing the enemy actually produces.
    public double HealingIntensity { get; init; }
    // 0.0–1.0 intensity of champion's hard crowd control. Counted from distinct hard-CC
    // abilities (stuns/knockups/roots/fears/…) not a binary flag — so a team of 5 champs
    // with one CC each doesn't end up rated as "100% CC".
    public double CcScore { get; init; }

    /// <summary>
    /// Recommended skill order inferred from Meraki ability leveling data + override table.
    /// Null when no Meraki data was available for this champion.
    /// </summary>
    public SkillOrder? SkillOrder { get; init; }
}
