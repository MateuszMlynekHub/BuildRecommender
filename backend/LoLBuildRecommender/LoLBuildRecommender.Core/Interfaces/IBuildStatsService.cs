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

    /// <summary>Top starting item sets (first 90s purchases) for champion+lane.</summary>
    Task<IReadOnlyList<StartingItemEntry>> GetStartingItemsAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default);

    /// <summary>Top 3-item core build paths by picks for champion+lane.</summary>
    Task<IReadOnlyList<BuildOrderEntry>> GetBuildOrdersAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default);

    /// <summary>Top early skill sequences (levels 1-3) for champion+lane.</summary>
    Task<IReadOnlyList<SkillOrderEntry>> GetSkillOrdersAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default);

    /// <summary>Per-individual-rune win/pick rates aggregated across all rune pages for champion+lane.</summary>
    Task<IReadOnlyList<IndividualRuneStat>> GetIndividualRuneStatsAsync(
        int championId, string lane, CancellationToken ct = default);

    /// <summary>Tier list: aggregated win/pick rates per champion per role on current patch.</summary>
    Task<IReadOnlyList<TierListEntry>> GetTierListAsync(string? role = null, CancellationToken ct = default);

    /// <summary>Meta shift: champions with biggest win rate changes between current and previous patch.</summary>
    Task<IReadOnlyList<MetaShiftEntry>> GetMetaShiftAsync(CancellationToken ct = default);

    /// <summary>
    /// Win rate history for a champion across the last several patches. Optionally filtered
    /// by role. Returns one PatchTrend per patch (ordered oldest → newest) so the frontend
    /// can render a line chart. Empty list when no historical data exists.
    /// </summary>
    Task<IReadOnlyList<PatchTrend>> GetPatchTrendsAsync(
        int championId, string? role = null, CancellationToken ct = default);

    /// <summary>
    /// Generate contextual counter tips by comparing two champions' attributes
    /// (healing, CC, damage type, engage, poke, etc.). Returns translation keys
    /// for the frontend to render in the user's language.
    /// </summary>
    Task<IReadOnlyList<CounterTip>> GetCounterTipsAsync(
        int championId, int opponentChampionId, CancellationToken ct = default);

    /// <summary>
    /// Duo synergy data: champion pairs that perform well together, optionally filtered by lane.
    /// Generated from matchup stats by pairing champions that commonly co-occur in the same matches.
    /// </summary>
    Task<IReadOnlyList<DuoSynergy>> GetDuoSynergiesAsync(
        string? lane = null, CancellationToken ct = default);

    /// <summary>
    /// Recent high-elo builds formatted as "pro builds". Until a real pro-player database
    /// is available, returns synthetic data derived from Challenger/Grandmaster matches.
    /// </summary>
    Task<IReadOnlyList<ProBuild>> GetProBuildsAsync(
        string region = "euw1", int count = 20, CancellationToken ct = default);

    /// <summary>
    /// Win rate bucketed by game duration for a specific champion. Since duration isn't
    /// stored per-match yet, returns synthetic estimates based on total picks and champion
    /// archetype tags. Optionally filtered by role.
    /// </summary>
    Task<IReadOnlyList<GameLengthStat>> GetGameLengthStatsAsync(
        int championId, string? role = null, CancellationToken ct = default);

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
