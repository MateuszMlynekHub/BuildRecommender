namespace LoLBuildRecommender.Core.Models;

public record ActiveGameInfo
{
    public long GameId { get; init; }
    public string GameMode { get; init; } = string.Empty;
    public long GameLength { get; init; }
    public string SearchedPuuid { get; init; } = string.Empty;
    public List<GameParticipant> Participants { get; init; } = [];
    public List<BannedChampion> BannedChampions { get; init; } = [];
}

public record GameParticipant
{
    public string Puuid { get; init; } = string.Empty;
    public string RiotId { get; init; } = string.Empty;
    public int ChampionId { get; init; }
    public int TeamId { get; init; }
    public long Spell1Id { get; init; }
    public long Spell2Id { get; init; }
    public ParticipantPerks Perks { get; init; } = new();
    public ChampionInfo? ChampionInfo { get; init; }
}

public record ParticipantPerks
{
    public List<long> PerkIds { get; init; } = [];
    public long PerkStyle { get; init; }
    public long PerkSubStyle { get; init; }
}

public record BannedChampion
{
    public int ChampionId { get; init; }
    public int TeamId { get; init; }
    public int PickTurn { get; init; }
}

/// <summary>
/// Minimal shape of a completed match for the build-stats crawler.
/// Only fields needed to aggregate "which items did each champion buy" are kept.
/// </summary>
public record MatchDetails
{
    public long GameId { get; init; }

    /// <summary>Full game version string from Riot, e.g. "16.7.123.1234" — we use the first two parts as "patch".</summary>
    public string GameVersion { get; init; } = string.Empty;

    /// <summary>Riot queue id. 420 = Solo/Duo Ranked, 440 = Flex — crawler only keeps 420.</summary>
    public int QueueId { get; init; }

    public List<MatchParticipant> Participants { get; init; } = [];
}

public record MatchParticipant
{
    public int ChampionId { get; init; }

    /// <summary>Assigned team position: TOP / JUNGLE / MIDDLE / BOTTOM / UTILITY. May be empty for bot/unassigned games.</summary>
    public string TeamPosition { get; init; } = string.Empty;

    /// <summary>Team ID: 100 (blue) or 200 (red). Used for matchup extraction.</summary>
    public int TeamId { get; init; }

    /// <summary>Final 6 item slots (slot 0-5), plus slot 6 is trinket which we ignore.</summary>
    public int[] Items { get; init; } = [];

    /// <summary>Summoner spell IDs (Flash=4, Ignite=14, TP=12, etc.).</summary>
    public int Summoner1Id { get; init; }
    public int Summoner2Id { get; init; }

    /// <summary>Rune tree IDs. PrimaryStyle is e.g. 8100 (Domination), SubStyle e.g. 8200 (Sorcery).</summary>
    public int PrimaryStyle { get; init; }
    public int SubStyle { get; init; }

    /// <summary>Flat array of 6 perk IDs: 4 from primary tree + 2 from secondary tree.</summary>
    public int[] Perks { get; init; } = [];

    /// <summary>Stat shard IDs (offense, flex, defense rows).</summary>
    public int StatOffense { get; init; }
    public int StatFlex { get; init; }
    public int StatDefense { get; init; }

    public bool Win { get; init; }
}
