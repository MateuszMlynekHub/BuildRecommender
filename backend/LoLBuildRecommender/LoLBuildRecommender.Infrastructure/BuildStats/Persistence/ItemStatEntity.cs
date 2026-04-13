namespace LoLBuildRecommender.Infrastructure.BuildStats.Persistence;

/// <summary>
/// One row per (patch, champion, role, item). The unique constraint on those 4 columns
/// guarantees we never duplicate within a single aggregation run. Old-patch rows stay
/// in the table forever (historical) but are filtered out at query time — queries
/// always scope by `Patch = currentPatch`.
/// </summary>
public class ItemStatEntity
{
    public int Id { get; set; }

    /// <summary>Major.minor patch this row belongs to, e.g. "16.7".</summary>
    public string Patch { get; set; } = string.Empty;

    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int ItemId { get; set; }
    public string ItemName { get; set; } = string.Empty;

    public int Picks { get; set; }
    public int Wins { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public class CrawlMetadataEntity
{
    /// <summary>PK — only one metadata row per patch.</summary>
    public string Patch { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; }

    /// <summary>Cumulative number of distinct matches aggregated into ItemStats for this patch.</summary>
    public int MatchesProcessed { get; set; }

    /// <summary>
    /// Version stamp of the crawler code that produced this data. Bumped in the code
    /// whenever aggregation semantics change (new item aliases, new exclusion groups,
    /// new archetype detection). On startup, if the stored value is lower than the
    /// code's current version, the crawler wipes this patch's data and rebackfills
    /// so old aggregates don't leak incorrect stats.
    /// </summary>
    public int DataVersion { get; set; }
}

/// <summary>
/// Tracks match IDs already aggregated into ItemStats so incremental (hourly) crawls
/// don't double-count the same match when the Riot API returns overlapping results.
/// PK on MatchId alone — a match belongs to exactly one patch, so the Patch column
/// only exists so we can prune rows on patch change.
/// </summary>
public class ProcessedMatchEntity
{
    public string MatchId { get; set; } = string.Empty;
    public string Patch { get; set; } = string.Empty;
    public DateTime ProcessedAt { get; set; }
}

/// <summary>
/// One row per (patch, champion, role, full rune page). The unique constraint on those
/// columns plus the six perk slots and stat shards guarantees no duplicates within a
/// single aggregation run. Old-patch rows stay in the table forever (historical) but
/// are filtered out at query time — queries always scope by `Patch = currentPatch`.
/// </summary>
public class RuneStatEntity
{
    public int Id { get; set; }

    /// <summary>Major.minor patch this row belongs to, e.g. "16.7".</summary>
    public string Patch { get; set; } = string.Empty;

    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;

    public int PrimaryStyle { get; set; }
    public int SubStyle { get; set; }

    public int Perk0 { get; set; }
    public int Perk1 { get; set; }
    public int Perk2 { get; set; }
    public int Perk3 { get; set; }
    public int Perk4 { get; set; }
    public int Perk5 { get; set; }

    public int StatOffense { get; set; }
    public int StatFlex { get; set; }
    public int StatDefense { get; set; }

    public int Picks { get; set; }
    public int Wins { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// One row per (patch, champion, role, spell pair). Spell IDs are always normalized so
/// that Spell1Id &lt;= Spell2Id, ensuring Flash+Ignite and Ignite+Flash map to the same
/// row. Old-patch rows stay in the table forever (historical) but are filtered out at
/// query time — queries always scope by `Patch = currentPatch`.
/// </summary>
public class SpellStatEntity
{
    public int Id { get; set; }

    /// <summary>Major.minor patch this row belongs to, e.g. "16.7".</summary>
    public string Patch { get; set; } = string.Empty;

    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;

    /// <summary>Always the smaller spell ID of the pair (normalized: min).</summary>
    public int Spell1Id { get; set; }

    /// <summary>Always the larger spell ID of the pair (normalized: max).</summary>
    public int Spell2Id { get; set; }

    public int Picks { get; set; }
    public int Wins { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// One row per (patch, champion, role, opponent champion). Tracks how often a champion
/// faces each opponent in a given role and how many of those games are won. Old-patch
/// rows stay in the table forever (historical) but are filtered out at query time —
/// queries always scope by `Patch = currentPatch`.
/// </summary>
public class MatchupStatEntity
{
    public int Id { get; set; }

    /// <summary>Major.minor patch this row belongs to, e.g. "16.7".</summary>
    public string Patch { get; set; } = string.Empty;

    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;

    public int OpponentChampionId { get; set; }
    public string OpponentChampionKey { get; set; } = string.Empty;

    public int Picks { get; set; }
    public int Wins { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Tracks 3-item core build paths per champion+role. Items extracted from final inventory,
/// filtered to completed non-boots items, ordered by slot position (proxy for build order).
/// </summary>
public class BuildOrderStatEntity
{
    public int Id { get; set; }
    public string Patch { get; set; } = string.Empty;
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int Item1Id { get; set; }
    public int Item2Id { get; set; }
    public int Item3Id { get; set; }
    public int Picks { get; set; }
    public int Wins { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Per-role skill order tracking — which early skill sequence (levels 1-3) is used per role.
/// </summary>
public class SkillOrderStatEntity
{
    public int Id { get; set; }
    public string Patch { get; set; } = string.Empty;
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    /// <summary>Comma-separated first 3 skills, e.g. "Q,E,W" or "E,Q,W".</summary>
    public string EarlySkillSequence { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Tracks how often each champion is banned per patch.</summary>
public class BanStatEntity
{
    public int Id { get; set; }
    public string Patch { get; set; } = string.Empty;
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    /// <summary>Number of matches where this champion was banned.</summary>
    public int Bans { get; set; }
    /// <summary>Total matches observed (denominator for ban rate).</summary>
    public int TotalMatches { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Starting items purchased in the first 90 seconds of the game.
/// Comma-separated item IDs sorted ascending, e.g. "1055,2003,2003" = Doran's Blade + 2 Health Pots.
/// </summary>
public class StartingItemStatEntity
{
    public int Id { get; set; }
    public string Patch { get; set; } = string.Empty;
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    /// <summary>Comma-separated starting item IDs, sorted ascending.</summary>
    public string ItemIds { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// One row per participant in a crawled high-elo match. Stores the full final build,
/// KDA, and outcome so the "Pro Builds" page can display real match data with pagination.
/// </summary>
public class CrawledMatchParticipantEntity
{
    public int Id { get; set; }
    public string Patch { get; set; } = string.Empty;
    public string MatchId { get; set; } = string.Empty;
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int TeamId { get; set; }
    /// <summary>Comma-separated final item IDs (slot 0-5, zeroes excluded).</summary>
    public string Items { get; set; } = string.Empty;
    public int Kills { get; set; }
    public int Deaths { get; set; }
    public int Assists { get; set; }
    public bool Win { get; set; }
    public int Spell1Id { get; set; }
    public int Spell2Id { get; set; }
    /// <summary>Pro player name if matched from the pro player list, null otherwise.</summary>
    public string? PlayerName { get; set; }
    /// <summary>Pro player team if matched, null otherwise.</summary>
    public string? PlayerTeam { get; set; }
    public DateTime CrawledAt { get; set; }
}
