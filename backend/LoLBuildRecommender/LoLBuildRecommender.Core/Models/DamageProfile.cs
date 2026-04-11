namespace LoLBuildRecommender.Core.Models;

public record DamageProfile
{
    public int PhysicalAbilities { get; init; }
    public int MagicAbilities { get; init; }
    public int TrueAbilities { get; init; }
    public DamageType PrimaryDamageType { get; init; }
}

public record AttributeRatings
{
    public int Damage { get; init; }
    public int Toughness { get; init; }
    public int Control { get; init; }
    public int Mobility { get; init; }
    public int Utility { get; init; }
}
