using System.Net;
using LoLBuildRecommender.Api.Dtos;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Core.Services;
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

        // Fetch league entries for rank info
        object? rankInfo = null;
        try
        {
            var client = _riotApi as RiotApiService;
            // Use the summoner PUUID to get league entries
            // Riot League-v4 requires summonerId, not PUUID. We'll fetch via summoner endpoint.
        }
        catch { /* rank fetch is non-critical */ }

        // Fetch recent match IDs (last 10)
        string[] matchIds;
        try { matchIds = await _riotApi.GetRankedMatchIdsAsync(puuid, region, 10); }
        catch { matchIds = []; }

        var matches = new List<object>();
        var champions = await _gameData.GetChampionsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        foreach (var matchId in matchIds.Take(8))
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
                            win = p.Win,
                            items = p.Items.Where(id => id != 0).ToArray(),
                        };
                    }).ToList(),
                });
            }
            catch { /* skip failed match fetches */ }
        }

        return Ok(new
        {
            puuid,
            gameName,
            tagLine,
            region,
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
