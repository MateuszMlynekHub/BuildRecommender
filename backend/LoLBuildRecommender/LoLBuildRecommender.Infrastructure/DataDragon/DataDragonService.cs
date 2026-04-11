using System.Net.Http.Json;
using System.Text.RegularExpressions;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Infrastructure.DataDragon.Dtos;

namespace LoLBuildRecommender.Infrastructure.DataDragon;

public partial class DataDragonService : IDataDragonService
{
    private readonly HttpClient _httpClient;
    private string? _cachedVersion;

    public DataDragonService(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient("DataDragon");
    }

    public async Task<string> GetLatestVersionAsync()
    {
        if (_cachedVersion is not null) return _cachedVersion;

        var versions = await _httpClient.GetFromJsonAsync<string[]>(
            "https://ddragon.leagueoflegends.com/api/versions.json");

        _cachedVersion = versions?[0] ?? "14.24.1";
        return _cachedVersion;
    }

    public async Task<Dictionary<int, ChampionInfo>> GetChampionsAsync()
    {
        var version = await GetLatestVersionAsync();
        var response = await _httpClient.GetFromJsonAsync<DDragonChampionResponse>(
            $"https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json");

        if (response is null) return new();

        var result = new Dictionary<int, ChampionInfo>();
        foreach (var (_, champ) in response.Data)
        {
            var id = int.Parse(champ.Key);
            var primaryDamage = champ.Info.Magic > champ.Info.Attack
                ? DamageType.Magic
                : DamageType.Physical;

            result[id] = new ChampionInfo
            {
                Id = id,
                Key = champ.Id,
                Name = champ.Name,
                Tags = champ.Tags.ToArray(),
                AdaptiveType = primaryDamage == DamageType.Magic ? "MAGIC_DAMAGE" : "PHYSICAL_DAMAGE",
                DamageProfile = new DamageProfile { PrimaryDamageType = primaryDamage },
                AttributeRatings = new AttributeRatings
                {
                    Damage = Math.Max(champ.Info.Attack, champ.Info.Magic),
                    Toughness = champ.Info.Defense,
                },
                ImageFileName = champ.Image.Full,
            };
        }
        return result;
    }

    // Starting quest items for the 4 support item lines. The support-item classification is
    // computed by BFS from these IDs through `into` chains, because the Data Dragon "GoldPer"
    // tag is unreliable (e.g. Stormsurge incorrectly carries it in current patches).
    private static readonly int[] SupportQuestItemIds = { 3850, 3854, 3858, 3862 };

    public async Task<Dictionary<int, ItemInfo>> GetItemsAsync()
    {
        var version = await GetLatestVersionAsync();
        var response = await _httpClient.GetFromJsonAsync<DDragonItemResponse>(
            $"https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/item.json");

        if (response is null) return new();

        var supportChainIds = ComputeSupportChainIds(response.Data);

        var result = new Dictionary<int, ItemInfo>();
        foreach (var (idStr, item) in response.Data)
        {
            if (!int.TryParse(idStr, out var id)) continue;

            // Normal Summoner's Rift items live in the ID range 1000–9999. IDs like
            // 32xxxx / 663xxx / 664xxx / 667xxx are Swarm/event variants that Riot tags
            // with maps.11=true but aren't actually purchasable in 5v5 ranked — they'd
            // show up as duplicate entries (e.g., 322065 = "Shurelya's Battlesong" on
            // top of 2065). We only want the canonical 5v5 pool.
            if (id >= 10000) continue;

            var isOnSR = item.Maps.GetValueOrDefault("11", false);
            if (!isOnSR || !item.Gold.Purchasable) continue;
            if (item.RequiredChampion is not null) continue;

            var tags = item.Tags.ToArray();
            var desc = StripHtml(item.Description);

            var stats = new ItemStats
            {
                AttackDamage = item.Stats.GetValueOrDefault("FlatPhysicalDamageMod"),
                AbilityPower = item.Stats.GetValueOrDefault("FlatMagicDamageMod"),
                Armor = item.Stats.GetValueOrDefault("FlatArmorMod"),
                MagicResist = item.Stats.GetValueOrDefault("FlatSpellBlockMod"),
                Health = item.Stats.GetValueOrDefault("FlatHPPoolMod"),
                Mana = item.Stats.GetValueOrDefault("FlatMPPoolMod"),
                AttackSpeed = item.Stats.GetValueOrDefault("PercentAttackSpeedMod"),
                CritChance = item.Stats.GetValueOrDefault("FlatCritChanceMod"),
                MoveSpeed = item.Stats.GetValueOrDefault("FlatMovementSpeedMod"),
                MoveSpeedPercent = item.Stats.GetValueOrDefault("PercentMovementSpeedMod"),
                Lethality = ItemDescriptionParser.ParseLethality(desc),
                ArmorPen = ItemDescriptionParser.ParseArmorPen(desc),
                MagicPen = ItemDescriptionParser.ParseMagicPen(desc),
                AbilityHaste = ItemDescriptionParser.ParseAbilityHaste(desc),
                LifeSteal = ItemDescriptionParser.ParseLifeSteal(desc),
                HasGrievousWounds = ItemDescriptionParser.HasGrievousWounds(desc),
                HasTenacity = ItemDescriptionParser.HasTenacity(desc),
            };

            var isBoots = ItemDescriptionParser.IsBootsItem(tags, item.Name);
            var classification = new ItemClassification
            {
                IsOffensive = stats.AttackDamage > 0 || stats.AbilityPower > 0
                              || stats.Lethality > 0 || stats.CritChance > 0,
                IsDefensive = stats.Armor > 0 || stats.MagicResist > 0 || stats.Health > 50,
                IsUtility = stats.AbilityHaste > 0 || stats.MoveSpeed > 0 || stats.MoveSpeedPercent > 0,
                IsBoots = isBoots,
                IsJungleItem = ItemDescriptionParser.IsJungleItem(desc, item.Name),
                IsSupportItem = supportChainIds.Contains(id),
                ProvidesAntiHeal = stats.HasGrievousWounds,
                ProvidesArmorPen = stats.Lethality > 0 || stats.ArmorPen > 0,
                ProvidesMagicPen = stats.MagicPen > 0,
                ProvidesTenacity = stats.HasTenacity,
            };

            result[id] = new ItemInfo
            {
                Id = id,
                Name = item.Name,
                Description = item.Description,
                PlainText = item.PlainText,
                Tags = tags,
                Stats = stats,
                Gold = new ItemGold
                {
                    Total = item.Gold.Total,
                    Base = item.Gold.Base,
                    Purchasable = item.Gold.Purchasable,
                },
                BuildsFrom = item.From?.Select(s => int.TryParse(s, out var v) ? v : 0)
                    .Where(v => v > 0).ToArray() ?? [],
                BuildsInto = item.Into?.Select(s => int.TryParse(s, out var v) ? v : 0)
                    .Where(v => v > 0).ToArray() ?? [],
                Depth = item.Depth ?? 1,
                IsAvailableOnSummonersRift = true,
                ImageFileName = item.Image.Full,
                // Full absolute CDN URL for the CURRENT patch. Set server-side so the
                // frontend never 404s on newer items because of a stale `version` signal.
                ImageUrl = $"https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{item.Image.Full}",
                Classification = classification,
                RequiredChampion = item.RequiredChampion,
            };
        }
        return result;
    }

    private static string StripHtml(string html)
        => HtmlTagRegex().Replace(html, " ");

    /// <summary>
    /// Walks every support quest starter (Spellthief's/Shoulderguards/Relic/Sickle) forward
    /// through each item's `into` chain and returns the set of every item ID reachable.
    /// That set == "anything in the support item tree", which is the authoritative source
    /// for IsSupportItem classification (unlike the unreliable "GoldPer" tag).
    /// </summary>
    private static HashSet<int> ComputeSupportChainIds(IReadOnlyDictionary<string, Dtos.DDragonItemDto> items)
    {
        var result = new HashSet<int>(SupportQuestItemIds);
        var queue = new Queue<int>(SupportQuestItemIds);

        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            if (!items.TryGetValue(currentId.ToString(), out var current)) continue;

            var intoList = current.Into;
            if (intoList is null) continue;

            foreach (var intoStr in intoList)
            {
                if (int.TryParse(intoStr, out var intoId) && result.Add(intoId))
                    queue.Enqueue(intoId);
            }
        }

        return result;
    }

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex HtmlTagRegex();
}
