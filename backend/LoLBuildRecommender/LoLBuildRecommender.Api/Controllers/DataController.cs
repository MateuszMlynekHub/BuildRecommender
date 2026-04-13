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
    private readonly ILogger<DataController> _logger;

    public DataController(IGameDataService gameData, IBuildStatsService buildStats, ILogger<DataController> logger)
    {
        _gameData = gameData;
        _buildStats = buildStats;
        _logger = logger;
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

    [HttpGet("items/all")]
    public async Task<ActionResult> GetAllItems()
    {
        var items = await _gameData.GetAllItemsAsync();
        // Also fetch common component items by trying known IDs
        // Return a lightweight version: id -> { name, imageUrl, plainText, gold, stats }
        return Ok(items.ToDictionary(
            kv => kv.Key,
            kv => new
            {
                name = kv.Value.Name,
                imageUrl = kv.Value.ImageUrl,
                plainText = kv.Value.PlainText,
                gold = kv.Value.Gold.Total,
                stats = FormatStats(kv.Value.Stats),
            }));
    }

    private static Dictionary<string, string> FormatStats(ItemStats s)
    {
        var result = new Dictionary<string, string>();
        if (s.AttackDamage > 0) result["AD"] = $"+{s.AttackDamage:0}";
        if (s.AbilityPower > 0) result["AP"] = $"+{s.AbilityPower:0}";
        if (s.Health > 0) result["HP"] = $"+{s.Health:0}";
        if (s.Mana > 0) result["Mana"] = $"+{s.Mana:0}";
        if (s.Armor > 0) result["Armor"] = $"+{s.Armor:0}";
        if (s.MagicResist > 0) result["MR"] = $"+{s.MagicResist:0}";
        if (s.AttackSpeed > 0) result["AS"] = $"+{s.AttackSpeed:0}%";
        if (s.CritChance > 0) result["Crit"] = $"+{s.CritChance:0}%";
        if (s.AbilityHaste > 0) result["AH"] = $"+{s.AbilityHaste:0}";
        if (s.LifeSteal > 0) result["LS"] = $"+{s.LifeSteal:0}%";
        if (s.Lethality > 0) result["Leth"] = $"+{s.Lethality:0}";
        if (s.ArmorPen > 0) result["ArPen"] = $"+{s.ArmorPen:0}%";
        if (s.MagicPen > 0) result["MPen"] = $"+{s.MagicPen:0}";
        if (s.MoveSpeed > 0) result["MS"] = $"+{s.MoveSpeed:0}";
        if (s.MoveSpeedPercent > 0) result["MS%"] = $"+{s.MoveSpeedPercent:0}%";
        return result;
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
    public async Task<ActionResult> GetBuildStatsStatus([FromQuery] string? tier = null)
    {
        var normalizedTier = RankFilter.Normalize(tier);
        if (normalizedTier != "ALL")
            _logger.LogInformation("Build stats requested with tier filter {Tier} — not yet implemented, serving ALL", normalizedTier);

        var meta = await _buildStats.GetMetadataAsync();
        return Ok(new
        {
            patch = meta.Patch,
            updatedAt = meta.UpdatedAt,
            matchesProcessed = meta.MatchesProcessed,
            hasData = meta.HasData,
            tier = normalizedTier,
            status = meta.HasData
                ? $"ready ({meta.MatchesProcessed} matches aggregated for patch {meta.Patch})"
                : "empty — crawler hasn't populated the DB yet. Scoring falls back to archetype only.",
        });
    }

    /// <summary>
    /// Manually trigger a crawl. Use this to backfill data on demand.
    /// In production, protect this endpoint with auth.
    /// </summary>
    [HttpPost("buildstats/crawl")]
    public async Task<ActionResult> TriggerCrawl()
    {
        _logger.LogInformation("Manual crawl triggered via API");
        try
        {
            await _buildStats.RefreshAsync();
            var meta = await _buildStats.GetMetadataAsync();
            return Ok(new
            {
                message = "Crawl completed",
                patch = meta.Patch,
                matchesProcessed = meta.MatchesProcessed,
                updatedAt = meta.UpdatedAt,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual crawl failed");
            return StatusCode(500, new { message = $"Crawl failed: {ex.Message}" });
        }
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
    public async Task<ActionResult> GetTierList([FromQuery] string? role = null, [FromQuery] string? tier = null)
    {
        var normalizedTier = RankFilter.Normalize(tier);
        if (normalizedTier != "ALL")
            _logger.LogInformation("Tier list requested with tier filter {Tier} — not yet implemented, serving ALL", normalizedTier);

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

    [HttpGet("buildstats/{championId:int}/{lane}/runes/individual")]
    public async Task<ActionResult> GetIndividualRuneStats(int championId, string lane)
    {
        var stats = await _buildStats.GetIndividualRuneStatsAsync(championId, lane.ToUpperInvariant());
        return Ok(stats);
    }

    [HttpGet("buildstats/{championId:int}/{lane}/spells")]
    public async Task<ActionResult> GetChampionSpells(int championId, string lane, [FromQuery] int count = 5)
    {
        var spells = await _buildStats.GetTopSpellsAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(spells);
    }

    [HttpGet("buildstats/{championId:int}/{lane}/startingitems")]
    public async Task<ActionResult> GetChampionStartingItems(int championId, string lane, [FromQuery] int count = 5)
    {
        var items = await _buildStats.GetStartingItemsAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(items);
    }

    [HttpGet("buildstats/{championId:int}/{lane}/buildorder")]
    public async Task<ActionResult> GetChampionBuildOrder(int championId, string lane, [FromQuery] int count = 5)
    {
        var orders = await _buildStats.GetBuildOrdersAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(orders);
    }

    [HttpGet("buildstats/{championId:int}/{lane}/skillorder")]
    public async Task<ActionResult> GetChampionSkillOrder(int championId, string lane, [FromQuery] int count = 5)
    {
        var orders = await _buildStats.GetSkillOrdersAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(orders);
    }

    [HttpGet("buildstats/{championId:int}/{lane}/matchups")]
    public async Task<ActionResult> GetChampionMatchups(int championId, string lane, [FromQuery] int count = 10)
    {
        var matchups = await _buildStats.GetMatchupsAsync(championId, lane.ToUpperInvariant(), count);
        return Ok(matchups);
    }

    /// <summary>
    /// Win rate history for a champion across the last several patches, used to render
    /// trend line charts. Optionally filtered by role.
    /// </summary>
    [HttpGet("trends/{championId:int}")]
    public async Task<ActionResult> GetPatchTrends(int championId, [FromQuery] string? role = null)
    {
        var trends = await _buildStats.GetPatchTrendsAsync(
            championId, role?.ToUpperInvariant());
        return Ok(trends);
    }

    /// <summary>
    /// Contextual counter tips comparing two champions' attributes (healing, CC, damage
    /// type, engage, poke, etc.). Returns translation keys for the frontend to render
    /// in the user's language.
    /// </summary>
    [HttpGet("countertips/{championId:int}/{opponentId:int}")]
    public async Task<ActionResult> GetCounterTips(int championId, int opponentId)
    {
        var tips = await _buildStats.GetCounterTipsAsync(championId, opponentId);
        return Ok(tips);
    }

    /// <summary>
    /// Win rate bucketed by game duration for a specific champion. Currently returns
    /// synthetic estimates based on total picks and champion archetype — will use real
    /// per-match duration data once the crawler tracks it.
    /// </summary>
    [HttpGet("gamelength/{championId:int}")]
    public async Task<ActionResult> GetGameLengthStats(int championId, [FromQuery] string? role = null)
    {
        var stats = await _buildStats.GetGameLengthStatsAsync(
            championId, role?.ToUpperInvariant());
        return Ok(stats);
    }

    /// <summary>
    /// Tier list for a specific game mode (ARAM, Arena, Ranked). For now returns the
    /// same data as the ranked tier list with a mode tag — the crawler will be extended
    /// later to collect ARAM/Arena data separately.
    /// </summary>
    [HttpGet("tierlist/{mode}")]
    public async Task<ActionResult> GetModeTierList(string mode, [FromQuery] string? role = null)
    {
        var normalizedMode = mode.ToUpperInvariant();
        var entries = await _buildStats.GetTierListAsync(role?.ToUpperInvariant());

        // When mode differs from RANKED, adjust win rates using champion archetype
        // heuristics. This simulates mode-specific data until the crawler collects
        // real ARAM / Arena matches.
        if (normalizedMode != "RANKED" && entries.Count > 0)
        {
            var champions = await _gameData.GetChampionsAsync();
            var adjusted = entries.Select(e =>
            {
                champions.TryGetValue(e.ChampionId, out var champ);
                var tags = champ?.Tags ?? [];
                var attr = champ?.AttributeRatings ?? new AttributeRatings();
                double modifier = 0;

                if (normalizedMode == "ARAM")
                {
                    // ARAM favours: long-range poke, AoE, sustain, waveclear
                    if (tags.Contains("Mage")) modifier += 0.025;
                    if (attr.Damage >= 3) modifier += 0.01;
                    if (champ?.HealingIntensity >= 0.5) modifier += 0.02;
                    // ARAM punishes: short-range melee without engage
                    if (tags.Contains("Assassin") && !tags.Contains("Fighter")) modifier -= 0.03;
                    if (attr.Toughness <= 1 && !tags.Contains("Mage") && !tags.Contains("Marksman")) modifier -= 0.02;
                    // Marksmen are strong — constant teamfights
                    if (tags.Contains("Marksman")) modifier += 0.015;
                    // Tanks with engage thrive
                    if (tags.Contains("Tank") && attr.Control >= 2) modifier += 0.02;
                }
                else if (normalizedMode == "ARENA")
                {
                    // Arena (2v2) favours: duelists, sustain fighters, assassins
                    if (tags.Contains("Fighter") && attr.Damage >= 2) modifier += 0.03;
                    if (tags.Contains("Assassin")) modifier += 0.025;
                    if (champ?.HealingIntensity >= 0.4) modifier += 0.02;
                    // Arena punishes: enchanters without damage, pure tanks
                    if (tags.Contains("Support") && attr.Damage <= 1) modifier -= 0.04;
                    if (tags.Contains("Tank") && attr.Damage <= 1) modifier -= 0.03;
                    // Poke mages weaker in small arena
                    if (tags.Contains("Mage") && attr.Toughness <= 1) modifier -= 0.015;
                    // Marksmen without self-peel struggle
                    if (tags.Contains("Marksman") && attr.Toughness <= 1) modifier -= 0.01;
                }

                var newWinRate = Math.Clamp(e.WinRate + modifier, 0.30, 0.70);
                var newWins = (int)Math.Round(newWinRate * e.Picks);
                return new TierListEntry
                {
                    ChampionId = e.ChampionId,
                    ChampionKey = e.ChampionKey,
                    Role = normalizedMode == "ARENA" ? "ARENA" : e.Role,
                    Picks = e.Picks,
                    Wins = newWins,
                    Bans = e.Bans,
                    TotalMatches = e.TotalMatches,
                };
            }).ToList();

            // Re-sort by adjusted win rate
            adjusted.Sort((a, b) => b.WinRate.CompareTo(a.WinRate));
            return Ok(new { mode = normalizedMode, entries = adjusted });
        }

        return Ok(new { mode = normalizedMode, entries });
    }

    /// <summary>
    /// Duo synergy data: champion pairs that perform well together, optionally filtered
    /// by lane. Generated from matchup statistics.
    /// </summary>
    [HttpGet("duosynergy")]
    public async Task<ActionResult> GetDuoSynergies([FromQuery] string? lane = null)
    {
        var synergies = await _buildStats.GetDuoSynergiesAsync(lane);
        return Ok(synergies);
    }

    /// <summary>
    /// Recent high-elo builds formatted as "pro builds". Until a real pro-player
    /// database is available, returns Challenger match data.
    /// </summary>
    [HttpGet("probuilds")]
    public async Task<ActionResult> GetProBuilds(
        [FromQuery] string region = "euw1", [FromQuery] int count = 20, [FromQuery] int offset = 0)
    {
        count = Math.Clamp(count, 1, 100);
        offset = Math.Max(offset, 0);
        var builds = await _buildStats.GetProBuildsAsync(region, count, offset);
        return Ok(builds);
    }
}
