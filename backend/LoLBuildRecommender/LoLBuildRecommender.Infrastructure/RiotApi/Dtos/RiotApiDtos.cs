using System.Text.Json.Serialization;

namespace LoLBuildRecommender.Infrastructure.RiotApi.Dtos;

public class RiotAccountDto
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = string.Empty;

    [JsonPropertyName("gameName")]
    public string GameName { get; set; } = string.Empty;

    [JsonPropertyName("tagLine")]
    public string TagLine { get; set; } = string.Empty;
}

public class SpectatorGameDto
{
    [JsonPropertyName("gameId")]
    public long GameId { get; set; }

    [JsonPropertyName("gameMode")]
    public string GameMode { get; set; } = string.Empty;

    [JsonPropertyName("gameLength")]
    public long GameLength { get; set; }

    [JsonPropertyName("participants")]
    public List<SpectatorParticipantDto> Participants { get; set; } = [];

    [JsonPropertyName("bannedChampions")]
    public List<SpectatorBannedChampionDto> BannedChampions { get; set; } = [];
}

public class SpectatorParticipantDto
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = string.Empty;

    [JsonPropertyName("riotId")]
    public string RiotId { get; set; } = string.Empty;

    [JsonPropertyName("championId")]
    public int ChampionId { get; set; }

    [JsonPropertyName("teamId")]
    public int TeamId { get; set; }

    [JsonPropertyName("spell1Id")]
    public long Spell1Id { get; set; }

    [JsonPropertyName("spell2Id")]
    public long Spell2Id { get; set; }

    [JsonPropertyName("perks")]
    public SpectatorPerksDto? Perks { get; set; }
}

public class SpectatorPerksDto
{
    [JsonPropertyName("perkIds")]
    public List<long> PerkIds { get; set; } = [];

    [JsonPropertyName("perkStyle")]
    public long PerkStyle { get; set; }

    [JsonPropertyName("perkSubStyle")]
    public long PerkSubStyle { get; set; }
}

public class SpectatorBannedChampionDto
{
    [JsonPropertyName("championId")]
    public int ChampionId { get; set; }

    [JsonPropertyName("teamId")]
    public int TeamId { get; set; }

    [JsonPropertyName("pickTurn")]
    public int PickTurn { get; set; }
}

// ---- League / Match API DTOs used by the build-stats crawler ----

public class LeagueListDto
{
    [JsonPropertyName("entries")]
    public List<LeagueEntryDto> Entries { get; set; } = [];
}

public class LeagueEntryDto
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = string.Empty;

    [JsonPropertyName("summonerId")]
    public string SummonerId { get; set; } = string.Empty;
}

public class MatchDto
{
    [JsonPropertyName("info")]
    public MatchInfoDto Info { get; set; } = new();
}

public class MatchInfoDto
{
    [JsonPropertyName("gameId")]
    public long GameId { get; set; }

    [JsonPropertyName("gameVersion")]
    public string GameVersion { get; set; } = string.Empty;

    [JsonPropertyName("queueId")]
    public int QueueId { get; set; }

    [JsonPropertyName("gameDuration")]
    public long GameDuration { get; set; }

    [JsonPropertyName("participants")]
    public List<MatchParticipantDto> Participants { get; set; } = [];

    [JsonPropertyName("teams")]
    public List<MatchTeamDto> Teams { get; set; } = [];
}

public class MatchTeamDto
{
    [JsonPropertyName("bans")]
    public List<MatchBanDto> Bans { get; set; } = [];
}

public class MatchBanDto
{
    [JsonPropertyName("championId")]
    public int ChampionId { get; set; }
}

public class MatchParticipantDto
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = string.Empty;

    [JsonPropertyName("championId")]
    public int ChampionId { get; set; }

    [JsonPropertyName("championName")]
    public string ChampionName { get; set; } = string.Empty;

    [JsonPropertyName("kills")]
    public int Kills { get; set; }

    [JsonPropertyName("deaths")]
    public int Deaths { get; set; }

    [JsonPropertyName("assists")]
    public int Assists { get; set; }

    [JsonPropertyName("totalMinionsKilled")]
    public int TotalMinionsKilled { get; set; }

    [JsonPropertyName("neutralMinionsKilled")]
    public int NeutralMinionsKilled { get; set; }

    [JsonPropertyName("wardsPlaced")]
    public int WardsPlaced { get; set; }

    [JsonPropertyName("totalDamageDealtToChampions")]
    public long TotalDamageDealtToChampions { get; set; }

    [JsonPropertyName("goldEarned")]
    public int GoldEarned { get; set; }

    [JsonPropertyName("champLevel")]
    public int ChampLevel { get; set; }

    [JsonPropertyName("teamPosition")]
    public string TeamPosition { get; set; } = string.Empty;

    [JsonPropertyName("teamId")]
    public int TeamId { get; set; }

    [JsonPropertyName("item0")] public int Item0 { get; set; }
    [JsonPropertyName("item1")] public int Item1 { get; set; }
    [JsonPropertyName("item2")] public int Item2 { get; set; }
    [JsonPropertyName("item3")] public int Item3 { get; set; }
    [JsonPropertyName("item4")] public int Item4 { get; set; }
    [JsonPropertyName("item5")] public int Item5 { get; set; }

    [JsonPropertyName("summoner1Id")]
    public int Summoner1Id { get; set; }

    [JsonPropertyName("summoner2Id")]
    public int Summoner2Id { get; set; }

    [JsonPropertyName("perks")]
    public MatchPerksDto? Perks { get; set; }

    [JsonPropertyName("win")]
    public bool Win { get; set; }
}

public class MatchPerksDto
{
    [JsonPropertyName("statPerks")]
    public MatchStatPerksDto StatPerks { get; set; } = new();

    [JsonPropertyName("styles")]
    public List<MatchPerkStyleDto> Styles { get; set; } = [];
}

public class MatchStatPerksDto
{
    [JsonPropertyName("offense")]
    public int Offense { get; set; }

    [JsonPropertyName("flex")]
    public int Flex { get; set; }

    [JsonPropertyName("defense")]
    public int Defense { get; set; }
}

public class MatchPerkStyleDto
{
    [JsonPropertyName("style")]
    public int Style { get; set; }

    [JsonPropertyName("selections")]
    public List<MatchPerkSelectionDto> Selections { get; set; } = [];
}

public class MatchPerkSelectionDto
{
    [JsonPropertyName("perk")]
    public int Perk { get; set; }
}

public class LeagueEntryFullDto
{
    [JsonPropertyName("queueType")]
    public string QueueType { get; set; } = string.Empty;

    [JsonPropertyName("tier")]
    public string Tier { get; set; } = string.Empty;

    [JsonPropertyName("rank")]
    public string Rank { get; set; } = string.Empty;

    [JsonPropertyName("leaguePoints")]
    public int LeaguePoints { get; set; }

    [JsonPropertyName("wins")]
    public int Wins { get; set; }

    [JsonPropertyName("losses")]
    public int Losses { get; set; }
}

public class ChampionMasteryDto
{
    [JsonPropertyName("championId")]
    public int ChampionId { get; set; }

    [JsonPropertyName("championLevel")]
    public int ChampionLevel { get; set; }

    [JsonPropertyName("championPoints")]
    public int ChampionPoints { get; set; }
}
