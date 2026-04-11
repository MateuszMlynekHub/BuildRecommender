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
