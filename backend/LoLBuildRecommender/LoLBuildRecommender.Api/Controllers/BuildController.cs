using System.Net;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Infrastructure.RiotApi;
using Microsoft.AspNetCore.Mvc;

namespace LoLBuildRecommender.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BuildController : ControllerBase
{
    private readonly IBuildRecommenderService _recommender;
    private readonly IRiotApiService _riotApi;
    private readonly IGameDataService _gameData;
    private readonly ILogger<BuildController> _logger;

    public BuildController(IBuildRecommenderService recommender, IRiotApiService riotApi, IGameDataService gameData, ILogger<BuildController> logger)
    {
        _recommender = recommender;
        _riotApi = riotApi;
        _gameData = gameData;
        _logger = logger;
    }

    [HttpGet("recommend")]
    public async Task<ActionResult<BuildRecommendation>> RecommendBuild(
        [FromQuery] int championId,
        [FromQuery] string enemyChampions,
        [FromQuery] string? allyChampions = null,
        [FromQuery] string? role = null)
    {
        if (championId <= 0)
            return BadRequest("championId is required");

        if (string.IsNullOrWhiteSpace(enemyChampions))
            return BadRequest("enemyChampions is required");

        if (enemyChampions.Length > 200 || (allyChampions?.Length ?? 0) > 200)
            return BadRequest("Champion list too long");

        var enemyIds = ParseIds(enemyChampions);
        var allyIds = allyChampions is not null ? ParseIds(allyChampions) : [];

        try
        {
            var recommendation = await _recommender.RecommendBuildAsync(championId, enemyIds, allyIds, role);
            return Ok(recommendation);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("gold-efficient")]
    public async Task<ActionResult<GoldRecommendation>> GetGoldEfficientItems(
        [FromQuery] int gold,
        [FromQuery] int? championId = null,
        [FromQuery] string? role = null)
    {
        if (gold <= 0)
            return BadRequest("gold must be a positive integer");

        try
        {
            var result = await _recommender.GetGoldEfficientItemsAsync(gold, championId, role);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// "Roast My Build" — analyzes a player's most recent match and compares their
    /// actual build to what the recommender would have suggested. Returns a score,
    /// grade, and roast comment.
    /// </summary>
    [HttpGet("roast")]
    public async Task<ActionResult> RoastBuild(
        [FromQuery] string gameName,
        [FromQuery] string tagLine,
        [FromQuery] string region)
    {
        if (string.IsNullOrWhiteSpace(gameName) || string.IsNullOrWhiteSpace(tagLine))
            return BadRequest(new { message = "gameName and tagLine are required" });

        string puuid;
        try { puuid = await _riotApi.GetPuuidByRiotIdAsync(gameName, tagLine, region); }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        { return NotFound(new { message = "Summoner not found" }); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to resolve Riot ID for {GameName}#{TagLine}", gameName, tagLine); return StatusCode(502, new { message = "Failed to resolve Riot ID" }); }

        // Fetch most recent ranked match
        string[] matchIds;
        try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, 1); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to fetch matches for puuid={Puuid}", puuid); return StatusCode(502, new { message = "Failed to fetch matches" }); }

        if (matchIds.Length == 0)
            return NotFound(new { message = "No recent ranked games found" });

        MatchDetails? match;
        try { match = await _riotApi.GetMatchDetailsAsync(matchIds[0], region); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to fetch match details for {MatchId}", matchIds[0]); return StatusCode(502, new { message = "Failed to fetch match details" }); }

        if (match is null)
            return NotFound(new { message = "Match data unavailable" });

        var me = match.Participants.FirstOrDefault(p => p.Puuid == puuid);
        if (me is null)
            return NotFound(new { message = "Player not found in match" });

        var champions = await _gameData.GetChampionsAsync();
        var items = await _gameData.GetCompletedItemsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        champions.TryGetValue(me.ChampionId, out var myChamp);

        // Get enemy team champion IDs
        var enemyIds = match.Participants
            .Where(p => p.TeamId != me.TeamId)
            .Select(p => p.ChampionId)
            .ToArray();

        var allyIds = match.Participants
            .Where(p => p.TeamId == me.TeamId && p.Puuid != puuid)
            .Select(p => p.ChampionId)
            .ToArray();

        // Get recommended build
        BuildRecommendation recommendation;
        try
        {
            recommendation = await _recommender.RecommendBuildAsync(
                me.ChampionId, enemyIds, allyIds,
                string.IsNullOrEmpty(me.TeamPosition) ? null : me.TeamPosition);
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to generate recommendation for champion={ChampionId}", me.ChampionId); return StatusCode(500, new { message = "Failed to generate recommendation" }); }

        // Compare actual build to recommended
        var actualItemIds = me.Items.Where(id => id != 0).ToHashSet();
        var optimalItems = recommendation.Variants.FirstOrDefault()?.Items ?? [];
        var optimalItemIds = optimalItems.Select(i => i.Item.Id).ToHashSet();

        // Score: how many of the player's items match the recommended build
        int matches = 0;
        var actualItemList = new List<object>();
        foreach (var itemId in me.Items.Where(id => id != 0))
        {
            items.TryGetValue(itemId, out var itemInfo);
            var isCorrect = optimalItemIds.Contains(itemId);
            if (isCorrect) matches++;
            actualItemList.Add(new
            {
                itemId,
                itemName = itemInfo?.Name ?? $"Item {itemId}",
                imageUrl = itemInfo is not null
                    ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{itemInfo.ImageFileName}" : "",
                isCorrect,
            });
        }

        var optimalItemList = optimalItems.Select(ri => new
        {
            itemId = ri.Item.Id,
            itemName = ri.Item.Name,
            imageUrl = $"https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{ri.Item.ImageFileName}",
            isCorrect = true,
        }).ToList();

        // Calculate score
        int totalItems = Math.Max(actualItemList.Count, 1);
        double rawScore = (double)matches / Math.Max(optimalItems.Count, 1) * 100;

        // Bonus for winning
        if (me.Win) rawScore = Math.Min(100, rawScore + 10);

        // KDA bonus/penalty
        var deaths = Math.Max(me.Deaths, 1);
        var kda = (double)(me.Kills + me.Assists) / deaths;
        if (kda >= 3) rawScore = Math.Min(100, rawScore + 5);
        if (kda < 1) rawScore = Math.Max(0, rawScore - 5);

        var score = (int)Math.Round(Math.Clamp(rawScore, 0, 100));
        var grade = score switch
        {
            >= 90 => "S",
            >= 80 => "A",
            >= 65 => "B",
            >= 50 => "C",
            >= 35 => "D",
            _ => "F",
        };

        // Generate feedback
        var goodChoices = new List<string>();
        var badChoices = new List<string>();

        foreach (var itemId in actualItemIds)
        {
            items.TryGetValue(itemId, out var itemInfo);
            if (itemInfo is null) continue;
            if (optimalItemIds.Contains(itemId))
                goodChoices.Add($"Good choice: {itemInfo.Name}");
        }

        // Find items in optimal but missing from actual
        foreach (var oi in optimalItems)
        {
            if (!actualItemIds.Contains(oi.Item.Id))
            {
                var mainReason = oi.Reasons.FirstOrDefault()?.Key ?? "reason.goodItem";
                badChoices.Add($"Missing: {oi.Item.Name}");
            }
        }

        // Generate roast comment based on score
        var roastComment = score switch
        {
            >= 90 => "Your build is basically perfect. Are you sure you're not a bot?",
            >= 75 => "Solid build. A few tweaks and you'd be challenger... in your dreams.",
            >= 60 => "Not terrible, not great. Like ordering a steak well-done.",
            >= 45 => "Your build needs work. Did you close your eyes and click random items?",
            >= 30 => "This build physically hurts me. Were you trying to lose?",
            _ => "I've seen better builds from a cat walking across a keyboard.",
        };

        return Ok(new
        {
            score,
            grade,
            championName = myChamp?.Name ?? "Unknown",
            actualItems = actualItemList,
            optimalItems = optimalItemList,
            goodChoices,
            badChoices,
            roastComment,
        });
    }

    /// <summary>
    /// Mid-game build advisor: given current items + enemy team, suggests what to buy next.
    /// Compares current inventory against the recommended build and identifies the most
    /// impactful next purchase. Also adapts if the game is going differently than expected
    /// (e.g., enemy ADC is fed → shift to defensive).
    /// </summary>
    [HttpGet("midgame")]
    public async Task<ActionResult> MidGameAdvisor(
        [FromQuery] int championId,
        [FromQuery] string enemyChampions,
        [FromQuery] string? allyChampions = null,
        [FromQuery] string? currentItems = null,
        [FromQuery] int gold = 0,
        [FromQuery] string? role = null,
        [FromQuery] string? gameState = null) // "winning", "losing", "even"
    {
        if (championId <= 0)
            return BadRequest("championId is required");
        if (string.IsNullOrWhiteSpace(enemyChampions))
            return BadRequest("enemyChampions is required");

        var enemyIds = ParseIds(enemyChampions);
        var allyIds = allyChampions is not null ? ParseIds(allyChampions) : Array.Empty<int>();
        var ownedItemIds = currentItems is not null ? ParseIds(currentItems).ToHashSet() : new HashSet<int>();

        // Get recommended build
        BuildRecommendation recommendation;
        try
        {
            recommendation = await _recommender.RecommendBuildAsync(championId, enemyIds, allyIds, role);
        }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }

        // Determine which variant to use based on game state
        var variantStyle = gameState?.ToLowerInvariant() switch
        {
            "losing" => "defensive",
            "winning" => "aggressive",
            _ => "standard",
        };
        var variant = recommendation.Variants.FirstOrDefault(v => v.Style == variantStyle)
            ?? recommendation.Variants.FirstOrDefault();

        if (variant is null)
            return Ok(new { nextItems = Array.Empty<object>(), message = "No recommendation available" });

        var allItems = await _gameData.GetAllItemsAsync();
        var completedItems = await _gameData.GetCompletedItemsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        // Find items in the recommended build that the player doesn't have yet
        var missingItems = variant.Items
            .Where(ri => !ownedItemIds.Contains(ri.Item.Id))
            .ToList();

        // For each missing item, find affordable components or the item itself
        var suggestions = new List<object>();
        foreach (var missing in missingItems.Take(3))
        {
            var item = missing.Item;

            // Can afford the full item?
            if (gold >= item.Gold.Total)
            {
                suggestions.Add(new
                {
                    itemId = item.Id,
                    itemName = item.Name,
                    imageUrl = $"https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{item.ImageFileName}",
                    goldCost = item.Gold.Total,
                    type = "complete",
                    priority = missing.Score,
                    reasons = missing.Reasons.Take(2).Select(r => new { key = r.Key, args = r.Args }),
                });
            }
            else
            {
                // Suggest affordable components
                foreach (var componentId in item.BuildsFrom)
                {
                    if (ownedItemIds.Contains(componentId)) continue;
                    if (!allItems.TryGetValue(componentId, out var component)) continue;
                    if (gold >= component.Gold.Total)
                    {
                        suggestions.Add(new
                        {
                            itemId = component.Id,
                            itemName = component.Name,
                            imageUrl = $"https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{component.ImageFileName}",
                            goldCost = component.Gold.Total,
                            type = "component",
                            buildsInto = item.Name,
                            priority = missing.Score * 0.8,
                            reasons = missing.Reasons.Take(1).Select(r => new { key = r.Key, args = r.Args }),
                        });
                        break; // One component per missing item
                    }
                }
            }
        }

        // Sort by priority
        var sorted = suggestions
            .Cast<dynamic>()
            .OrderByDescending(s => (double)s.priority)
            .Take(5)
            .ToList();

        return Ok(new
        {
            championName = recommendation.ChampionName,
            variantUsed = variantStyle,
            threatProfile = recommendation.EnemyThreatProfile,
            nextItems = sorted,
            completeBuild = variant.Items.Select(ri => new
            {
                itemId = ri.Item.Id,
                itemName = ri.Item.Name,
                imageUrl = $"https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{ri.Item.ImageFileName}",
                owned = ownedItemIds.Contains(ri.Item.Id),
            }),
        });
    }

    /// <summary>
    /// "Best Builder" leaderboard — fetches recent Challenger matches and scores
    /// each player's build via the roast logic. Returns top builders sorted by
    /// average build score.
    /// </summary>
    [HttpGet("roast/leaderboard")]
    public async Task<ActionResult> GetBuildLeaderboard([FromQuery] string region = "euw1")
    {
        string[] puuids;
        try { puuids = await _riotApi.GetChallengerPuuidsAsync(region); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to fetch Challenger players for region={Region}", region); return StatusCode(502, new { message = "Failed to fetch Challenger players" }); }

        var champions = await _gameData.GetChampionsAsync();
        var items = await _gameData.GetCompletedItemsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        var playerScores = new List<object>();

        // Analyze top 15 Challenger players to keep API calls reasonable
        foreach (var puuid in puuids.Take(15))
        {
            try
            {
                string[] matchIds;
                try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, 3); }
                catch (Exception ex) { _logger.LogDebug(ex, "Leaderboard: failed to fetch matches for puuid={Puuid}", puuid); continue; }

                if (matchIds.Length == 0) continue;

                var scores = new List<int>();
                string playerName = "Challenger Player";
                string playerTag = "";
                int profileIconId = 0;

                // Resolve player identity
                if (_riotApi is Infrastructure.RiotApi.RiotApiService riotSvc)
                {
                    try
                    {
                        var account = await riotSvc.GetAccountByPuuidAsync(puuid, region);
                        if (account is not null)
                        {
                            playerName = account.Value.gameName;
                            playerTag = account.Value.tagLine;
                        }
                        var (_, iconId, _) = await riotSvc.GetSummonerByPuuidAsync(puuid, region);
                        profileIconId = iconId;
                    }
                    catch (Exception ex) { _logger.LogDebug(ex, "Leaderboard: failed to resolve identity for puuid={Puuid}", puuid); }
                }

                foreach (var matchId in matchIds)
                {
                    try
                    {
                        var match = await _riotApi.GetMatchDetailsAsync(matchId, region);
                        if (match is null) continue;
                        var me = match.Participants.FirstOrDefault(p => p.Puuid == puuid);
                        if (me is null) continue;

                        var enemyIds = match.Participants
                            .Where(p => p.TeamId != me.TeamId)
                            .Select(p => p.ChampionId).ToArray();
                        var allyIds = match.Participants
                            .Where(p => p.TeamId == me.TeamId && p.Puuid != puuid)
                            .Select(p => p.ChampionId).ToArray();

                        var recommendation = await _recommender.RecommendBuildAsync(
                            me.ChampionId, enemyIds, allyIds,
                            string.IsNullOrEmpty(me.TeamPosition) ? null : me.TeamPosition);

                        var actualItemIds = me.Items.Where(id => id != 0).ToHashSet();
                        var optimalItems = recommendation.Variants.FirstOrDefault()?.Items ?? [];
                        var optimalItemIds = optimalItems.Select(i => i.Item.Id).ToHashSet();

                        int matches2 = actualItemIds.Count(id => optimalItemIds.Contains(id));
                        double rawScore = (double)matches2 / Math.Max(optimalItems.Count, 1) * 100;
                        if (me.Win) rawScore = Math.Min(100, rawScore + 10);
                        var deaths = Math.Max(me.Deaths, 1);
                        var kda = (double)(me.Kills + me.Assists) / deaths;
                        if (kda >= 3) rawScore = Math.Min(100, rawScore + 5);
                        if (kda < 1) rawScore = Math.Max(0, rawScore - 5);
                        scores.Add((int)Math.Round(Math.Clamp(rawScore, 0, 100)));
                    }
                    catch (Exception ex) { _logger.LogDebug(ex, "Leaderboard: failed to score match {MatchId}", matchId); }
                }

                if (scores.Count > 0)
                {
                    var avg = (int)Math.Round(scores.Average());
                    playerScores.Add(new
                    {
                        gameName = playerName,
                        tagLine = playerTag,
                        profileIconUrl = profileIconId > 0
                            ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{profileIconId}.png" : "",
                        averageScore = avg,
                        grade = avg switch
                        {
                            >= 90 => "S",
                            >= 80 => "A",
                            >= 65 => "B",
                            >= 50 => "C",
                            >= 35 => "D",
                            _ => "F",
                        },
                        gamesAnalyzed = scores.Count,
                    });
                }
            }
            catch (Exception ex) { _logger.LogDebug(ex, "Leaderboard: failed to process player puuid={Puuid}", puuid); }
        }

        var sorted = playerScores
            .Cast<dynamic>()
            .OrderByDescending(p => (int)p.averageScore)
            .ToList();

        return Ok(new { entries = sorted });
    }

    /// <summary>
    /// Guild/Team Report — batch analyze multiple players' most recent builds.
    /// Accepts comma-separated "name#tag" Riot IDs.
    /// </summary>
    [HttpGet("roast/team")]
    public async Task<ActionResult> RoastTeam(
        [FromQuery] string players,
        [FromQuery] string region)
    {
        if (string.IsNullOrWhiteSpace(players))
            return BadRequest(new { message = "players parameter is required" });

        var riotIds = ParseRiotIds(players);
        if (riotIds.Count == 0)
            return BadRequest(new { message = "No valid Riot IDs found (use name#tag format)" });

        var champions = await _gameData.GetChampionsAsync();
        var items = await _gameData.GetCompletedItemsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        var playerResults = new List<object>();

        foreach (var (gameName, tagLine) in riotIds.Take(10))
        {
            try
            {
                var puuid = await _riotApi.GetPuuidByRiotIdAsync(gameName, tagLine, region);

                string[] matchIds;
                try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, 1); }
                catch { playerResults.Add(new { gameName, tagLine, found = true, error = "No matches found" }); continue; }

                if (matchIds.Length == 0)
                {
                    playerResults.Add(new { gameName, tagLine, found = true, error = "No recent ranked games" });
                    continue;
                }

                var match = await _riotApi.GetMatchDetailsAsync(matchIds[0], region);
                if (match is null) { playerResults.Add(new { gameName, tagLine, found = true, error = "Match data unavailable" }); continue; }

                var me = match.Participants.FirstOrDefault(p => p.Puuid == puuid);
                if (me is null) { playerResults.Add(new { gameName, tagLine, found = true, error = "Player not in match" }); continue; }

                champions.TryGetValue(me.ChampionId, out var myChamp);

                var enemyIds = match.Participants.Where(p => p.TeamId != me.TeamId).Select(p => p.ChampionId).ToArray();
                var allyIds = match.Participants.Where(p => p.TeamId == me.TeamId && p.Puuid != puuid).Select(p => p.ChampionId).ToArray();

                var recommendation = await _recommender.RecommendBuildAsync(
                    me.ChampionId, enemyIds, allyIds,
                    string.IsNullOrEmpty(me.TeamPosition) ? null : me.TeamPosition);

                var actualItemIds = me.Items.Where(id => id != 0).ToHashSet();
                var optimalItems = recommendation.Variants.FirstOrDefault()?.Items ?? [];
                var optimalItemIds = optimalItems.Select(i => i.Item.Id).ToHashSet();
                int matchCount = actualItemIds.Count(id => optimalItemIds.Contains(id));

                double rawScore = (double)matchCount / Math.Max(optimalItems.Count, 1) * 100;
                if (me.Win) rawScore = Math.Min(100, rawScore + 10);
                var deaths = Math.Max(me.Deaths, 1);
                var kda = (double)(me.Kills + me.Assists) / deaths;
                if (kda >= 3) rawScore = Math.Min(100, rawScore + 5);
                if (kda < 1) rawScore = Math.Max(0, rawScore - 5);
                var score = (int)Math.Round(Math.Clamp(rawScore, 0, 100));

                playerResults.Add(new
                {
                    gameName,
                    tagLine,
                    found = true,
                    championName = myChamp?.Name ?? "Unknown",
                    championImage = myChamp is not null
                        ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{myChamp.ImageFileName}" : "",
                    score,
                    grade = score switch
                    {
                        >= 90 => "S",
                        >= 80 => "A",
                        >= 65 => "B",
                        >= 50 => "C",
                        >= 35 => "D",
                        _ => "F",
                    },
                    kills = me.Kills,
                    deaths = me.Deaths,
                    assists = me.Assists,
                    win = me.Win,
                    error = (string?)null,
                });
            }
            catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
                playerResults.Add(new { gameName, tagLine, found = false, error = "Player not found" });
            }
            catch
            {
                playerResults.Add(new { gameName, tagLine, found = false, error = "Failed to analyze" });
            }
        }

        var validScores = playerResults
            .Cast<dynamic>()
            .Where(p => p.found == true && p.error == null)
            .Select(p => (int)p.score)
            .ToList();

        return Ok(new
        {
            players = playerResults,
            teamAverage = validScores.Count > 0 ? (int)Math.Round(validScores.Average()) : 0,
            teamGrade = validScores.Count > 0
                ? (int)Math.Round(validScores.Average()) switch
                {
                    >= 90 => "S",
                    >= 80 => "A",
                    >= 65 => "B",
                    >= 50 => "C",
                    >= 35 => "D",
                    _ => "F",
                }
                : "-",
        });
    }

    /// <summary>
    /// Season Wrapped — season summary for a player based on last 20 ranked matches.
    /// Returns stats, personality, and fun roast-style observations.
    /// </summary>
    [HttpGet("roast/wrapped")]
    public async Task<ActionResult> SeasonWrapped(
        [FromQuery] string gameName,
        [FromQuery] string tagLine,
        [FromQuery] string region)
    {
        if (string.IsNullOrWhiteSpace(gameName) || string.IsNullOrWhiteSpace(tagLine))
            return BadRequest(new { message = "gameName and tagLine are required" });

        string puuid;
        try { puuid = await _riotApi.GetPuuidByRiotIdAsync(gameName, tagLine, region); }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        { return NotFound(new { message = "Summoner not found" }); }
        catch (Exception ex) { _logger.LogWarning(ex, "Wrapped: failed to resolve Riot ID for {GameName}#{TagLine}", gameName, tagLine); return StatusCode(502, new { message = "Failed to resolve Riot ID" }); }

        string[] matchIds;
        try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, 20); }
        catch (Exception ex) { _logger.LogWarning(ex, "Wrapped: failed to fetch matches for puuid={Puuid}", puuid); return StatusCode(502, new { message = "Failed to fetch matches" }); }

        if (matchIds.Length == 0)
            return NotFound(new { message = "No recent ranked games found" });

        var champions = await _gameData.GetChampionsAsync();
        var items = await _gameData.GetCompletedItemsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        int totalGames = 0, wins = 0, losses = 0;
        int totalKills = 0, totalDeaths = 0, totalAssists = 0;
        var champCounts = new Dictionary<int, int>();
        var buildScores = new List<int>();
        int offensiveItems = 0, defensiveItems = 0, utilityItems = 0;
        int gamesNeedingAntiHeal = 0, gamesWithAntiHeal = 0;
        long totalDamage = 0;
        int totalCS = 0;

        // Anti-heal item IDs (common grievous wounds items)
        var antiHealIds = new HashSet<int> { 3165, 3075, 3033, 3011, 3076 };
        // Healing champion IDs (champions with significant healing)
        var healingChampIds = new HashSet<int> { 36, 8, 50, 266, 114, 19, 106, 154, 48, 16, 37, 267, 117 };

        foreach (var matchId in matchIds)
        {
            MatchDetails? match;
            try { match = await _riotApi.GetMatchDetailsAsync(matchId, region); }
            catch (Exception ex) { _logger.LogDebug(ex, "Wrapped: failed to fetch match {MatchId}", matchId); continue; }
            if (match is null) continue;

            var me = match.Participants.FirstOrDefault(p => p.Puuid == puuid);
            if (me is null) continue;

            totalGames++;
            if (me.Win) wins++;
            else losses++;

            totalKills += me.Kills;
            totalDeaths += me.Deaths;
            totalAssists += me.Assists;
            totalDamage += me.TotalDamageDealtToChampions;
            totalCS += me.TotalMinionsKilled + me.NeutralMinionsKilled;

            champCounts.TryGetValue(me.ChampionId, out var count);
            champCounts[me.ChampionId] = count + 1;

            // Categorize items
            foreach (var itemId in me.Items.Where(id => id != 0))
            {
                if (items.TryGetValue(itemId, out var itemInfo))
                {
                    var tags = itemInfo.Tags;
                    if (tags.Contains("Damage")) offensiveItems++;
                    else if (tags.Contains("Defense") || tags.Contains("Health") || tags.Contains("Armor") || tags.Contains("SpellBlock")) defensiveItems++;
                    else utilityItems++;
                }
            }

            // Check anti-heal needs
            var enemyHealers = match.Participants
                .Where(p => p.TeamId != me.TeamId)
                .Any(p => healingChampIds.Contains(p.ChampionId));
            if (enemyHealers)
            {
                gamesNeedingAntiHeal++;
                if (me.Items.Any(id => antiHealIds.Contains(id)))
                    gamesWithAntiHeal++;
            }

            // Build scoring
            var enemyIds = match.Participants.Where(p => p.TeamId != me.TeamId).Select(p => p.ChampionId).ToArray();
            var allyIds = match.Participants.Where(p => p.TeamId == me.TeamId && p.Puuid != puuid).Select(p => p.ChampionId).ToArray();

            try
            {
                var recommendation = await _recommender.RecommendBuildAsync(
                    me.ChampionId, enemyIds, allyIds,
                    string.IsNullOrEmpty(me.TeamPosition) ? null : me.TeamPosition);

                var actualItemIds = me.Items.Where(id => id != 0).ToHashSet();
                var optimalItems = recommendation.Variants.FirstOrDefault()?.Items ?? [];
                var optimalItemIds = optimalItems.Select(i => i.Item.Id).ToHashSet();
                int m2 = actualItemIds.Count(id => optimalItemIds.Contains(id));
                double rawScore = (double)m2 / Math.Max(optimalItems.Count, 1) * 100;
                if (me.Win) rawScore = Math.Min(100, rawScore + 10);
                var d2 = Math.Max(me.Deaths, 1);
                var kda2 = (double)(me.Kills + me.Assists) / d2;
                if (kda2 >= 3) rawScore = Math.Min(100, rawScore + 5);
                if (kda2 < 1) rawScore = Math.Max(0, rawScore - 5);
                buildScores.Add((int)Math.Round(Math.Clamp(rawScore, 0, 100)));
            }
            catch (Exception ex) { _logger.LogDebug(ex, "Wrapped: failed to score build for match {MatchId}", matchId); }
        }

        if (totalGames == 0)
            return NotFound(new { message = "No valid match data found" });

        var topChampId = champCounts.OrderByDescending(kv => kv.Value).First().Key;
        champions.TryGetValue(topChampId, out var topChamp);

        var avgDeaths = Math.Max(totalDeaths, 1);
        var avgKda = (double)(totalKills + totalAssists) / avgDeaths;

        var totalItemCount = offensiveItems + defensiveItems + utilityItems;
        string buildPersonality;
        if (totalItemCount == 0) buildPersonality = "balanced";
        else if ((double)offensiveItems / totalItemCount > 0.6) buildPersonality = "aggressive";
        else if ((double)defensiveItems / totalItemCount > 0.4) buildPersonality = "defensive";
        else buildPersonality = "balanced";

        var avgBuildScore = buildScores.Count > 0 ? (int)Math.Round(buildScores.Average()) : 0;

        var funStats = new List<string>();

        if (gamesNeedingAntiHeal > 0)
        {
            var gamesWithout = gamesNeedingAntiHeal - gamesWithAntiHeal;
            if (gamesWithout > 0)
                funStats.Add($"You skipped anti-heal in {gamesWithout} of {gamesNeedingAntiHeal} games where the enemy had major healing. Ouch.");
        }
        if (avgKda >= 4)
            funStats.Add($"Your {avgKda:F1} KDA is clean. The enemy team probably reported you.");
        if (avgKda < 1.5 && totalGames >= 3)
            funStats.Add($"With a {avgKda:F1} KDA you might want to consider playing safer... or a different game.");
        if (wins > losses && totalGames >= 5)
            funStats.Add($"You won {wins} out of {totalGames} games. Keep climbing!");
        if (wins < losses && totalGames >= 5)
            funStats.Add($"Only {wins} wins out of {totalGames} games. Time to reflect on your life choices.");
        if (champCounts.Count == 1 && totalGames >= 5)
            funStats.Add($"You played nothing but {topChamp?.Name ?? "one champion"}. One-trick detected.");
        if (champCounts.Count > 10)
            funStats.Add($"You played {champCounts.Count} different champions. Jack of all trades, master of none.");
        if (totalGames > 0 && totalCS / totalGames < 120)
            funStats.Add($"Your average CS is {totalCS / totalGames}. The minions are safe from you.");

        return Ok(new
        {
            gameName,
            tagLine,
            region,
            totalGames,
            wins,
            losses,
            winRate = totalGames > 0 ? Math.Round((double)wins / totalGames * 100, 1) : 0,
            mostPlayedChampion = new
            {
                championId = topChampId,
                championName = topChamp?.Name ?? "Unknown",
                championImage = topChamp is not null
                    ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{topChamp.ImageFileName}" : "",
                gamesPlayed = champCounts[topChampId],
            },
            averageKda = Math.Round(avgKda, 2),
            totalKills,
            totalDeaths,
            totalAssists,
            averageDamage = totalGames > 0 ? totalDamage / totalGames : 0,
            averageCS = totalGames > 0 ? totalCS / totalGames : 0,
            averageBuildScore = avgBuildScore,
            buildGrade = avgBuildScore switch
            {
                >= 90 => "S",
                >= 80 => "A",
                >= 65 => "B",
                >= 50 => "C",
                >= 35 => "D",
                _ => "F",
            },
            buildPersonality,
            funStats,
            championsPlayed = champCounts.Count,
        });
    }

    private static int[] ParseIds(string commaSeparated)
        => commaSeparated.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => int.TryParse(s.Trim(), out var id) ? id : 0)
            .Where(id => id > 0)
            .ToArray();

    private static List<(string gameName, string tagLine)> ParseRiotIds(string input)
    {
        var result = new List<(string, string)>();
        var parts = input.Split(new[] { ',', '\n', '\r', ';' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            if (string.IsNullOrWhiteSpace(trimmed)) continue;
            var hashIdx = trimmed.LastIndexOf('#');
            if (hashIdx > 0 && hashIdx < trimmed.Length - 1)
            {
                var name = trimmed[..hashIdx].Trim();
                var tag = trimmed[(hashIdx + 1)..].Trim();
                if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(tag))
                    result.Add((name, tag));
            }
        }
        return result;
    }
}
