namespace LoLBuildRecommender.Api.Dtos;

public record ActiveGameResponse
{
    public long GameId { get; init; }
    public string GameMode { get; init; } = string.Empty;
    public long GameLengthSeconds { get; init; }
    public string SearchedPuuid { get; init; } = string.Empty;
    public List<TeamResponse> Teams { get; init; } = [];
    public List<BannedChampionResponse> Bans { get; init; } = [];
}

public record TeamResponse
{
    public int TeamId { get; init; }
    public List<ParticipantResponse> Participants { get; init; } = [];
}

public record ParticipantResponse
{
    public string Puuid { get; init; } = string.Empty;
    public string RiotId { get; init; } = string.Empty;
    public int ChampionId { get; init; }
    public string ChampionName { get; init; } = string.Empty;
    public string ChampionImageUrl { get; init; } = string.Empty;
    public string[] ChampionTags { get; init; } = [];
    public int TeamId { get; init; }
    public long Spell1Id { get; init; }
    public long Spell2Id { get; init; }
    public PerksResponse Perks { get; init; } = new();
    public string Lane { get; init; } = string.Empty;
}

public record PerksResponse
{
    public List<long> PerkIds { get; init; } = [];
    public long PerkStyle { get; init; }
    public long PerkSubStyle { get; init; }
}

public record BannedChampionResponse
{
    public int ChampionId { get; init; }
    public int TeamId { get; init; }
    public string ChampionName { get; init; } = string.Empty;
    public string ChampionImageUrl { get; init; } = string.Empty;
}

public record RegionResponse
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}
