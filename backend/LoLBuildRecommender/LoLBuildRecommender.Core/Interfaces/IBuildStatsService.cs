using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Interfaces;

/// <summary>
/// Serves aggregated pro/high-elo build statistics to the recommender. Data is sourced
/// from the Riot Match API by a background crawler, persisted in a SQLite database
/// tagged per patch, and refreshed hourly. Queries always filter by the current Data
/// Dragon patch — stale data from previous patches is never served.
/// </summary>
public interface IBuildStatsService
{
    /// <summary>
    /// Top-N items for a champion in a role on the CURRENT patch, ordered by pick frequency.
    /// Returns an empty list when no data is available yet — the recommender falls back to
    /// archetype + counter-value scoring in that case.
    /// </summary>
    Task<IReadOnlyList<ItemStat>> GetCoreItemsAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default);

    /// <summary>Top rune pages by pick frequency for a champion+lane on the current patch.</summary>
    Task<IReadOnlyList<RunePage>> GetTopRunePagesAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default);

    /// <summary>Top summoner spell pairs by pick frequency.</summary>
    Task<IReadOnlyList<SpellSet>> GetTopSpellsAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default);

    /// <summary>Matchup stats: win rates against each opponent champion in lane.</summary>
    Task<IReadOnlyList<MatchupStat>> GetMatchupsAsync(
        int championId, string lane, int count = 10, CancellationToken ct = default);

    /// <summary>Tier list: aggregated win/pick rates per champion per role on current patch.</summary>
    Task<IReadOnlyList<TierListEntry>> GetTierListAsync(string? role = null, CancellationToken ct = default);

    /// <summary>Meta shift: champions with biggest win rate changes between current and previous patch.</summary>
    Task<IReadOnlyList<MetaShiftEntry>> GetMetaShiftAsync(CancellationToken ct = default);

    /// <summary>Metadata about the last successful crawl — patch, time, sample size.</summary>
    Task<BuildStatsMetadata> GetMetadataAsync(CancellationToken ct = default);

    /// <summary>Force a fresh crawl from the Riot Match API. Normally called by the background service.</summary>
    Task RefreshAsync(CancellationToken ct = default);
}

public record BuildStatsMetadata
{
    public string Patch { get; init; } = string.Empty;
    public DateTime? UpdatedAt { get; init; }
    public int MatchesProcessed { get; init; }
    public bool HasData => MatchesProcessed > 0;
}
