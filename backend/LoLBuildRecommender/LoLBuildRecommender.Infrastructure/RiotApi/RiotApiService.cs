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
                Puuid = p.Puuid,
                ChampionId = p.ChampionId,
                TeamPosition = p.TeamPosition,
                TeamId = p.TeamId,
                Kills = p.Kills,
                Deaths = p.Deaths,
                Assists = p.Assists,
                TotalMinionsKilled = p.TotalMinionsKilled,
                NeutralMinionsKilled = p.NeutralMinionsKilled,
                WardsPlaced = p.WardsPlaced,
                TotalDamageDealtToChampions = p.TotalDamageDealtToChampions,
                GoldEarned = p.GoldEarned,
                ChampLevel = p.ChampLevel,
                Items = new[] { p.Item0, p.Item1, p.Item2, p.Item3, p.Item4, p.Item5 },
                Summoner1Id = p.Summoner1Id,
                Summoner2Id = p.Summoner2Id,
                PrimaryStyle = p.Perks?.Styles?.ElementAtOrDefault(0)?.Style ?? 0,
                SubStyle = p.Perks?.Styles?.ElementAtOrDefault(1)?.Style ?? 0,
                Perks = ExtractPerks(p.Perks),
                StatOffense = p.Perks?.StatPerks?.Offense ?? 0,
                StatFlex = p.Perks?.StatPerks?.Flex ?? 0,
                StatDefense = p.Perks?.StatPerks?.Defense ?? 0,
                Win = p.Win,
            }).ToList(),
            BannedChampionIds = dto.Info.Teams
                .SelectMany(t => t.Bans)
                .Where(b => b.ChampionId > 0)
                .Select(b => b.ChampionId)
                .Distinct()
                .ToList(),
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

    public async Task<string?> GetSummonerIdByPuuidAsync(string puuid, string platform, CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("RiotApi");
        var url = $"https://{platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}";
        var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;
        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(cancellationToken: ct);
        return json.TryGetProperty("id", out var id) ? id.GetString() : null;
    }

    public async Task<List<RankedEntry>> GetLeagueEntriesAsync(string summonerId, string platform, CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("RiotApi");
        var url = $"https://{platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/{summonerId}";
        var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return [];
        var dtos = await response.Content.ReadFromJsonAsync<List<LeagueEntryFullDto>>(cancellationToken: ct);
        if (dtos is null) return [];
        return dtos.Select(d => new RankedEntry
        {
            QueueType = d.QueueType,
            Tier = d.Tier,
            Rank = d.Rank,
            LeaguePoints = d.LeaguePoints,
            Wins = d.Wins,
            Losses = d.Losses,
        }).ToList();
    }

    public async Task<MatchTimelineExtract?> GetMatchTimelineExtractAsync(
        string matchId, string platform, CancellationToken ct = default)
    {
        var regionalRoute = RegionMapping.GetRegionalRoute(platform);
        var client = _httpClientFactory.CreateClient("RiotApi");
        var url = $"https://{regionalRoute}.api.riotgames.com/lol/match/v5/matches/{matchId}/timeline";

        var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(cancellationToken: ct);

        var skillLevelUps = new Dictionary<int, List<int>>();
        var itemPurchases = new Dictionary<int, List<(int timestamp, int itemId)>>();
        var skillCountPerParticipant = new Dictionary<int, int>();

        if (json.TryGetProperty("info", out var info) &&
            info.TryGetProperty("frames", out var frames))
        {
            foreach (var frame in frames.EnumerateArray())
            {
                if (!frame.TryGetProperty("events", out var events)) continue;

                foreach (var evt in events.EnumerateArray())
                {
                    if (!evt.TryGetProperty("type", out var typeProp)) continue;
                    var type = typeProp.GetString();

                    if (type == "SKILL_LEVEL_UP" &&
                        evt.TryGetProperty("participantId", out var skillPid) &&
                        evt.TryGetProperty("skillSlot", out var slot))
                    {
                        var pid = skillPid.GetInt32();
                        skillCountPerParticipant.TryGetValue(pid, out var count);
                        if (count < 3)
                        {
                            if (!skillLevelUps.ContainsKey(pid))
                                skillLevelUps[pid] = new List<int>();
                            skillLevelUps[pid].Add(slot.GetInt32());
                            skillCountPerParticipant[pid] = count + 1;
                        }
                    }
                    else if (type == "ITEM_PURCHASED" &&
                             evt.TryGetProperty("participantId", out var itemPid) &&
                             evt.TryGetProperty("itemId", out var itemId) &&
                             evt.TryGetProperty("timestamp", out var timestamp))
                    {
                        var pid = itemPid.GetInt32();
                        if (!itemPurchases.ContainsKey(pid))
                            itemPurchases[pid] = new List<(int, int)>();
                        itemPurchases[pid].Add((timestamp.GetInt32(), itemId.GetInt32()));
                    }
                }
            }
        }

        return new MatchTimelineExtract
        {
            SkillLevelUps = skillLevelUps,
            ItemPurchases = itemPurchases,
        };
    }

    /// <summary>
    /// Flatten the nested Riot perks structure into a flat 6-element array:
    /// [primary keystone, primary row1, primary row2, primary row3, secondary slot1, secondary slot2].
    /// </summary>
    private static int[] ExtractPerks(MatchPerksDto? perks)
    {
        if (perks?.Styles is null || perks.Styles.Count < 2) return [];
        return perks.Styles
            .SelectMany(s => s.Selections)
            .Select(sel => sel.Perk)
            .ToArray();
    }
}
