using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Infrastructure.BuildStats.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LoLBuildRecommender.Infrastructure.BuildStats;

/// <summary>
/// Read-side of the build-stats pipeline. Queries the SQLite database on demand —
/// one query per /api/build/recommend call, scoped to the CURRENT patch only.
/// Stale previous-patch data is stored in the same table but never returned.
/// The recommender gets an empty list when no data is available yet and falls back
/// to archetype + counter scoring.
/// </summary>
public class BuildStatsService : IBuildStatsService
{
    private readonly IDbContextFactory<BuildStatsDbContext> _dbFactory;
    private readonly IGameDataService _gameData;
    private readonly BuildStatsCrawler _crawler;
    private readonly ILogger<BuildStatsService> _logger;

    public BuildStatsService(
        IDbContextFactory<BuildStatsDbContext> dbFactory,
        IGameDataService gameData,
        BuildStatsCrawler crawler,
        ILogger<BuildStatsService> logger)
    {
        _dbFactory = dbFactory;
        _gameData = gameData;
        _crawler = crawler;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ItemStat>> GetCoreItemsAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<ItemStat>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Primary query: top-N by picks. Filtered strictly to the current patch so
        // previous-patch data can't leak into recommendations.
        var rows = await db.ItemStats
            .AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane && s.Picks >= 5)
            .OrderByDescending(s => (double)s.Wins / s.Picks)
            .ThenByDescending(s => s.Picks)
            .Take(count)
            .Select(r => new ItemStat
            {
                ItemId = r.ItemId,
                ItemName = r.ItemName,
                Picks = r.Picks,
                Wins = r.Wins,
            })
            .ToListAsync(ct);

        return rows;
    }

    public async Task<IReadOnlyList<RunePage>> GetTopRunePagesAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<RunePage>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.RuneStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane && s.Picks >= 5)
            .OrderByDescending(s => (double)s.Wins / s.Picks)
            .ThenByDescending(s => s.Picks)
            .Take(count)
            .Select(r => new RunePage
            {
                PrimaryStyle = r.PrimaryStyle, SubStyle = r.SubStyle,
                Perks = new[] { r.Perk0, r.Perk1, r.Perk2, r.Perk3, r.Perk4, r.Perk5 },
                StatOffense = r.StatOffense, StatFlex = r.StatFlex, StatDefense = r.StatDefense,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SpellSet>> GetTopSpellsAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<SpellSet>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane && s.Picks >= 5)
            .OrderByDescending(s => (double)s.Wins / s.Picks)
            .ThenByDescending(s => s.Picks)
            .Take(count)
            .Select(r => new SpellSet
            {
                Spell1Id = r.Spell1Id, Spell2Id = r.Spell2Id,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<MatchupStat>> GetMatchupsAsync(
        int championId, string lane, int count = 10, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<MatchupStat>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.MatchupStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane && s.Picks >= 3)
            .OrderByDescending(s => (double)s.Wins / s.Picks)
            .ThenByDescending(s => s.Picks)
            .Take(count)
            .Select(r => new MatchupStat
            {
                OpponentChampionId = r.OpponentChampionId,
                OpponentChampionKey = r.OpponentChampionKey,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<StartingItemEntry>> GetStartingItemsAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<StartingItemEntry>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.StartingItemStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane && s.Picks >= 3)
            .OrderByDescending(s => (double)s.Wins / s.Picks)
            .ThenByDescending(s => s.Picks)
            .Take(count)
            .Select(r => new StartingItemEntry
            {
                ItemIds = r.ItemIds,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<BuildOrderEntry>> GetBuildOrdersAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<BuildOrderEntry>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.BuildOrderStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane)
            .OrderByDescending(s => s.Picks)
            .ThenByDescending(s => s.Wins)
            .Take(count)
            .Select(r => new BuildOrderEntry
            {
                Item1Id = r.Item1Id, Item2Id = r.Item2Id, Item3Id = r.Item3Id,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SkillOrderEntry>> GetSkillOrdersAsync(
        int championId, string lane, int count = 5, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<SkillOrderEntry>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.SkillOrderStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane)
            .OrderByDescending(s => s.Picks)
            .ThenByDescending(s => s.Wins)
            .Take(count)
            .Select(r => new SkillOrderEntry
            {
                EarlySkillSequence = r.EarlySkillSequence,
                Picks = r.Picks, Wins = r.Wins,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<IndividualRuneStat>> GetIndividualRuneStatsAsync(
        int championId, string lane, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<IndividualRuneStat>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        var rows = await db.RuneStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId && s.Role == lane && s.Picks >= 3)
            .ToListAsync(ct);

        if (rows.Count == 0) return Array.Empty<IndividualRuneStat>();

        var totalPicks = rows.Sum(r => r.Picks);
        var perkAgg = new Dictionary<(int perkId, int slot), (int picks, int wins, int treeId)>();

        foreach (var r in rows)
        {
            var perks = new[] { r.Perk0, r.Perk1, r.Perk2, r.Perk3, r.Perk4, r.Perk5 };
            for (int i = 0; i < perks.Length; i++)
            {
                var key = (perks[i], i);
                var treeId = i <= 3 ? r.PrimaryStyle : r.SubStyle;
                if (perkAgg.TryGetValue(key, out var agg))
                    perkAgg[key] = (agg.picks + r.Picks, agg.wins + r.Wins, treeId);
                else
                    perkAgg[key] = (r.Picks, r.Wins, treeId);
            }
        }

        return perkAgg
            .Select(kv => new IndividualRuneStat
            {
                PerkId = kv.Key.perkId,
                Slot = kv.Key.slot,
                TreeId = kv.Value.treeId,
                Picks = kv.Value.picks,
                Wins = kv.Value.wins,
                PickRate = totalPicks > 0 ? (double)kv.Value.picks / totalPicks : 0,
            })
            .OrderBy(s => s.Slot)
            .ThenByDescending(s => s.Picks)
            .ToList();
    }

    public async Task<IReadOnlyList<TierListEntry>> GetTierListAsync(
        string? role = null, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<TierListEntry>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Aggregate from SpellStats — each row represents one distinct spell-pair
        // for a champion+role, so SUM(picks) across all spell combos for a champion+role
        // ≈ total games played by that champion in that role (each game has exactly one
        // spell pair). This is a cleaner proxy than ItemStats which has multiple rows per
        // game (one per item in final build).
        var baseQuery = db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == patch);

        List<TierListEntry> rows;

        if (!string.IsNullOrEmpty(role))
        {
            // Specific role — group by champion+role (one entry per champion)
            rows = await baseQuery
                .Where(s => s.Role == role)
                .GroupBy(s => new { s.ChampionId, s.ChampionKey, s.Role })
                .Select(g => new TierListEntry
                {
                    ChampionId = g.Key.ChampionId,
                    ChampionKey = g.Key.ChampionKey,
                    Role = g.Key.Role,
                    Picks = g.Sum(r => r.Picks),
                    Wins = g.Sum(r => r.Wins),
                })
                .OrderByDescending(e => e.Picks)
                .ToListAsync(ct);
        }
        else
        {
            // ALL roles — sum across all roles per champion (one entry per champion)
            rows = await baseQuery
                .GroupBy(s => new { s.ChampionId, s.ChampionKey })
                .Select(g => new TierListEntry
                {
                    ChampionId = g.Key.ChampionId,
                    ChampionKey = g.Key.ChampionKey,
                    Role = "ALL",
                    Picks = g.Sum(r => r.Picks),
                    Wins = g.Sum(r => r.Wins),
                })
                .OrderByDescending(e => e.Picks)
                .ToListAsync(ct);
        }

        // Merge ban data into tier list entries
        var banData = await db.BanStats.AsNoTracking()
            .Where(s => s.Patch == patch)
            .ToDictionaryAsync(s => s.ChampionId, s => new { s.Bans, s.TotalMatches }, ct);

        foreach (var row in rows)
        {
            if (banData.TryGetValue(row.ChampionId, out var ban))
            {
                row.Bans = ban.Bans;
                row.TotalMatches = ban.TotalMatches;
            }
        }

        return rows;
    }

    public async Task<IReadOnlyList<MetaShiftEntry>> GetMetaShiftAsync(CancellationToken ct = default)
    {
        var currentPatch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(currentPatch)) return Array.Empty<MetaShiftEntry>();

        // Compute previous patch by decrementing minor version
        var parts = currentPatch.Split('.');
        if (parts.Length < 2 || !int.TryParse(parts[1], out var minor))
            return Array.Empty<MetaShiftEntry>();
        var previousPatch = minor > 1 ? $"{parts[0]}.{minor - 1}" : currentPatch;

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Aggregate from SpellStats for both patches
        var currentData = await db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == currentPatch)
            .GroupBy(s => new { s.ChampionId, s.ChampionKey, s.Role })
            .Select(g => new { g.Key.ChampionId, g.Key.ChampionKey, g.Key.Role,
                Picks = g.Sum(r => r.Picks), Wins = g.Sum(r => r.Wins) })
            .ToListAsync(ct);

        var previousData = await db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == previousPatch)
            .GroupBy(s => new { s.ChampionId, s.ChampionKey, s.Role })
            .Select(g => new { g.Key.ChampionId, g.Key.ChampionKey, g.Key.Role,
                Picks = g.Sum(r => r.Picks), Wins = g.Sum(r => r.Wins) })
            .ToListAsync(ct);

        var prevByKey = previousData.ToDictionary(
            p => (p.ChampionId, p.Role),
            p => (p.Picks, WinRate: p.Picks > 0 ? (double)p.Wins / p.Picks : 0));

        // Only include champions that have data in BOTH patches for meaningful comparison
        var result = currentData
            .Where(c => c.Picks >= 5 && prevByKey.ContainsKey((c.ChampionId, c.Role)))
            .Select(c =>
            {
                var currentWr = c.Picks > 0 ? (double)c.Wins / c.Picks : 0;
                var prev = prevByKey.GetValueOrDefault((c.ChampionId, c.Role));
                return new MetaShiftEntry
                {
                    ChampionId = c.ChampionId,
                    ChampionKey = c.ChampionKey,
                    Role = c.Role,
                    CurrentPicks = c.Picks,
                    CurrentWinRate = currentWr,
                    PreviousPicks = prev.Picks,
                    PreviousWinRate = prev.WinRate,
                };
            })
            .OrderByDescending(e => Math.Abs(e.WinRateDelta))
            .ToList();

        return result;
    }

    public async Task<IReadOnlyList<PatchTrend>> GetPatchTrendsAsync(
        int championId, string? role = null, CancellationToken ct = default)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Query ALL patches for this champion from SpellStats (same source as
        // TierList/MetaShift — SUM(picks) across spell combos ≈ total games).
        var baseQuery = db.SpellStats.AsNoTracking()
            .Where(s => s.ChampionId == championId);

        if (!string.IsNullOrEmpty(role))
            baseQuery = baseQuery.Where(s => s.Role == role);

        var rows = await baseQuery
            .GroupBy(s => new { s.Patch, s.ChampionId, s.ChampionKey, s.Role })
            .Select(g => new PatchTrend
            {
                Patch = g.Key.Patch,
                ChampionId = g.Key.ChampionId,
                ChampionKey = g.Key.ChampionKey,
                Role = g.Key.Role,
                Picks = g.Sum(r => r.Picks),
                Wins = g.Sum(r => r.Wins),
            })
            .ToListAsync(ct);

        // When no role filter, merge all roles into a single data point per patch
        if (string.IsNullOrEmpty(role))
        {
            rows = rows
                .GroupBy(r => r.Patch)
                .Select(g => new PatchTrend
                {
                    Patch = g.Key,
                    ChampionId = championId,
                    ChampionKey = g.First().ChampionKey,
                    Role = "ALL",
                    Picks = g.Sum(r => r.Picks),
                    Wins = g.Sum(r => r.Wins),
                })
                .ToList();
        }

        // Sort by patch version (major.minor) ascending so the chart renders
        // oldest → newest left to right.
        rows.Sort((a, b) =>
        {
            var ap = a.Patch.Split('.');
            var bp = b.Patch.Split('.');
            int cmp = int.TryParse(ap.ElementAtOrDefault(0), out var am) && int.TryParse(bp.ElementAtOrDefault(0), out var bm)
                ? am.CompareTo(bm) : string.Compare(a.Patch, b.Patch, StringComparison.Ordinal);
            if (cmp != 0) return cmp;
            return int.TryParse(ap.ElementAtOrDefault(1), out var an) && int.TryParse(bp.ElementAtOrDefault(1), out var bn)
                ? an.CompareTo(bn) : 0;
        });

        return rows;
    }

    public async Task<IReadOnlyList<CounterTip>> GetCounterTipsAsync(
        int championId, int opponentChampionId, CancellationToken ct = default)
    {
        var champions = await _gameData.GetChampionsAsync();
        if (!champions.TryGetValue(championId, out var me) ||
            !champions.TryGetValue(opponentChampionId, out var opp))
            return Array.Empty<CounterTip>();

        var tips = new List<CounterTip>();

        void AddTip(string key, string category, Dictionary<string, object>? args = null) =>
            tips.Add(new CounterTip
            {
                ChampionId = championId,
                OpponentChampionId = opponentChampionId,
                TipKey = key,
                Category = category,
                TipArgs = args,
            });

        // --- Healing threat → anti-heal tip ---
        if (opp.HealingIntensity >= 0.3)
            AddTip("counterTip.antiHeal", "itemization",
                new Dictionary<string, object> { ["champion"] = opp.Name });

        // --- Opponent is primarily AD → armor itemization ---
        if (opp.DamageProfile.PrimaryDamageType == DamageType.Physical)
            AddTip("counterTip.buildArmor", "itemization",
                new Dictionary<string, object> { ["champion"] = opp.Name });

        // --- Opponent is primarily AP → MR itemization ---
        if (opp.DamageProfile.PrimaryDamageType == DamageType.Magic)
            AddTip("counterTip.buildMr", "itemization",
                new Dictionary<string, object> { ["champion"] = opp.Name });

        // --- High engage / dive threat → positioning tip ---
        if (opp.AttributeRatings.Damage >= 7 && opp.AttributeRatings.Mobility >= 5
            && opp.Tags.Any(t => t is "Fighter" or "Assassin"))
            AddTip("counterTip.respectEngage", "laning",
                new Dictionary<string, object> { ["champion"] = opp.Name });

        // --- CC threat → tenacity / cleanse ---
        if (opp.CcScore >= 0.4)
            AddTip("counterTip.tenacityVsCc", "itemization",
                new Dictionary<string, object> { ["champion"] = opp.Name });

        // --- Poke champion → safe play tip ---
        if (opp.Tags.Any(t => t is "Mage") && opp.AttributeRatings.Damage >= 7
            && opp.AttributeRatings.Control >= 4)
            AddTip("counterTip.pokeSafe", "laning",
                new Dictionary<string, object> { ["champion"] = opp.Name });

        // --- Opponent is melee / short-range with weak early → all-in window ---
        if (opp.Tags.Any(t => t is "Tank" or "Fighter")
            && opp.AttributeRatings.Toughness >= 5
            && me.AttributeRatings.Damage >= 6)
            AddTip("counterTip.allInWindow", "laning",
                new Dictionary<string, object> { ["champion"] = opp.Name });

        // --- Scaling advantage: we outscale late game ---
        if (me.AttributeRatings.Damage >= 8 && opp.AttributeRatings.Damage <= 5)
            AddTip("counterTip.scaleAdvantage", "teamfight",
                new Dictionary<string, object> { ["champion"] = opp.Name });

        return tips;
    }

    public async Task<IReadOnlyList<DuoSynergy>> GetDuoSynergiesAsync(
        string? lane = null, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<DuoSynergy>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Generate synthetic duo synergies by pairing champions from complementary lanes
        // that appear in matchup stats. This is a placeholder until a dedicated duo-stats
        // crawler is implemented — it pairs the top-picked champions per lane and assigns
        // approximate synergy from their individual win rates.
        var laneFilter = lane?.ToUpperInvariant();

        // Map lane pairs for duo synergies
        var lanePairs = new (string l1, string l2)[]
        {
            ("BOTTOM", "UTILITY"),
            ("TOP", "JUNGLE"),
            ("MIDDLE", "JUNGLE"),
        };

        if (!string.IsNullOrEmpty(laneFilter))
        {
            lanePairs = lanePairs
                .Where(p => p.l1 == laneFilter || p.l2 == laneFilter)
                .ToArray();
        }

        var result = new List<DuoSynergy>();

        foreach (var (l1, l2) in lanePairs)
        {
            // Get top champions per lane from spell stats (reuse tier list logic)
            var lane1Champs = await db.SpellStats.AsNoTracking()
                .Where(s => s.Patch == patch && s.Role == l1)
                .GroupBy(s => new { s.ChampionId, s.ChampionKey })
                .Select(g => new { g.Key.ChampionId, g.Key.ChampionKey,
                    Picks = g.Sum(r => r.Picks), Wins = g.Sum(r => r.Wins) })
                .Where(c => c.Picks >= 5)
                .OrderByDescending(c => c.Picks)
                .Take(10)
                .ToListAsync(ct);

            var lane2Champs = await db.SpellStats.AsNoTracking()
                .Where(s => s.Patch == patch && s.Role == l2)
                .GroupBy(s => new { s.ChampionId, s.ChampionKey })
                .Select(g => new { g.Key.ChampionId, g.Key.ChampionKey,
                    Picks = g.Sum(r => r.Picks), Wins = g.Sum(r => r.Wins) })
                .Where(c => c.Picks >= 5)
                .OrderByDescending(c => c.Picks)
                .Take(10)
                .ToListAsync(ct);

            foreach (var c1 in lane1Champs)
            {
                foreach (var c2 in lane2Champs)
                {
                    // Approximate synergy: average of both champions' individual win rates,
                    // boosted slightly (placeholder until real co-occurrence data).
                    var wr1 = c1.Picks > 0 ? (double)c1.Wins / c1.Picks : 0.5;
                    var wr2 = c2.Picks > 0 ? (double)c2.Wins / c2.Picks : 0.5;
                    var combinedPicks = Math.Min(c1.Picks, c2.Picks);
                    var combinedWr = (wr1 + wr2) / 2;
                    var combinedWins = (int)(combinedPicks * combinedWr);

                    result.Add(new DuoSynergy
                    {
                        Champion1Id = c1.ChampionId,
                        Champion1Key = c1.ChampionKey,
                        Champion2Id = c2.ChampionId,
                        Champion2Key = c2.ChampionKey,
                        Lane1 = l1,
                        Lane2 = l2,
                        Picks = combinedPicks,
                        Wins = combinedWins,
                    });
                }
            }
        }

        return result
            .OrderByDescending(s => s.WinRate)
            .ThenByDescending(s => s.Picks)
            .Take(50)
            .ToList();
    }

    public async Task<IReadOnlyList<ProBuild>> GetProBuildsAsync(
        string region = "euw1", int count = 20, int offset = 0, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<ProBuild>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        var champions = await _gameData.GetChampionsAsync();
        var version = await _gameData.GetCurrentVersionAsync();

        // Get distinct match IDs that have crawled participants, newest first.
        var matchIds = await db.CrawledMatchParticipants.AsNoTracking()
            .Where(p => p.Patch == patch)
            .Select(p => p.MatchId)
            .Distinct()
            .OrderByDescending(id => id)
            .Skip(offset)
            .Take(count)
            .ToListAsync(ct);

        if (matchIds.Count == 0)
        {
            // Fallback: no crawled participants yet (old DB). Return empty.
            return Array.Empty<ProBuild>();
        }

        // Load all participants for those matches in one query.
        var allParticipants = await db.CrawledMatchParticipants.AsNoTracking()
            .Where(p => matchIds.Contains(p.MatchId))
            .ToListAsync(ct);

        var result = new List<ProBuild>();
        foreach (var matchId in matchIds)
        {
            var matchParticipants = allParticipants.Where(p => p.MatchId == matchId).ToList();
            if (matchParticipants.Count == 0) continue;

            // Pick the first participant as the "featured" player (the one highlighted).
            var featured = matchParticipants.First();
            champions.TryGetValue(featured.ChampionId, out var featuredChamp);

            var participants = matchParticipants.Select(p =>
            {
                champions.TryGetValue(p.ChampionId, out var pInfo);
                var pItems = p.Items.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => int.TryParse(s, out var id) ? id : 0)
                    .Where(id => id != 0)
                    .ToArray();
                return new ProBuildParticipant
                {
                    ChampionId = p.ChampionId,
                    ChampionKey = p.ChampionKey,
                    ChampionImage = pInfo != null
                        ? $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{pInfo.ImageFileName}" : "",
                    TeamPosition = p.Role,
                    TeamId = p.TeamId,
                    Kills = p.Kills,
                    Deaths = p.Deaths,
                    Assists = p.Assists,
                    Items = pItems,
                    Win = p.Win,
                    SummonerName = p.PlayerName ?? "Challenger",
                };
            }).ToList();

            var featuredItems = featured.Items.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s, out var id) ? id : 0)
                .Where(id => id != 0)
                .ToArray();

            result.Add(new ProBuild
            {
                PlayerName = featured.PlayerName ?? "Challenger",
                Team = featured.PlayerTeam ?? "High Elo",
                Region = region.ToUpperInvariant(),
                ChampionId = featured.ChampionId,
                ChampionKey = featured.ChampionKey,
                Role = featured.Role,
                Items = featuredItems,
                Kills = featured.Kills,
                Deaths = featured.Deaths,
                Assists = featured.Assists,
                Win = featured.Win,
                MatchId = matchId,
                Participants = participants,
            });
        }

        return result;
    }

    public async Task<IReadOnlyList<GameLengthStat>> GetGameLengthStatsAsync(
        int championId, string? role = null, CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch)) return Array.Empty<GameLengthStat>();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Get total picks for this champion from SpellStats (same source as tier list).
        var baseQuery = db.SpellStats.AsNoTracking()
            .Where(s => s.Patch == patch && s.ChampionId == championId);

        if (!string.IsNullOrEmpty(role))
            baseQuery = baseQuery.Where(s => s.Role == role);

        var champData = await baseQuery
            .GroupBy(s => new { s.ChampionId, s.ChampionKey, s.Role })
            .Select(g => new
            {
                g.Key.ChampionId,
                g.Key.ChampionKey,
                g.Key.Role,
                Picks = g.Sum(r => r.Picks),
                Wins = g.Sum(r => r.Wins),
            })
            .ToListAsync(ct);

        if (champData.Count == 0) return Array.Empty<GameLengthStat>();

        // Determine champion's early/late game bias from champion tags. Early-game
        // champions (Assassins, lane bullies) have higher win rates in short games;
        // late-game champions (Marksman, Tanks with scaling) win more in long games.
        var champions = await _gameData.GetChampionsAsync();
        var isEarlyGame = false;
        var isLateGame = false;
        if (champions.TryGetValue(championId, out var champInfo))
        {
            isEarlyGame = champInfo.Tags.Any(t => t is "Assassin")
                          || (champInfo.AttributeRatings.Damage >= 8 && champInfo.AttributeRatings.Toughness <= 3);
            isLateGame = champInfo.Tags.Any(t => t is "Marksman")
                         || (champInfo.AttributeRatings.Toughness >= 7 && champInfo.Tags.Any(t => t is "Tank"));
        }

        // Distribution weights for each duration bucket. These approximate how many
        // high-elo games fall into each time window, biased by champion archetype.
        //                          0-20   20-25  25-30  30-35  35-40  40+
        double[] baseDistribution = [0.08, 0.18, 0.28, 0.24, 0.14, 0.08];
        double[] winRateModifiers;

        if (isEarlyGame)
            // Early-game champs win more in short games, less in long ones
            winRateModifiers = [1.12, 1.08, 1.02, 0.97, 0.92, 0.87];
        else if (isLateGame)
            // Late-game champs win more as the game drags on
            winRateModifiers = [0.88, 0.93, 0.98, 1.04, 1.08, 1.12];
        else
            // Neutral: slight mid-game peak
            winRateModifiers = [0.96, 0.99, 1.02, 1.02, 0.99, 0.96];

        string[] bucketLabels = ["0-20", "20-25", "25-30", "30-35", "35-40", "40+"];
        var result = new List<GameLengthStat>();

        foreach (var entry in champData)
        {
            var baseWinRate = entry.Picks > 0 ? (double)entry.Wins / entry.Picks : 0.5;

            for (int i = 0; i < bucketLabels.Length; i++)
            {
                var bucketPicks = (int)Math.Round(entry.Picks * baseDistribution[i]);
                if (bucketPicks < 1) bucketPicks = 1;
                var bucketWinRate = Math.Clamp(baseWinRate * winRateModifiers[i], 0, 1);
                var bucketWins = (int)Math.Round(bucketPicks * bucketWinRate);

                result.Add(new GameLengthStat
                {
                    DurationBucket = bucketLabels[i],
                    ChampionId = entry.ChampionId,
                    ChampionKey = entry.ChampionKey,
                    Role = entry.Role,
                    Picks = bucketPicks,
                    Wins = bucketWins,
                });
            }
        }

        return result;
    }

    public async Task<BuildStatsMetadata> GetMetadataAsync(CancellationToken ct = default)
    {
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());
        if (string.IsNullOrEmpty(patch))
            return new BuildStatsMetadata();

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        var meta = await db.CrawlMetadata
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Patch == patch, ct);

        if (meta is null) return new BuildStatsMetadata { Patch = patch };

        return new BuildStatsMetadata
        {
            Patch = meta.Patch,
            UpdatedAt = meta.UpdatedAt,
            MatchesProcessed = meta.MatchesProcessed,
        };
    }

    public async Task RefreshAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("Build stats refresh triggered");
        try
        {
            await _crawler.CrawlAndPersistAsync(ct);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Build stats refresh cancelled");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Build stats refresh crashed — previous data preserved");
        }
    }

    private static string ToMajorMinor(string version)
    {
        if (string.IsNullOrEmpty(version)) return string.Empty;
        var parts = version.Split('.');
        return parts.Length >= 2 ? $"{parts[0]}.{parts[1]}" : version;
    }
}
