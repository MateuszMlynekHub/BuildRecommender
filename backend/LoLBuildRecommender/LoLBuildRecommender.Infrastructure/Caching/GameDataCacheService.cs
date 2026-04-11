using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace LoLBuildRecommender.Infrastructure.Caching;

public class GameDataCacheService : IGameDataService
{
    private readonly IDataDragonService _dataDragon;
    private readonly IMerakiService _meraki;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GameDataCacheService> _logger;

    private const string ChampionsCacheKey = "champions";
    private const string ItemsCacheKey = "items";
    private const string AllItemsCacheKey = "items-full"; // includes components (Tear etc.)
    private const string VersionCacheKey = "version";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(6);

    public GameDataCacheService(
        IDataDragonService dataDragon,
        IMerakiService meraki,
        IMemoryCache cache,
        ILogger<GameDataCacheService> logger)
    {
        _dataDragon = dataDragon;
        _meraki = meraki;
        _cache = cache;
        _logger = logger;
    }

    public async Task<string> GetCurrentVersionAsync()
    {
        return await _cache.GetOrCreateAsync(VersionCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            return await _dataDragon.GetLatestVersionAsync();
        }) ?? "unknown";
    }

    public async Task<Dictionary<int, ChampionInfo>> GetChampionsAsync()
    {
        return await _cache.GetOrCreateAsync(ChampionsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return await LoadEnrichedChampionsAsync();
        }) ?? new();
    }

    public async Task<Dictionary<int, ItemInfo>> GetCompletedItemsAsync()
    {
        return await _cache.GetOrCreateAsync(ItemsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return await LoadCompletedItemsAsync();
        }) ?? new();
    }

    /// <summary>
    /// Cached lookup across the FULL item pool (components + completed). Used by
    /// the recommender to surface "rush components" like Tear of the Goddess (3070)
    /// that aren't part of the build slot candidate pool but still need to be
    /// recommended to the player when the full item (Manamune etc.) is in the build.
    /// </summary>
    public async Task<ItemInfo?> GetItemByIdAsync(int id)
    {
        var all = await GetAllItemsAsync();
        return all.TryGetValue(id, out var item) ? item : null;
    }

    private async Task<Dictionary<int, ItemInfo>> GetAllItemsAsync()
    {
        return await _cache.GetOrCreateAsync(AllItemsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return await _dataDragon.GetItemsAsync();
        }) ?? new();
    }

    public async Task EnsureDataLoadedAsync()
    {
        _logger.LogInformation("Preloading game data...");
        var champTask = GetChampionsAsync();
        var itemTask = GetCompletedItemsAsync();
        await Task.WhenAll(champTask, itemTask);
        _logger.LogInformation("Game data loaded: {Champions} champions, {Items} items",
            (await champTask).Count, (await itemTask).Count);
    }

    private async Task<Dictionary<int, ChampionInfo>> LoadEnrichedChampionsAsync()
    {
        var ddChampions = await _dataDragon.GetChampionsAsync();
        var merakiData = await _meraki.GetAllChampionsAsync();

        _logger.LogInformation("Enriching {Count} champions with Meraki data ({MerakiCount} available)",
            ddChampions.Count, merakiData.Count);

        var result = new Dictionary<int, ChampionInfo>();
        foreach (var (id, champ) in ddChampions)
        {
            if (merakiData.TryGetValue(champ.Key, out var meraki))
            {
                result[id] = champ with
                {
                    Roles = meraki.Roles,
                    Positions = meraki.Positions,
                    AdaptiveType = meraki.AdaptiveType,
                    DamageProfile = meraki.DamageProfile,
                    AttributeRatings = meraki.AttributeRatings,
                    HasHealing = meraki.HasHealing,
                    HasHardCC = meraki.HasHardCC,
                    Resourceless = meraki.Resourceless,
                    HealingIntensity = meraki.HealingIntensity,
                    CcScore = meraki.CcScore,
                    SkillOrder = meraki.SkillOrder,
                };
            }
            else
            {
                result[id] = champ;
            }
        }
        return result;
    }

    private async Task<Dictionary<int, ItemInfo>> LoadCompletedItemsAsync()
    {
        // Reuse the cached full-items dict so we don't hit the Data Dragon CDN twice.
        var allItems = await GetAllItemsAsync();

        return allItems
            .Where(kv => IsCompletedItem(kv.Value))
            .ToDictionary(kv => kv.Key, kv => kv.Value);
    }

    private static bool IsCompletedItem(ItemInfo item)
    {
        if (item.Tags.Contains("Consumable")) return false;
        if (item.Classification.IsBoots && item.Depth >= 2) return true;
        // Fully upgraded support items are terminal — keep them in the pool so
        // Morgana-support/Thresh/etc. can get them when playing UTILITY.
        if (item.Classification.IsSupportItem && item.BuildsInto.Length == 0)
            return true;
        return item.Depth >= 3 || (item.BuildsInto.Length == 0 && item.Gold.Total >= 2000);
    }
}
