using System.Net;
using System.Net.Http.Json;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Infrastructure.RiotApi.Dtos;

namespace LoLBuildRecommender.Infrastructure.RiotApi;

public class RiotApiService : IRiotApiService
{
    private readonly IHttpClientFactory _httpClientFactory;

    public RiotApiService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<string> GetPuuidByRiotIdAsync(string gameName, string tagLine, string platform)
    {
        var regionalRoute = RegionMapping.GetRegionalRoute(platform);
        var client = _httpClientFactory.CreateClient("RiotApi");

        var url = $"https://{regionalRoute}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{Uri.EscapeDataString(gameName)}/{Uri.EscapeDataString(tagLine)}";

        var response = await client.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var account = await response.Content.ReadFromJsonAsync<RiotAccountDto>();
        return account?.Puuid ?? throw new InvalidOperationException("Could not resolve Riot ID");
    }

    public Task<string[]> GetChallengerPuuidsAsync(string platform, CancellationToken ct = default)
        => GetLeaguePuuidsAsync(platform, "challengerleagues", ct);

    public Task<string[]> GetGrandmasterPuuidsAsync(string platform, CancellationToken ct = default)
        => GetLeaguePuuidsAsync(platform, "grandmasterleagues", ct);

    public Task<string[]> GetMasterPuuidsAsync(string platform, CancellationToken ct = default)
        => GetLeaguePuuidsAsync(platform, "masterleagues", ct);

    private async Task<string[]> GetLeaguePuuidsAsync(string platform, string leagueSegment, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("RiotApi");
        var url = $"https://{platform}.api.riotgames.com/lol/league/v4/{leagueSegment}/by-queue/RANKED_SOLO_5x5";

        var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return Array.Empty<string>();

        var league = await response.Content.ReadFromJsonAsync<LeagueListDto>(cancellationToken: ct);
        return league?.Entries
            .Select(e => e.Puuid)
            .Where(p => !string.IsNullOrEmpty(p))
            .ToArray() ?? Array.Empty<string>();
    }

    public async Task<string[]> GetRankedMatchIdsAsync(
        string puuid,
        string platform,
        int count,
        DateTimeOffset? startTime = null,
        CancellationToken ct = default)
    {
        var regionalRoute = RegionMapping.GetRegionalRoute(platform);
        var client = _httpClientFactory.CreateClient("RiotApi");

        // Riot caps `count` at 100 per request.
        var clampedCount = Math.Clamp(count, 1, 100);
        var url = $"https://{regionalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count={clampedCount}&queue=420";
        if (startTime.HasValue)
        {
            url += $"&startTime={startTime.Value.ToUnixTimeSeconds()}";
        }

        var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return Array.Empty<string>();

        var ids = await response.Content.ReadFromJsonAsync<string[]>(cancellationToken: ct);
        return ids ?? Array.Empty<string>();
    }

    public async Task<MatchDetails?> GetMatchDetailsAsync(string matchId, string platform, CancellationToken ct = default)
    {
        var regionalRoute = RegionMapping.GetRegionalRoute(platform);
        var client = _httpClientFactory.CreateClient("RiotApi");
        var url = $"https://{regionalRoute}.api.riotgames.com/lol/match/v5/matches/{matchId}";

        var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;

        var dto = await response.Content.ReadFromJsonAsync<MatchDto>(cancellationToken: ct);
        if (dto?.Info is null) return null;

        return new MatchDetails
        {
            GameId = dto.Info.GameId,
            GameVersion = dto.Info.GameVersion,
            QueueId = dto.Info.QueueId,
            Participants = dto.Info.Participants.Select(p => new MatchParticipant
            {
                ChampionId = p.ChampionId,
                TeamPosition = p.TeamPosition,
                Items = new[] { p.Item0, p.Item1, p.Item2, p.Item3, p.Item4, p.Item5 },
                Win = p.Win,
            }).ToList(),
        };
    }

    public async Task<ActiveGameInfo?> GetActiveGameAsync(string puuid, string platform)
    {
        var client = _httpClientFactory.CreateClient("RiotApi");

        var url = $"https://{platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/{puuid}";

        var response = await client.GetAsync(url);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        response.EnsureSuccessStatusCode();

        var dto = await response.Content.ReadFromJsonAsync<SpectatorGameDto>();
        if (dto is null) return null;

        return new ActiveGameInfo
        {
            GameId = dto.GameId,
            GameMode = dto.GameMode,
            GameLength = dto.GameLength,
            SearchedPuuid = puuid,
            Participants = dto.Participants.Select(p => new GameParticipant
            {
                // Spectator-v5 occasionally returns null puuid/riotId for bot accounts or
                // newly-migrated regions — fall back to an empty string so downstream code
                // using Puuid as a dictionary key doesn't explode.
                Puuid = p.Puuid ?? string.Empty,
                RiotId = p.RiotId ?? string.Empty,
                ChampionId = p.ChampionId,
                TeamId = p.TeamId,
                Spell1Id = p.Spell1Id,
                Spell2Id = p.Spell2Id,
                Perks = p.Perks is not null
                    ? new ParticipantPerks
                    {
                        PerkIds = p.Perks.PerkIds,
                        PerkStyle = p.Perks.PerkStyle,
                        PerkSubStyle = p.Perks.PerkSubStyle,
                    }
                    : new ParticipantPerks(),
            }).ToList(),
            BannedChampions = dto.BannedChampions.Select(b => new BannedChampion
            {
                ChampionId = b.ChampionId,
                TeamId = b.TeamId,
                PickTurn = b.PickTurn,
            }).ToList(),
        };
    }
}
