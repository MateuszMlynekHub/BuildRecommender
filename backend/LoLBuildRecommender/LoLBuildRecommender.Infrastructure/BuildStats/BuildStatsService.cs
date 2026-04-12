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

    public async Task<IReadOnlyList<RunePage>> GetTopRunePagesAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<RunePage>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.RuneStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane)
            .OrderByDescending(s => s.Picks)
            .ThenByDescending(s => s.Wins)
            .Take(count)
            .Select(r => new RunePage
            {
                PrimaryStyle = r.PrimaryStyle, SubStyle = r.SubStyle,
                Perks = new[] { r.Perk0, r.Perk1, r.Perk2, r.Perk3, r.Perk4, r.Perk5 },
                StatOffense = r.StatOffense, StatFlex = r.StatFlex, StatDefense = r.StatDefense,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SpellSet>> GetTopSpellsAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<SpellSet>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane)
            .OrderByDescending(s => s.Picks)
            .ThenByDescending(s => s.Wins)
            .Take(count)
            .Select(r => new SpellSet
            {
                Spell1Id = r.Spell1Id, Spell2Id = r.Spell2Id,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<MatchupStat>> GetMatchupsAsync(
        int championId, string lane, int count = 10, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<MatchupStat>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.MatchupStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane)
            .OrderByDescending(s => s.Picks)
            .Take(count)
            .Select(r => new MatchupStat
            {
                OpponentChampionId = r.OpponentChampionId,
                OpponentChampionKey = r.OpponentChampionKey,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<TierListEntry>> GetTierListAsync(
        string? role = null, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<TierListEntry>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Aggregate from SpellStats — each row represents one distinct spell-pair
        // for a champion+role, so SUM(picks) across all spell combos for a champion+role
        // ≈ total games played by that champion in that role (each game has exactly one
        // spell pair). This is a cleaner proxy than ItemStats which has multiple rows per
        // game (one per item in final build).
        var query = db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == patch);

        if (!string.IsNullOrEmpty(role))
            query = query.Where(s => s.Role == role);

        var rows = await query
            .GroupBy(s => new { s.ChampionId, s.ChampionKey, s.Role })
            .Select(g => new TierListEntry
            {
                ChampionId = g.Key.ChampionId,
                ChampionKey = g.Key.ChampionKey,
                Role = g.Key.Role,
                Picks = g.Sum(r => r.Picks),
                Wins = g.Sum(r => r.Wins),
            })
            .OrderByDescending(e => e.Picks)
            .ToListAsync(ct);

        return rows;
    }

    public async Task<IReadOnlyList<MetaShiftEntry>> GetMetaShiftAsync(CancellationToken ct = default)
    {
        var currentPatch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(currentPatch)) return Array.Empty<MetaShiftEntry>();

        // Compute previous patch by decrementing minor version
        var parts = currentPatch.Split('.');
        if (parts.Length < 2 || !int.TryParse(parts[1], out var minor))
            return Array.Empty<MetaShiftEntry>();
        var previousPatch = minor > 1 ? $"{parts[0]}.{minor - 1}" : currentPatch;

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Aggregate from SpellStats for both patches
        var currentData = await db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == currentPatch)
            .GroupBy(s => new { s.ChampionId, s.ChampionKey, s.Role })
            .Select(g => new { g.Key.ChampionId, g.Key.ChampionKey, g.Key.Role,
                Picks = g.Sum(r => r.Picks), Wins = g.Sum(r => r.Wins) })
            .ToListAsync(ct);

        var previousData = await db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == previousPatch)
            .GroupBy(s => new { s.ChampionId, s.ChampionKey, s.Role })
            .Select(g => new { g.Key.ChampionId, g.Key.ChampionKey, g.Key.Role,
                Picks = g.Sum(r => r.Picks), Wins = g.Sum(r => r.Wins) })
            .ToListAsync(ct);

        var prevByKey = previousData.ToDictionary(
            p => (p.ChampionId, p.Role),
            p => (p.Picks, WinRate: p.Picks > 0 ? (double)p.Wins / p.Picks : 0));

        var result = currentData
            .Where(c => c.Picks >= 5) // minimum sample size
            .Select(c =>
            {
                var currentWr = c.Picks > 0 ? (double)c.Wins / c.Picks : 0;
                var prev = prevByKey.GetValueOrDefault((c.ChampionId, c.Role));
                return new MetaShiftEntry
                {
                    ChampionId = c.ChampionId,
                    ChampionKey = c.ChampionKey,
                    Role = c.Role,
                    CurrentPicks = c.Picks,
                    CurrentWinRate = currentWr,
                    PreviousPicks = prev.Picks,
                    PreviousWinRate = prev.WinRate,
                };
            })
            .OrderByDescending(e => Math.Abs(e.WinRateDelta))
            .ToList();

        return result;
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
