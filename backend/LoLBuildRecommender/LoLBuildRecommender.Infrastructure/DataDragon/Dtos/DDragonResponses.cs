using System.Text.Json.Serialization;

namespace LoLBuildRecommender.Infrastructure.DataDragon.Dtos;

public class DDragonChampionResponse
{
    [JsonPropertyName("data")]
    public Dictionary<string, DDragonChampionDto> Data { get; set; } = new();
}

public class DDragonChampionDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = [];

    [JsonPropertyName("info")]
    public DDragonChampionInfoDto Info { get; set; } = new();

    [JsonPropertyName("image")]
    public DDragonImageDto Image { get; set; } = new();
}

public class DDragonChampionInfoDto
{
    [JsonPropertyName("attack")]
    public int Attack { get; set; }

    [JsonPropertyName("defense")]
    public int Defense { get; set; }

    [JsonPropertyName("magic")]
    public int Magic { get; set; }

    [JsonPropertyName("difficulty")]
    public int Difficulty { get; set; }
}

public class DDragonImageDto
{
    [JsonPropertyName("full")]
    public string Full { get; set; } = string.Empty;
}

public class DDragonItemResponse
{
    [JsonPropertyName("data")]
    public Dictionary<string, DDragonItemDto> Data { get; set; } = new();
}

public class DDragonItemDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("plaintext")]
    public string PlainText { get; set; } = string.Empty;

    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = [];

    [JsonPropertyName("stats")]
    public Dictionary<string, double> Stats { get; set; } = new();

    [JsonPropertyName("gold")]
    public DDragonGoldDto Gold { get; set; } = new();

    [JsonPropertyName("maps")]
    public Dictionary<string, bool> Maps { get; set; } = new();

    [JsonPropertyName("from")]
    public List<string>? From { get; set; }

    [JsonPropertyName("into")]
    public List<string>? Into { get; set; }

    [JsonPropertyName("depth")]
    public int? Depth { get; set; }

    [JsonPropertyName("image")]
    public DDragonImageDto Image { get; set; } = new();

    [JsonPropertyName("requiredChampion")]
    public string? RequiredChampion { get; set; }
}

public class DDragonGoldDto
{
    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("base")]
    public int Base { get; set; }

    [JsonPropertyName("purchasable")]
    public bool Purchasable { get; set; }
}
