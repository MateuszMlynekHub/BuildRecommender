using LoLBuildRecommender.Api.Dtos;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using Microsoft.AspNetCore.Mvc;

namespace LoLBuildRecommender.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DataController : ControllerBase
{
    private readonly IGameDataService _gameData;
    private readonly IBuildStatsService _buildStats;

    public DataController(IGameDataService gameData, IBuildStatsService buildStats)
    {
        _gameData = gameData;
        _buildStats = buildStats;
    }

    [HttpGet("champions")]
    public async Task<ActionResult<Dictionary<int, ChampionInfo>>> GetChampions()
    {
        var champions = await _gameData.GetChampionsAsync();
        return Ok(champions);
    }

    [HttpGet("items")]
    public async Task<ActionResult<Dictionary<int, ItemInfo>>> GetItems()
    {
        var items = await _gameData.GetCompletedItemsAsync();
        return Ok(items);
    }

    [HttpGet("version")]
    public async Task<ActionResult<string>> GetVersion()
    {
        var version = await _gameData.GetCurrentVersionAsync();
        return Ok(version);
    }

    [HttpGet("regions")]
    public ActionResult<List<RegionResponse>> GetRegions()
    {
        var regions = RegionMapping.PlatformDisplayNames
            .Select(kv => new RegionResponse { Id = kv.Key, Name = kv.Value })
            .OrderBy(r => r.Name)
            .ToList();
        return Ok(regions);
    }

    /// <summary>
    /// Diagnostic endpoint for the build-stats crawler. Returns the current patch,
    /// last crawl time, and how many matches have been aggregated. Use this to verify
    /// that the background crawler has finished populating the database — until it has,
    /// the recommender falls back to archetype scoring only and may pick counter items
    /// like Mortal Reminder over core damage items.
    /// </summary>
    [HttpGet("buildstats")]
    public async Task<ActionResult> GetBuildStatsStatus()
    {
        var meta = await _buildStats.GetMetadataAsync();
        return Ok(new
        {
            patch = meta.Patch,
            updatedAt = meta.UpdatedAt,
            matchesProcessed = meta.MatchesProcessed,
            hasData = meta.HasData,
            status = meta.HasData
                ? $"ready ({meta.MatchesProcessed} matches aggregated for patch {meta.Patch})"
                : "empty — crawler hasn't populated the DB yet. Scoring falls back to archetype only.",
        });
    }

    /// <summary>
    /// Read-only diagnostic: top-N historical core items for a specific champion+lane
    /// from the current-patch DB. Does not trigger any API call or crawl — pure SQLite read.
    /// </summary>
    [HttpGet("buildstats/{championId:int}/{lane}")]
    public async Task<ActionResult> GetChampionStats(int championId, string lane, [FromQuery] int count = 10)
    {
        var items = await _buildStats.GetCoreItemsAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(items);
    }

    [HttpGet("tierlist")]
    public async Task<ActionResult> GetTierList([FromQuery] string? role = null)
    {
        var entries = await _buildStats.GetTierListAsync(role?.ToUpperInvariant());
        return Ok(entries);
    }

    [HttpGet("metashift")]
    public async Task<ActionResult> GetMetaShift()
    {
        var entries = await _buildStats.GetMetaShiftAsync();
        return Ok(entries);
    }

    [HttpGet("buildstats/{championId:int}/{lane}/runes")]
    public async Task<ActionResult> GetChampionRunes(int championId, string lane, [FromQuery] int count = 5)
    {
        var runes = await _buildStats.GetTopRunePagesAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(runes);
    }

    [HttpGet("buildstats/{championId:int}/{lane}/spells")]
    public async Task<ActionResult> GetChampionSpells(int championId, string lane, [FromQuery] int count = 5)
    {
        var spells = await _buildStats.GetTopSpellsAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(spells);
    }

    [HttpGet("buildstats/{championId:int}/{lane}/matchups")]
    public async Task<ActionResult> GetChampionMatchups(int championId, string lane, [FromQuery] int count = 10)
    {
        var matchups = await _buildStats.GetMatchupsAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(matchups);
    }
}
