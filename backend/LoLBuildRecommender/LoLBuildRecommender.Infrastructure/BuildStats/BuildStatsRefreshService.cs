using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Infrastructure.BuildStats.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LoLBuildRecommender.Infrastructure.BuildStats;

/// <summary>
/// Fully autonomous background worker that keeps the build-stats database populated
/// without ANY manual triggers. No admin endpoints, no external crons, no operator
/// intervention — runs entirely inside the API process.
///
/// Behavior:
///  • Empty DB on boot → first crawl starts IMMEDIATELY (no startup delay) so users
///    don't wait for data.
///  • Non-empty DB on boot → honors StartupDelaySeconds so live API requests get
///    rate-limit headroom before the background work kicks in.
///  • Hourly ticks → incremental sweep (only matches played since last crawl).
///  • New patch detected → automatic full backfill for the new patch.
///  • Crawl failure (network, rate limit, etc.) → short retry interval (5 min) instead
///    of waiting a full hour. Once a crawl succeeds, reverts to the normal interval.
///
/// The service logs every decision ("first boot backfill", "incremental hourly tick",
/// "patch transition 16.7 → 16.8", "retry after failure") so you can verify the system
/// is self-maintaining from the logs alone, without ever poking an endpoint.
/// </summary>
public class BuildStatsRefreshService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly BuildStatsOptions _options;
    private readonly ILogger<BuildStatsRefreshService> _logger;

    // After a failed tick we retry sooner than the normal interval so we don't sit
    // with empty data for a full hour when the root cause was transient (rate limit,
    // flaky network, Riot 5xx blip).
    private static readonly TimeSpan RetryOnFailure = TimeSpan.FromMinutes(5);

    public BuildStatsRefreshService(
        IServiceProvider services,
        IOptions<BuildStatsOptions> options,
        ILogger<BuildStatsRefreshService> logger)
    {
        _services = services;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "BuildStats refresh service starting. StartupDelay={StartupSec}s (skipped if DB empty), Interval={IntervalMin}min, RetryOnFailure={RetrySec}s",
            _options.StartupDelaySeconds,
            _options.CrawlIntervalMinutes,
            (int)RetryOnFailure.TotalSeconds);

        var normalInterval = TimeSpan.FromMinutes(Math.Max(1, _options.CrawlIntervalMinutes));
        var firstTick = true;

        while (!stoppingToken.IsCancellationRequested)
        {
            // On the very first iteration: apply startup delay ONLY when DB already
            // has data. If empty, start crawling immediately — the user shouldn't be
            // staring at an empty recommender for 20+ seconds.
            if (firstTick)
            {
                firstTick = false;
                var dbEmpty = await IsDatabaseEmptyAsync(stoppingToken);
                if (!dbEmpty && _options.StartupDelaySeconds > 0)
                {
                    _logger.LogInformation(
                        "DB already has data — waiting {Delay}s before first background refresh",
                        _options.StartupDelaySeconds);
                    try
                    {
                        await Task.Delay(
                            TimeSpan.FromSeconds(_options.StartupDelaySeconds),
                            stoppingToken);
                    }
                    catch (OperationCanceledException) { return; }
                }
                else if (dbEmpty)
                {
                    _logger.LogInformation("DB empty — triggering first crawl immediately, skipping startup delay");
                }
            }

            var nextInterval = normalInterval;
            try
            {
                var succeeded = await RunTickAsync(stoppingToken);
                if (!succeeded)
                {
                    _logger.LogWarning("Refresh tick finished without writing data — retrying in {Retry}", RetryOnFailure);
                    nextInterval = RetryOnFailure;
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "BuildStats refresh tick crashed — retrying in {Retry}",
                    RetryOnFailure);
                nextInterval = RetryOnFailure;
            }

            try { await Task.Delay(nextInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    /// <summary>
    /// Performs one refresh cycle. Returns true when the crawler wrote data (or determined
    /// none was needed), false on a soft failure that should shorten the retry interval.
    /// </summary>
    private async Task<bool> RunTickAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var buildStats = scope.ServiceProvider.GetRequiredService<IBuildStatsService>();
        var gameData = scope.ServiceProvider.GetRequiredService<IGameDataService>();

        var metaBefore = await buildStats.GetMetadataAsync(ct);
        var currentPatch = ToMajorMinor(await gameData.GetCurrentVersionAsync());
        var reason = DecideRefreshReason(metaBefore, currentPatch);

        if (reason is null)
        {
            _logger.LogDebug(
                "BuildStats up to date (patch={Patch}, matches={Matches}) — no action",
                metaBefore.Patch, metaBefore.MatchesProcessed);
            return true;
        }

        _logger.LogInformation("BuildStats refresh: {Reason}", reason);
        await buildStats.RefreshAsync(ct);

        // Verify the crawl actually moved the needle — if metadata didn't advance we
        // treat it as a soft failure so the retry schedule kicks in.
        var metaAfter = await buildStats.GetMetadataAsync(ct);
        var advanced = metaAfter.UpdatedAt > metaBefore.UpdatedAt
                       || metaAfter.MatchesProcessed > metaBefore.MatchesProcessed;
        return advanced;
    }

    private async Task<bool> IsDatabaseEmptyAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var buildStats = scope.ServiceProvider.GetRequiredService<IBuildStatsService>();
        var meta = await buildStats.GetMetadataAsync(ct);
        return !meta.HasData;
    }

    private static string? DecideRefreshReason(BuildStatsMetadata metadata, string currentPatch)
    {
        if (!metadata.HasData) return "empty DB — running first-time backfill";
        if (!string.Equals(metadata.Patch, currentPatch, StringComparison.Ordinal))
            return $"patch transition {metadata.Patch} → {currentPatch} — running full backfill for new patch";
        return "hourly interval tick — incremental sweep";
    }

    private static string ToMajorMinor(string version)
    {
        if (string.IsNullOrEmpty(version)) return string.Empty;
        var parts = version.Split('.');
        return parts.Length >= 2 ? $"{parts[0]}.{parts[1]}" : version;
    }
}
