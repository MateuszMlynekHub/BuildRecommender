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

    public GameController(IRiotApiService riotApi, IGameDataService gameData)
    {
        _riotApi = riotApi;
        _gameData = gameData;
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
            // Cast to access extended method (interface only has GetSummonerIdByPuuidAsync)
            if (_riotApi is Infrastructure.RiotApi.RiotApiService riotSvc)
            {
                var (summonerId, iconId, level) = await riotSvc.GetSummonerByPuuidAsync(puuid, region);
                profileIconId = iconId;
                summonerLevel = level;
                if (summonerId is not null)
                    rankedEntries = await _riotApi.GetLeagueEntriesAsync(summonerId, region);
            }
            else
            {
                var summonerId = await _riotApi.GetSummonerIdByPuuidAsync(puuid, region);
                if (summonerId is not null)
                    rankedEntries = await _riotApi.GetLeagueEntriesAsync(summonerId, region);
            }
        }
        catch { /* rank fetch is non-critical */ }

        // Fetch recent match IDs (last 20)
        string[] matchIds;
        try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, 20); }
        catch { matchIds = []; }

        var matches = new List<object>();
        var champions = await _gameData.GetChampionsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        foreach (var matchId in matchIds.Take(10))
        {
            try
            {
                var match = await _riotApi.GetMatchDetailsAsync(matchId, region);
                if (match is null) continue;

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
                                ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champ.ImageFileName}"
                                : "",
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
            catch { /* skip failed match fetches */ }
        }

        // Compute stats from match data
        var myMatches = matches.Cast<dynamic>()
            .Select(m => ((IEnumerable<dynamic>)m.participants).FirstOrDefault(pp => pp.puuid == puuid))
            .Where(me => me is not null)
            .ToList();

        // Top 5 champions played
        var topChampions = myMatches
            .GroupBy(me => new { me.championId, me.championName, me.championImage })
            .Select(g => new {
                championId = (int)g.Key.championId,
                championName = (string)g.Key.championName,
                championImage = (string)g.Key.championImage,
                games = g.Count(),
                wins = g.Count(m => (bool)m.win),
            })
            .OrderByDescending(c => c.games)
            .Take(5)
            .ToList();

        // Games per lane
        var laneStats = myMatches
            .Where(me => !string.IsNullOrEmpty((string)me.teamPosition))
            .GroupBy(me => (string)me.teamPosition)
            .Select(g => new { lane = g.Key, games = g.Count() })
            .OrderByDescending(l => l.games)
            .ToList();

        // Recently played with — teammates across all matches
        var recentlyPlayedWith = new Dictionary<string, (string name, int games, int wins)>();
        foreach (var matchObj in matches.Cast<dynamic>())
        {
            var participants = (IEnumerable<dynamic>)matchObj.participants;
            var me = participants.FirstOrDefault(pp => (string)pp.puuid == puuid);
            if (me is null) continue;
            var myTeam = (int)me.teamId;
            var myWin = (bool)me.win;
            foreach (var teammate in participants)
            {
                if ((string)teammate.puuid == puuid) continue;
                if ((int)teammate.teamId != myTeam) continue;
                var tPuuid = (string)teammate.puuid;
                var tName = (string)teammate.championName;
                if (!recentlyPlayedWith.TryGetValue(tPuuid, out var entry))
                    entry = (tName, 0, 0);
                recentlyPlayedWith[tPuuid] = (tName, entry.games + 1, entry.wins + (myWin ? 1 : 0));
            }
        }
        var playedWith = recentlyPlayedWith
            .Where(kv => kv.Value.games >= 2)
            .OrderByDescending(kv => kv.Value.games)
            .Take(10)
            .Select(kv => new { puuid = kv.Key, lastChampion = kv.Value.name, games = kv.Value.games, wins = kv.Value.wins })
            .ToList();

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
            matchCount = matchIds.Length,
            recentMatches = matches,
        });
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
