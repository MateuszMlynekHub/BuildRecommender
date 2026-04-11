using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Interfaces;

public record MerakiChampionData
{
    public string AdaptiveType { get; init; } = "PHYSICAL_DAMAGE";
    public string[] Roles { get; init; } = [];
    public string[] Positions { get; init; } = [];
    public AttributeRatings AttributeRatings { get; init; } = new();
    public DamageProfile DamageProfile { get; init; } = new();
    public bool HasHealing { get; init; }
    public bool HasHardCC { get; init; }
    public bool Resourceless { get; init; }
    public double HealingIntensity { get; init; }
    public double CcScore { get; init; }

    /// <summary>
    /// Q/W/E max priority + level-1 pick inferred from ability leveling data. Null when
    /// Meraki didn't expose enough per-rank scaling to make a call.
    /// </summary>
    public SkillOrder? SkillOrder { get; init; }
}

public interface IMerakiService
{
    Task<Dictionary<string, MerakiChampionData>> GetAllChampionsAsync();
}
