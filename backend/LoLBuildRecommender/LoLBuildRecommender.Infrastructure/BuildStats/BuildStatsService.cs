using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Infrastructure.BuildStats.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LoLBuildRecommender.Infrastructure.BuildStats;

/// <summary>
/// Read-side of the build-stats pipeline. Queries the SQLite database on demand —
/// one query per /api/build/recommend call, scoped to the CURRENT patch only.
/// Stale previous-patch data is stored in the same table but never returned.
/// The recommender gets an empty list when no data is available yet and falls back
/// to archetype + counter scoring.
/// </summary>
public class BuildStatsService : IBuildStatsService
{
    private readonly IDbContextFactory<BuildStatsDbContext> _dbFactory;
    private readonly IGameDataService _gameData;
    private readonly BuildStatsCrawler _crawler;
    private readonly ILogger<BuildStatsService> _logger;

    public BuildStatsService(
        IDbContextFactory<BuildStatsDbContext> dbFactory,
        IGameDataService gameData,
        BuildStatsCrawler crawler,
        ILogger<BuildStatsService> logger)
    {
        _dbFactory = dbFactory;
        _gameData = gameData;
        _crawler = crawler;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ItemStat>> GetCoreItemsAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<ItemStat>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Primary query: top-N by picks. Filtered strictly to the current patch so
        // previous-patch data can't leak into recommendations.
        var rows = await db.ItemStats
            .AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane)
            .OrderByDescending(s => s.Picks)
            .ThenByDescending(s => s.Wins)
            .Take(count)
            .Select(r => new ItemStat
            {
                ItemId = r.ItemId,
                ItemName = r.ItemName,
                Picks = r.Picks,
                Wins = r.Wins,
            })
            .ToListAsync(ct);

        return rows;
    }

    public async Task<BuildStatsMetadata> GetMetadataAsync(CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch))
            return new BuildStatsMetadata();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        var meta = await db.CrawlMetadata
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Patch == patch, ct);

        if (meta is null) return new BuildStatsMetadata { Patch = patch };

        return new BuildStatsMetadata
        {
            Patch = meta.Patch,
            UpdatedAt = meta.UpdatedAt,
            MatchesProcessed = meta.MatchesProcessed,
        };
    }

    public async Task RefreshAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("Build stats refresh triggered");
        try
        {
            await _crawler.CrawlAndPersistAsync(ct);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Build stats refresh cancelled");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Build stats refresh crashed — previous data preserved");
        }
    }

    private static string ToMajorMinor(string version)
    {
        if (string.IsNullOrEmpty(version)) return string.Empty;
        var parts = version.Split('.');
        return parts.Length >= 2 ? $"{parts[0]}.{parts[1]}" : version;
    }
}
