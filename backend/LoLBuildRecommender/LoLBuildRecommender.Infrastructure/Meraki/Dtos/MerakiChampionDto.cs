using System.Text.Json.Serialization;

namespace LoLBuildRecommender.Infrastructure.Meraki.Dtos;

public class MerakiChampionsResponse : Dictionary<string, MerakiChampionDto> { }

public class MerakiChampionDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("adaptiveType")]
    public string AdaptiveType { get; set; } = string.Empty;

    [JsonPropertyName("roles")]
    public List<string> Roles { get; set; } = [];

    [JsonPropertyName("positions")]
    public List<string> Positions { get; set; } = [];

    [JsonPropertyName("attributeRatings")]
    public MerakiAttributeRatingsDto AttributeRatings { get; set; } = new();

    [JsonPropertyName("abilities")]
    public MerakiAbilitiesDto Abilities { get; set; } = new();

    [JsonPropertyName("resource")]
    public string Resource { get; set; } = string.Empty;
}

public class MerakiAttributeRatingsDto
{
    [JsonPropertyName("damage")]
    public int Damage { get; set; }

    [JsonPropertyName("toughness")]
    public int Toughness { get; set; }

    [JsonPropertyName("control")]
    public int Control { get; set; }

    [JsonPropertyName("mobility")]
    public int Mobility { get; set; }

    [JsonPropertyName("utility")]
    public int Utility { get; set; }
}

public class MerakiAbilitiesDto
{
    [JsonPropertyName("P")]
    public List<MerakiAbilityDto> P { get; set; } = [];

    [JsonPropertyName("Q")]
    public List<MerakiAbilityDto> Q { get; set; } = [];

    [JsonPropertyName("W")]
    public List<MerakiAbilityDto> W { get; set; } = [];

    [JsonPropertyName("E")]
    public List<MerakiAbilityDto> E { get; set; } = [];

    [JsonPropertyName("R")]
    public List<MerakiAbilityDto> R { get; set; } = [];

    public IEnumerable<MerakiAbilityDto> All()
        => P.Concat(Q).Concat(W).Concat(E).Concat(R);
}

public class MerakiAbilityDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("damageType")]
    public string? DamageType { get; set; }

    [JsonPropertyName("effects")]
    public List<MerakiEffectDto> Effects { get; set; } = [];

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class MerakiEffectDto
{
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Per-rank leveling data. Each entry carries an <c>attribute</c> (e.g., "Magic Damage",
    /// "Shield Strength") and a list of modifiers whose <c>values[]</c> arrays hold the
    /// per-rank numbers the ability scales with. Used to infer skill max priority.
    /// </summary>
    [JsonPropertyName("leveling")]
    public List<MerakiLevelingDto> Leveling { get; set; } = [];
}

public class MerakiLevelingDto
{
    [JsonPropertyName("attribute")]
    public string Attribute { get; set; } = string.Empty;

    [JsonPropertyName("modifiers")]
    public List<MerakiModifierDto> Modifiers { get; set; } = [];
}

public class MerakiModifierDto
{
    /// <summary>
    /// Per-ability-rank values (typically 5 entries for ranks 1-5). Summed across modifiers
    /// to compute total scaling for a given effect.
    /// </summary>
    [JsonPropertyName("values")]
    public List<double> Values { get; set; } = [];

    [JsonPropertyName("units")]
    public List<string> Units { get; set; } = [];
}
