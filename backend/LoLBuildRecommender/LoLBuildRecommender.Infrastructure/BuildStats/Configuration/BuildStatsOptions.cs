namespace LoLBuildRecommender.Infrastructure.BuildStats.Configuration;

/// <summary>
/// Tunable settings for the build-stats crawler and background refresh. All tunables
/// live here so the crawler/refresh behavior can be changed without a rebuild — just
/// edit appsettings.json on the VPS and restart.
/// </summary>
public class BuildStatsOptions
{
    public const string SectionName = "BuildStats";

    /// <summary>
    /// Path to the SQLite database file. Relative paths resolve under the API's base
    /// directory, absolute paths are used as-is. Default persists across process restarts
    /// next to the executable.
    /// </summary>
    public string DatabasePath { get; set; } = "data/build-stats.db";

    /// <summary>Riot platform code for the crawl (e.g. "euw1", "na1", "kr"). One region per crawler.</summary>
    public string Region { get; set; } = "euw1";

    /// <summary>
    /// All regions to crawl. Crawler iterates through each region per cycle.
    /// When empty, falls back to single Region. Set via BuildStats__Regions__0=euw1, etc.
    /// </summary>
    public string[] Regions { get; set; } = ["euw1", "na1", "kr", "eun1", "br1", "jp1", "oc1", "tr1"];

    /// <summary>
    /// Include Challenger ladder in the player pool (~200 players per region).
    /// Pros: top-meta picks. Cons: narrow champion diversity.
    /// </summary>
    public bool IncludeChallenger { get; set; } = true;

    /// <summary>
    /// Include Grandmaster ladder (~700 players per region).
    /// Best value for champion coverage — GM players play a broader pool than Challenger.
    /// </summary>
    public bool IncludeGrandmaster { get; set; } = true;

    /// <summary>
    /// Include Master ladder (~2500+ players per region). Enabled by default for maximum
    /// champion coverage — all 170+ champions appear in the dataset with 7-day backfill.
    /// </summary>
    public bool IncludeMaster { get; set; } = true;

    /// <summary>
    /// Total cap on players pulled across all enabled tiers per crawl. Players are sampled
    /// in stratified fashion — equal portions from each enabled tier — so expanding tiers
    /// improves champion diversity without blowing up per-tier sample size.
    /// </summary>
    public int MaxPlayers { get; set; } = 600;

    /// <summary>How many recent ranked matches to fetch per player before dedup.</summary>
    public int MatchesPerPlayer { get; set; } = 20;

    /// <summary>Hard cap on unique match IDs per crawl. Set to 0 for unlimited.</summary>
    public int MaxTotalMatches { get; set; } = 0;

    /// <summary>
    /// Delay between each Riot API request issued by the crawler. Primary mechanism for
    /// keeping the crawler from monopolizing the shared rate-limit budget — with dev key
    /// limits of ~50 req/min, 1500ms → ~40 req/min leaves headroom for live traffic.
    /// Set to 100–300ms when using a production API key (3000 req/min).
    /// </summary>
    public int RequestDelayMs { get; set; } = 1500;

    /// <summary>How often the background service re-runs the crawl.</summary>
    public int CrawlIntervalMinutes { get; set; } = 60;

    /// <summary>
    /// Delay before the first crawl after app startup. Gives live API requests time to
    /// finish and warms up caches before the crawler starts eating rate limits.
    /// </summary>
    public int StartupDelaySeconds { get; set; } = 180;

    /// <summary>
    /// How many days of Challenger match history to pull when the database is empty
    /// for the current patch (first run / new patch). Subsequent hourly crawls run
    /// incrementally and only fetch matches since the last crawl.
    /// </summary>
    public int BackfillDays { get; set; } = 7;

    /// <summary>
    /// Fixed date to backfill from (e.g. "2026-01-08" for season start). When set,
    /// overrides <see cref="BackfillDays"/> on first crawl — the crawler will pull
    /// all matches from this date forward. Leave null/empty to use BackfillDays.
    /// Format: ISO 8601 date string (yyyy-MM-dd).
    /// </summary>
    public string? BackfillSinceDate { get; set; }
}
