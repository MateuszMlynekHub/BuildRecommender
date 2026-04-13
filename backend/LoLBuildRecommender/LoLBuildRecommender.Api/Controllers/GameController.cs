using System.Net;
using LoLBuildRecommender.Api.Dtos;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Core.Services;
using LoLBuildRecommender.Infrastructure.RiotApi;
using Microsoft.AspNetCore.Mvc;

namespace LoLBuildRecommender.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameController : ControllerBase
{
    private readonly IRiotApiService _riotApi;
    private readonly IGameDataService _gameData;
    private readonly ILogger<GameController> _logger;

    public GameController(IRiotApiService riotApi, IGameDataService gameData, ILogger<GameController> logger)
    {
        _riotApi = riotApi;
        _gameData = gameData;
        _logger = logger;
    }

    [HttpGet("active")]
    public async Task<ActionResult<ActiveGameResponse>> GetActiveGame(
        [FromQuery] string gameName,
        [FromQuery] string tagLine,
        [FromQuery] string region)
    {
        if (string.IsNullOrWhiteSpace(gameName) || string.IsNullOrWhiteSpace(tagLine))
            return BadRequest("gameName and tagLine are required");

        // Surface Riot API failures as meaningful HTTP codes instead of bare 500s.
        // The live endpoint previously returned 500 on anything other than a 404 —
        // now expired keys, rate limits and upstream timeouts get distinct responses.
        string puuid;
        try
        {
            puuid = await _riotApi.GetPuuidByRiotIdAsync(gameName, tagLine, region);
        }
        catch (HttpRequestException ex)
        {
            return MapRiotError(ex, "resolve Riot ID");
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, "Riot API timed out resolving Riot ID");
        }

        ActiveGameInfo? game;
        try
        {
            game = await _riotApi.GetActiveGameAsync(puuid, region);
        }
        catch (HttpRequestException ex)
        {
            return MapRiotError(ex, "fetch active game");
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, "Riot API timed out fetching active game");
        }

        if (game is null)
            return NotFound("Player is not currently in a game");

        var champions = await _gameData.GetChampionsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        var teams = game.Participants
            .GroupBy(p => p.TeamId)
            .Select(g =>
            {
                var teamParticipants = g.ToList();
                var lanes = LaneAssigner.AssignLanes(teamParticipants, champions);

                return new TeamResponse
                {
                    TeamId = g.Key,
                    Participants = teamParticipants.Select((p, idx) =>
                    {
                        champions.TryGetValue(p.ChampionId, out var champ);
                        return new ParticipantResponse
                        {
                            Puuid = p.Puuid,
                            RiotId = p.RiotId,
                            ChampionId = p.ChampionId,
                            ChampionName = champ?.Name ?? "Unknown",
                            ChampionImageUrl = champ is not null
                                ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}"
                                : "",
                            ChampionTags = champ?.Tags ?? [],
                            TeamId = p.TeamId,
                            Spell1Id = p.Spell1Id,
                            Spell2Id = p.Spell2Id,
                            Perks = new PerksResponse
                            {
                                PerkIds = p.Perks.PerkIds,
                                PerkStyle = p.Perks.PerkStyle,
                                PerkSubStyle = p.Perks.PerkSubStyle,
                            },
                            Lane = lanes[idx],
                        };
                    }).ToList(),
                };
            }).ToList();

        return Ok(new ActiveGameResponse
        {
            GameId = game.GameId,
            GameMode = game.GameMode,
            GameLengthSeconds = game.GameLength,
            SearchedPuuid = puuid,
            Teams = teams,
            Bans = game.BannedChampions.Select(b =>
            {
                champions.TryGetValue(b.ChampionId, out var champ);
                return new BannedChampionResponse
                {
                    ChampionId = b.ChampionId,
                    TeamId = b.TeamId,
                    ChampionName = champ?.Name ?? string.Empty,
                    ChampionImageUrl = champ is not null
                        ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}"
                        : "",
                };
            }).ToList(),
        });
    }

    [HttpGet("summoner")]
    public async Task<ActionResult> GetSummonerProfile(
        [FromQuery] string gameName,
        [FromQuery] string tagLine,
        [FromQuery] string region)
    {
        if (string.IsNullOrWhiteSpace(gameName) || string.IsNullOrWhiteSpace(tagLine))
            return BadRequest("gameName and tagLine are required");

        string puuid;
        try { puuid = await _riotApi.GetPuuidByRiotIdAsync(gameName, tagLine, region); }
        catch (HttpRequestException ex) { return MapRiotError(ex, "resolve Riot ID"); }

        // Fetch summoner profile (icon, level) + rank data
        int profileIconId = 0;
        long summonerLevel = 0;
        List<RankedEntry> rankedEntries = [];
        try
        {
            if (_riotApi is Infrastructure.RiotApi.RiotApiService riotSvc)
            {
                var (summonerId, iconId, level) = await riotSvc.GetSummonerByPuuidAsync(puuid, region);
                profileIconId = iconId;
                summonerLevel = level;
                rankedEntries = await _riotApi.GetLeagueEntriesAsync(summonerId ?? puuid, region);
            }
            else
            {
                var summonerId = await _riotApi.GetSummonerIdByPuuidAsync(puuid, region);
                if (summonerId is not null)
                    rankedEntries = await _riotApi.GetLeagueEntriesAsync(summonerId, region);
            }
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Rank fetch failed for puuid={Puuid}", puuid); }

        // Fetch recent match IDs (last 20)
        string[] matchIds;
        try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, 20); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to fetch match IDs for puuid={Puuid}", puuid); matchIds = []; }

        var champions = await _gameData.GetChampionsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        // Fetch champion mastery (top 5 for profile)
        List<ChampionMastery> masteries = [];
        try { masteries = await _riotApi.GetChampionMasteriesAsync(puuid, region, 5); }
        catch (Exception ex) { _logger.LogDebug(ex, "Failed to fetch masteries for puuid={Puuid}", puuid); }

        // Collect raw match data for stats computation BEFORE serialization
        var rawMatchData = new List<(string matchId, string gameVersion, List<MatchParticipant> participants)>();

        foreach (var matchId in matchIds.Take(20))
        {
            try
            {
                var match = await _riotApi.GetMatchDetailsAsync(matchId, region);
                if (match is not null)
                    rawMatchData.Add((matchId, match.GameVersion, match.Participants));
            }
            catch (Exception ex) { _logger.LogDebug(ex, "Failed to fetch match details for {MatchId}", matchId); }
        }

        // Compute stats from strongly-typed data
        var myParticipants = rawMatchData
            .Select(m => m.participants.FirstOrDefault(p => p.Puuid == puuid))
            .Where(p => p is not null)
            .Cast<MatchParticipant>()
            .ToList();

        var topChampions = myParticipants
            .GroupBy(p => p.ChampionId)
            .Select(g =>
            {
                champions.TryGetValue(g.Key, out var champ);
                return new
                {
                    championId = g.Key,
                    championName = champ?.Name ?? "Unknown",
                    championImage = champ is not null
                        ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}" : "",
                    games = g.Count(),
                    wins = g.Count(p => p.Win),
                };
            })
            .OrderByDescending(c => c.games)
            .Take(5)
            .ToList();

        var laneStats = myParticipants
            .Where(p => !string.IsNullOrEmpty(p.TeamPosition))
            .GroupBy(p => p.TeamPosition)
            .Select(g => new { lane = g.Key, games = g.Count() })
            .OrderByDescending(l => l.games)
            .ToList();

        // Recently played with — aggregate by player PUUID
        var playedWithDict = new Dictionary<string, (int games, int wins)>();
        foreach (var (_, _, participants) in rawMatchData)
        {
            var me = participants.FirstOrDefault(p => p.Puuid == puuid);
            if (me is null) continue;
            foreach (var teammate in participants)
            {
                if (teammate.Puuid == puuid || teammate.TeamId != me.TeamId) continue;
                if (string.IsNullOrEmpty(teammate.Puuid)) continue;
                if (!playedWithDict.TryGetValue(teammate.Puuid, out var entry))
                    entry = (0, 0);
                playedWithDict[teammate.Puuid] = (entry.games + 1, entry.wins + (me.Win ? 1 : 0));
            }
        }
        var topPlayedWith = playedWithDict
            .Where(kv => kv.Value.games >= 2)
            .OrderByDescending(kv => kv.Value.games)
            .Take(10)
            .ToList();

        // Resolve player names and icons for recently played with
        var playedWith = new List<object>();
        if (_riotApi is Infrastructure.RiotApi.RiotApiService riotSvc2)
        {
            foreach (var kv in topPlayedWith)
            {
                string playerName = "Unknown";
                string playerTag = "";
                int playerIconId = 0;
                try
                {
                    var account = await riotSvc2.GetAccountByPuuidAsync(kv.Key, region);
                    if (account is not null)
                    {
                        playerName = account.Value.gameName;
                        playerTag = account.Value.tagLine;
                    }
                    var (_, iconId, _) = await riotSvc2.GetSummonerByPuuidAsync(kv.Key, region);
                    playerIconId = iconId;
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Failed to resolve account for puuid={Puuid}", kv.Key); }
                playedWith.Add(new
                {
                    puuid = kv.Key,
                    gameName = playerName,
                    tagLine = playerTag,
                    profileIconUrl = playerIconId > 0
                        ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{playerIconId}.png"
                        : "",
                    games = kv.Value.games,
                    wins = kv.Value.wins,
                });
            }
        }

        // Serialize matches for response
        var matches = rawMatchData.Select(m => new
        {
            matchId = m.matchId,
            gameVersion = m.gameVersion,
            participants = m.participants.Select(p =>
            {
                champions.TryGetValue(p.ChampionId, out var champ);
                return new
                {
                    puuid = p.Puuid,
                    championId = p.ChampionId,
                    championName = champ?.Name ?? "Unknown",
                    championImage = champ is not null
                        ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}" : "",
                    teamPosition = p.TeamPosition,
                    teamId = p.TeamId,
                    kills = p.Kills,
                    deaths = p.Deaths,
                    assists = p.Assists,
                    cs = p.TotalMinionsKilled + p.NeutralMinionsKilled,
                    wardsPlaced = p.WardsPlaced,
                    damage = p.TotalDamageDealtToChampions,
                    gold = p.GoldEarned,
                    level = p.ChampLevel,
                    win = p.Win,
                    items = p.Items.Where(id => id != 0).ToArray(),
                };
            }).ToList(),
        }).ToList();

        return Ok(new
        {
            puuid,
            gameName,
            tagLine,
            region,
            profileIconUrl = profileIconId > 0
                ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{profileIconId}.png"
                : "",
            summonerLevel,
            rankedEntries,
            topChampions,
            laneStats,
            recentlyPlayedWith = playedWith,
            championMasteries = masteries.Select(m =>
            {
                champions.TryGetValue(m.ChampionId, out var champ);
                return new
                {
                    championId = m.ChampionId,
                    championName = champ?.Name ?? "Unknown",
                    championImage = champ is not null
                        ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}" : "",
                    championLevel = m.ChampionLevel,
                    championPoints = m.ChampionPoints,
                };
            }).ToList(),
            matchCount = matchIds.Length,
            recentMatches = matches,
        });
    }

    [HttpGet("matches")]
    public async Task<ActionResult> GetMoreMatches(
        [FromQuery] string gameName,
        [FromQuery] string tagLine,
        [FromQuery] string region,
        [FromQuery] int start = 20,
        [FromQuery] int count = 20)
    {
        if (string.IsNullOrWhiteSpace(gameName) || string.IsNullOrWhiteSpace(tagLine))
            return BadRequest("gameName and tagLine are required");

        count = Math.Clamp(count, 1, 100);
        start = Math.Max(start, 0);

        string puuid;
        try { puuid = await _riotApi.GetPuuidByRiotIdAsync(gameName, tagLine, region); }
        catch (HttpRequestException ex) { return MapRiotError(ex, "resolve Riot ID"); }

        string[] matchIds;
        try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, count, start: start); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to fetch match IDs for puuid={Puuid}, start={Start}", puuid, start); matchIds = []; }

        var champions = await _gameData.GetChampionsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        var matches = new List<object>();
        foreach (var matchId in matchIds)
        {
            try
            {
                var match = await _riotApi.GetMatchDetailsAsync(matchId, region);
                if (match is not null)
                {
                    matches.Add(new
                    {
                        matchId,
                        gameVersion = match.GameVersion,
                        participants = match.Participants.Select(p =>
                        {
                            champions.TryGetValue(p.ChampionId, out var champ);
                            return new
                            {
                                puuid = p.Puuid,
                                championId = p.ChampionId,
                                championName = champ?.Name ?? "Unknown",
                                championImage = champ is not null
                                    ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}" : "",
                                teamPosition = p.TeamPosition,
                                teamId = p.TeamId,
                                kills = p.Kills,
                                deaths = p.Deaths,
                                assists = p.Assists,
                                cs = p.TotalMinionsKilled + p.NeutralMinionsKilled,
                                wardsPlaced = p.WardsPlaced,
                                damage = p.TotalDamageDealtToChampions,
                                gold = p.GoldEarned,
                                level = p.ChampLevel,
                                win = p.Win,
                                items = p.Items.Where(id => id != 0).ToArray(),
                            };
                        }).ToList(),
                    });
                }
            }
            catch (Exception ex) { _logger.LogDebug(ex, "Failed to fetch match details for {MatchId}", matchId); }
        }

        return Ok(new { matches, hasMore = matchIds.Length == count });
    }

    /// <summary>
    /// Multi-search: look up multiple summoners in parallel. Accepts comma-separated
    /// Riot IDs (name#tag) or a pasted lobby chat. Returns basic profile data for each.
    /// </summary>
    [HttpGet("multisearch")]
    public async Task<ActionResult> MultiSearch(
        [FromQuery] string players,
        [FromQuery] string region)
    {
        if (string.IsNullOrWhiteSpace(players))
            return BadRequest("players parameter is required (comma-separated Riot IDs)");

        // Parse input: support "name#tag" comma separated, or lobby chat format "joined lobby\nname1\nname2"
        var riotIds = ParseRiotIds(players);
        if (riotIds.Count == 0)
            return BadRequest("No valid Riot IDs found");

        var champions = await _gameData.GetChampionsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        // Look up all players in parallel (max 10)
        var tasks = riotIds.Take(10).Select(async rid =>
        {
            try
            {
                var puuid = await _riotApi.GetPuuidByRiotIdAsync(rid.gameName, rid.tagLine, region);

                // Fetch rank
                List<RankedEntry> ranked = [];
                try
                {
                    if (_riotApi is Infrastructure.RiotApi.RiotApiService riotSvc)
                    {
                        var (summonerId, iconId, level) = await riotSvc.GetSummonerByPuuidAsync(puuid, region);
                        ranked = await _riotApi.GetLeagueEntriesAsync(summonerId ?? puuid, region);

                        // Fetch recent matches (last 10 for quick stats)
                        string[] matchIds;
                        try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, 10); }
                        catch (Exception ex) { _logger.LogDebug(ex, "Multisearch: failed to fetch matches for puuid={Puuid}", puuid); matchIds = []; }

                        var recentStats = new List<object>();
                        int totalWins = 0, totalGames = 0;
                        var champCounts = new Dictionary<int, (int games, int wins)>();

                        foreach (var matchId in matchIds.Take(10))
                        {
                            try
                            {
                                var match = await _riotApi.GetMatchDetailsAsync(matchId, region);
                                var me = match?.Participants.FirstOrDefault(p => p.Puuid == puuid);
                                if (me is not null)
                                {
                                    totalGames++;
                                    if (me.Win) totalWins++;
                                    if (!champCounts.TryGetValue(me.ChampionId, out var cc))
                                        cc = (0, 0);
                                    champCounts[me.ChampionId] = (cc.games + 1, cc.wins + (me.Win ? 1 : 0));
                                }
                            }
                            catch (Exception ex) { _logger.LogDebug(ex, "Multisearch: failed to process match for puuid={Puuid}", puuid); }
                        }

                        var topChamps = champCounts
                            .OrderByDescending(kv => kv.Value.games)
                            .Take(3)
                            .Select(kv =>
                            {
                                champions.TryGetValue(kv.Key, out var champ);
                                return new
                                {
                                    championId = kv.Key,
                                    championName = champ?.Name ?? "Unknown",
                                    championImage = champ is not null
                                        ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}" : "",
                                    games = kv.Value.games,
                                    wins = kv.Value.wins,
                                };
                            }).ToList();

                        return (object)new
                        {
                            gameName = rid.gameName,
                            tagLine = rid.tagLine,
                            found = true,
                            profileIconUrl = iconId > 0
                                ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{iconId}.png" : "",
                            summonerLevel = level,
                            rankedEntries = ranked,
                            recentGames = totalGames,
                            recentWins = totalWins,
                            recentWinRate = totalGames > 0 ? (double)totalWins / totalGames : 0,
                            topChampions = topChamps,
                        };
                    }
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Multisearch: failed to fetch rank/stats for {GameName}#{TagLine}", rid.gameName, rid.tagLine); }

                return (object)new
                {
                    gameName = rid.gameName,
                    tagLine = rid.tagLine,
                    found = true,
                    profileIconUrl = "",
                    summonerLevel = 0L,
                    rankedEntries = ranked,
                    recentGames = 0,
                    recentWins = 0,
                    recentWinRate = 0.0,
                    topChampions = Array.Empty<object>(),
                };
            }
            catch
            {
                return (object)new
                {
                    gameName = rid.gameName,
                    tagLine = rid.tagLine,
                    found = false,
                    error = "Player not found",
                };
            }
        });

        var results = await Task.WhenAll(tasks);
        return Ok(new { players = results });
    }

    private static List<(string gameName, string tagLine)> ParseRiotIds(string input)
    {
        var result = new List<(string, string)>();

        // Split by comma, newline, or semicolon
        var parts = input.Split(new[] { ',', '\n', '\r', ';' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            // Skip common lobby chat noise
            if (string.IsNullOrWhiteSpace(trimmed)) continue;
            if (trimmed.StartsWith("joined", StringComparison.OrdinalIgnoreCase)) continue;

            // Parse "name#tag" format
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

    [HttpGet("mastery")]
    public async Task<ActionResult> GetChampionMasteries(
        [FromQuery] string gameName,
        [FromQuery] string tagLine,
        [FromQuery] string region)
    {
        if (string.IsNullOrWhiteSpace(gameName) || string.IsNullOrWhiteSpace(tagLine))
            return BadRequest("gameName and tagLine are required");

        string puuid;
        try { puuid = await _riotApi.GetPuuidByRiotIdAsync(gameName, tagLine, region); }
        catch (HttpRequestException ex) { return MapRiotError(ex, "resolve Riot ID"); }

        var masteries = await _riotApi.GetChampionMasteriesAsync(puuid, region);
        var champions = await _gameData.GetChampionsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        return Ok(masteries.Select(m =>
        {
            champions.TryGetValue(m.ChampionId, out var champ);
            return new
            {
                championId = m.ChampionId,
                championName = champ?.Name ?? "Unknown",
                championImage = champ is not null
                    ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}" : "",
                championLevel = m.ChampionLevel,
                championPoints = m.ChampionPoints,
            };
        }).ToList());
    }

    /// <summary>
    /// Leaderboard: top players from Challenger/Grandmaster/Master tiers.
    /// </summary>
    [HttpGet("leaderboard")]
    public async Task<ActionResult> GetLeaderboard(
        [FromQuery] string region = "euw1",
        [FromQuery] string tier = "challenger")
    {
        try
        {
            string[] puuids = tier.ToLowerInvariant() switch
            {
                "grandmaster" => await _riotApi.GetGrandmasterPuuidsAsync(region),
                "master" => await _riotApi.GetMasterPuuidsAsync(region),
                _ => await _riotApi.GetChallengerPuuidsAsync(region),
            };

            // The crawler methods return PUUIDs. We need to get league data.
            // For leaderboard, we fetch league entries for the first N players.
            var version = await _gameData.GetCurrentVersionAsync();
            var entries = new List<object>();

            // Limit to 50 players to avoid too many API calls
            foreach (var puuid in puuids.Take(50))
            {
                try
                {
                    string? summonerId = null;
                    int iconId = 0;
                    long level = 0;

                    if (_riotApi is Infrastructure.RiotApi.RiotApiService riotSvc)
                    {
                        var (sid, icon, lvl) = await riotSvc.GetSummonerByPuuidAsync(puuid, region);
                        summonerId = sid;
                        iconId = icon;
                        level = lvl;
                    }
                    else
                    {
                        summonerId = await _riotApi.GetSummonerIdByPuuidAsync(puuid, region);
                    }

                    var ranked = summonerId is not null
                        ? await _riotApi.GetLeagueEntriesAsync(summonerId, region)
                        : new List<RankedEntry>();

                    var soloQ = ranked.FirstOrDefault(r =>
                        r.QueueType == "RANKED_SOLO_5x5");

                    if (soloQ is null) continue;

                    string gameName = "", tagLine = "";
                    if (_riotApi is Infrastructure.RiotApi.RiotApiService riotSvc2)
                    {
                        var account = await riotSvc2.GetAccountByPuuidAsync(puuid, region);
                        if (account is not null)
                        {
                            gameName = account.Value.gameName;
                            tagLine = account.Value.tagLine;
                        }
                    }

                    entries.Add(new
                    {
                        summonerId = summonerId ?? puuid,
                        puuid,
                        gameName,
                        tagLine,
                        tier = soloQ.Tier,
                        rank = soloQ.Rank,
                        leaguePoints = soloQ.LeaguePoints,
                        wins = soloQ.Wins,
                        losses = soloQ.Losses,
                        profileIconUrl = iconId > 0
                            ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{iconId}.png" : "",
                    });
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Leaderboard: failed to fetch data for puuid={Puuid}", puuid); }
            }

            // Sort by LP descending
            var sorted = entries
                .Cast<dynamic>()
                .OrderByDescending(e => (int)e.leaguePoints)
                .ToList();

            return Ok(new { entries = sorted });
        }
        catch (HttpRequestException ex)
        {
            return MapRiotError(ex, "fetch leaderboard");
        }
    }

    private ActionResult MapRiotError(HttpRequestException ex, string operation)
    {
        return ex.StatusCode switch
        {
            HttpStatusCode.NotFound => NotFound("Summoner not found"),
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                StatusCode(503, "Riot API key invalid or expired — regenerate a dev key at developer.riotgames.com"),
            HttpStatusCode.TooManyRequests =>
                StatusCode(503, "Riot API rate limit exceeded — try again in a minute"),
            _ => StatusCode(502, $"Riot API error while trying to {operation}: {(int?)ex.StatusCode} {ex.StatusCode}"),
        };
    }
}
