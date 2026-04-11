namespace LoLBuildRecommender.Core.Models;

public record ItemInfo
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string PlainText { get; init; } = string.Empty;
    public string[] Tags { get; init; } = [];
    public ItemStats Stats { get; init; } = new();
    public ItemGold Gold { get; init; } = new();
    public int[] BuildsFrom { get; init; } = [];
    public int[] BuildsInto { get; init; } = [];
    public int Depth { get; init; }
    public bool IsAvailableOnSummonersRift { get; init; }
    public string ImageFileName { get; init; } = string.Empty;

    /// <summary>
    /// Pre-built CDN URL to the item icon for the CURRENT Data Dragon patch. Set
    /// server-side so the frontend doesn't need to know the patch version to render
    /// item icons — avoids 404s when a cached frontend uses an outdated default
    /// version for newer items (Spellslinger's Shoes, Endless Hunger, etc.).
    /// </summary>
    public string ImageUrl { get; init; } = string.Empty;

    public ItemClassification Classification { get; init; } = new();
    public string? RequiredChampion { get; init; }
}

public record ItemStats
{
    public double AttackDamage { get; init; }
    public double AbilityPower { get; init; }
    public double Armor { get; init; }
    public double MagicResist { get; init; }
    public double Health { get; init; }
    public double Mana { get; init; }
    public double AttackSpeed { get; init; }
    public double CritChance { get; init; }
    public double MoveSpeed { get; init; }
    public double MoveSpeedPercent { get; init; }
    public double LifeSteal { get; init; }
    public double Lethality { get; init; }
    public double ArmorPen { get; init; }
    public double MagicPen { get; init; }
    public double AbilityHaste { get; init; }
    public bool HasGrievousWounds { get; init; }
    public bool HasTenacity { get; init; }
}

public record ItemGold
{
    public int Total { get; init; }
    public int Base { get; init; }
    public bool Purchasable { get; init; }
}

public record ItemClassification
{
    public bool IsOffensive { get; init; }
    public bool IsDefensive { get; init; }
    public bool IsUtility { get; init; }
    public bool IsBoots { get; init; }
    public bool IsJungleItem { get; init; }
    public bool IsSupportItem { get; init; }
    public bool ProvidesAntiHeal { get; init; }
    public bool ProvidesArmorPen { get; init; }
    public bool ProvidesMagicPen { get; init; }
    public bool ProvidesTenacity { get; init; }
}
