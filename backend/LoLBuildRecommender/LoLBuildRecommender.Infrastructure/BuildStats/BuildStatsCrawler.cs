using System.Text.Json;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Core.Services;
using LoLBuildRecommender.Infrastructure.BuildStats.Configuration;
using LoLBuildRecommender.Infrastructure.BuildStats.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LoLBuildRecommender.Infrastructure.BuildStats;

/// <summary>
/// Riot Match API crawler with two operating modes:
///   • <b>Backfill</b> — first run on a new patch, pulls the last N days of Challenger
///     matches (<see cref="BuildStatsOptions.BackfillDays"/>) with <c>startTime</c> filtering.
///     Takes ~20–25 minutes on a dev key; ~3–5 minutes on a production key.
///   • <b>Incremental</b> — subsequent hourly runs, pulls only matches played since the
///     last successful crawl (with a 15-minute overlap for safety). Takes ~3–5 minutes.
///
/// Dedup via the <see cref="ProcessedMatchEntity"/> table — a match is only aggregated once
/// even if a later incremental crawl re-fetches its ID. Aggregation is UPSERT-based so
/// Picks and Wins accumulate across crawls, stats grow over time instead of being replaced.
/// </summary>
public class BuildStatsCrawler
{
    private readonly IRiotApiService _riot;
    private readonly IGameDataService _gameData;
    private readonly IDbContextFactory<BuildStatsDbContext> _dbFactory;
    private readonly BuildStatsOptions _options;
    private readonly ILogger<BuildStatsCrawler> _logger;

    // Small overlap on incremental crawls so we don't miss matches that finished
    // between the end of the last crawl and "now-at-start-of-this-crawl".
    private static readonly TimeSpan IncrementalOverlap = TimeSpan.FromMinutes(15);

    // Flush aggregated data to SQLite every N matches so progress is visible to
    // clients mid-crawl and a crash during a multi-hour backfill doesn't lose everything.
    // 100 matches = ~140 seconds of work with the default 1.4 s throttle — a good
    // balance between transaction overhead and crash-safety.
    private const int PersistBatchSize = 100;

    /// <summary>
    /// Bump this whenever aggregation semantics change (new item aliases, new exclusion
    /// groups, new filters). On startup, the crawler checks the stored version on the
    /// current-patch CrawlMetadata row — if it's lower than this constant, the patch
    /// data is wiped and a full backfill runs so the recommendations reflect the new
    /// semantics instead of stale aggregates from a previous crawler version.
    ///
    /// Version history:
    ///   1 — initial release (no aliases)
    ///   2 — added Muramana→Manamune / Seraph's→Archangel's / Fimbulwinter→Winter's alias map
    ///   3 — expanded crawler to collect runes, summoner spells, and matchup data
    ///   3+ — build order + skill order tables added incrementally (no wipe needed,
    ///         new tables created by DDL in Program.cs, populated from new matches only)
    /// </summary>
    public const int CurrentDataVersion = 3;

    /// <summary>
    /// Maps auto-upgraded item forms to their purchasable base. When a player's final
    /// inventory contains the upgraded form (e.g., Muramana after Tear stacks), we log
    /// it under the form the player actually BUILT (Manamune) so the recommender
    /// surfaces the item you can actually purchase. Without this, items like Manamune
    /// / Archangel's Staff / Winter's Approach never show up despite being core picks.
    /// </summary>
    private static readonly Dictionary<int, int> ItemIdAliases = new()
    {
        [3042] = 3004,  // Muramana → Manamune
        [3040] = 3003,  // Seraph's Embrace → Archangel's Staff
        [3121] = 3119,  // Fimbulwinter → Winter's Approach
    };

    /// <summary>Boots item IDs — excluded from core build path tracking.</summary>
    private static readonly HashSet<int> BootsItemIds = [3006, 3009, 3020, 3047, 3111, 3117, 3158];

    /// <summary>Skill slot → letter mapping (Riot uses 1-4 for Q/W/E/R).</summary>
    private static string SkillSlotToLetter(int slot) => slot switch { 1 => "Q", 2 => "W", 3 => "E", 4 => "R", _ => "?" };

    /// <summary>Pro player lookup: IGN (case-insensitive) → (name, team).</summary>
    private static readonly Dictionary<string, (string name, string team)> ProPlayerLookup = LoadProPlayers();

    private static Dictionary<string, (string name, string team)> LoadProPlayers()
    {
        var lookup = new Dictionary<string, (string, string)>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var assembly = typeof(BuildStatsCrawler).Assembly;
            var resourceName = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("ProPlayers.json"));
            if (resourceName is null) return lookup;

            using var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream is null) return lookup;

            var players = JsonSerializer.Deserialize<List<ProPlayerEntry>>(stream);
            if (players is null) return lookup;

            foreach (var p in players)
            {
                if (!string.IsNullOrEmpty(p.name))
                    lookup.TryAdd(p.name, (p.name, p.team ?? ""));
            }
        }
        catch { /* non-critical — pro tags just won't appear */ }
        return lookup;
    }

    private record ProPlayerEntry(string name, string? team, string? region, string? role);

    public BuildStatsCrawler(
        IRiotApiService riot,
        IGameDataService gameData,
        IDbContextFactory<BuildStatsDbContext> dbFactory,
        IOptions<BuildStatsOptions> options,
        ILogger<BuildStatsCrawler> logger)
    {
        _riot = riot;
        _gameData = gameData;
        _dbFactory = dbFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task CrawlAndPersistAsync(CancellationToken ct = default)
    {
        var regions = _options.Regions is { Length: > 0 } ? _options.Regions : [_options.Region];

        foreach (var region in regions)
        {
            if (ct.IsCancellationRequested) break;
            _logger.LogInformation("Starting crawl for region {Region}", region);
            try
            {
                await CrawlRegionAsync(region, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Crawl failed for region {Region} — continuing to next", region);
            }
        }
    }

    private async Task CrawlRegionAsync(string crawlRegion, CancellationToken ct)
    {
        var champInfo = await _gameData.GetChampionsAsync();
        var itemInfo = await _gameData.GetCompletedItemsAsync();
        var patch = ToMajorMinor(await _gameData.GetCurrentVersionAsync());

        if (string.IsNullOrEmpty(patch))
        {
            _logger.LogWarning("Could not determine current patch — aborting crawl");
            return;
        }

        // --- Decide mode: first-time backfill vs incremental sweep ---
        await using (var meta = await _dbFactory.CreateDbContextAsync(ct))
        {
            // Patch-transition cleanup — if previous patch left ProcessedMatches rows,
            // prune them so we don't carry stale dedup state into the new patch.
            var prunedOldMatches = await meta.ProcessedMatches
                .Where(m => m.Patch != patch)
                .ExecuteDeleteAsync(ct);
            if (prunedOldMatches > 0)
                _logger.LogInformation("Pruned {Count} ProcessedMatches rows from previous patches", prunedOldMatches);
        }

        // Validate existing item data against current DDragon items — remove rows for
        // items that no longer exist (reworked/removed between patches).
        await using (var cleanupDb = await _dbFactory.CreateDbContextAsync(ct))
        {
            var staleItems = await cleanupDb.ItemStats
                .Where(s => s.Patch == patch && !itemInfo.Keys.Contains(s.ItemId))
                .ExecuteDeleteAsync(ct);
            if (staleItems > 0)
                _logger.LogInformation("Removed {Count} stale item stat rows (items no longer in DDragon)", staleItems);
        }

        var existingMeta = await GetExistingMetadataAsync(patch, ct);

        // If the DB has ItemStats rows for this patch but no ProcessedMatches tracking
        // (data was created by an older crawler version that didn't dedup match IDs),
        // re-do a full backfill so incremental UPSERTs don't double-count existing aggregates.
        var needsSchemaReset = existingMeta is not null
            && existingMeta.MatchesProcessed > 0
            && await IsProcessedMatchesEmptyForPatchAsync(patch, ct);

        if (needsSchemaReset)
        {
            _logger.LogWarning(
                "Detected {Matches} ItemStats rows for patch {Patch} without any ProcessedMatches tracking — clearing current-patch aggregates.",
                existingMeta!.MatchesProcessed, patch);
            await ClearCurrentPatchAsync(patch, ct);
            existingMeta = null;
        }

        // Data-version drift: if the current crawler code version is higher than what
        // the stored aggregates were built with, the aggregation semantics have
        // changed (new item aliases, new exclusion groups, etc.) and the old data
        // would produce wrong recommendations. Wipe the current patch and rebackfill.
        // Historical patches are left alone — they reflect the meta of their own time.
        if (existingMeta is not null && existingMeta.DataVersion < CurrentDataVersion)
        {
            _logger.LogWarning(
                "Data version drift for patch {Patch}: stored={Stored}, code={Current}. Wiping current-patch aggregates for a fresh backfill with new aggregation semantics.",
                patch, existingMeta.DataVersion, CurrentDataVersion);
            await ClearCurrentPatchAsync(patch, ct);
            existingMeta = null;
        }

        var isBackfill = existingMeta is null || existingMeta.MatchesProcessed == 0;

        DateTimeOffset startTime;
        string modeLabel;
        if (isBackfill)
        {
            // If a fixed backfill date is configured (e.g. season start), use it
            // instead of the relative BackfillDays. This pulls ALL matches since
            // that date, across multiple patches.
            if (!string.IsNullOrEmpty(_options.BackfillSinceDate)
                && DateTimeOffset.TryParse(_options.BackfillSinceDate, out var sinceDate))
            {
                startTime = sinceDate;
                modeLabel = $"backfill since {sinceDate:yyyy-MM-dd}";
            }
            else
            {
                startTime = DateTimeOffset.UtcNow.AddDays(-_options.BackfillDays);
                modeLabel = $"backfill {_options.BackfillDays}d";
            }
        }
        else
        {
            var lastCrawl = new DateTimeOffset(DateTime.SpecifyKind(existingMeta!.UpdatedAt, DateTimeKind.Utc));
            startTime = lastCrawl - IncrementalOverlap;
            modeLabel = $"incremental since {startTime:u}";
        }

        var started = DateTime.UtcNow;
        _logger.LogInformation(
            "Crawl start: patch={Patch}, mode={Mode}, region={Region}, delay={DelayMs}ms, cap={Max} matches",
            patch, modeLabel, crawlRegion, _options.RequestDelayMs, _options.MaxTotalMatches);

        // --- 1. Seed: PUUIDs from every enabled ladder tier (Challenger, Grandmaster, Master) ---
        var puuids = await FetchPlayerPoolAsync(crawlRegion, ct);
        if (puuids.Length == 0)
        {
            _logger.LogWarning(
                "No PUUIDs in player pool (all tiers disabled or Riot ladder fetch failed?) — aborting crawl");
            return;
        }
        _logger.LogInformation("Player pool: {Count} unique PUUIDs after stratified sampling", puuids.Length);

        // --- 2. Collect unique match IDs in the time window ---
        // In backfill mode we request 100 per player (Riot cap) to grab the full week.
        // In incremental mode MatchesPerPlayer from config is usually enough.
        var perPlayerLimit = isBackfill ? 100 : _options.MatchesPerPlayer;
        var windowIds = new HashSet<string>();
        var playersProcessed = 0;

        foreach (var puuid in puuids.Take(_options.MaxPlayers))
        {
            if (ct.IsCancellationRequested) break;
            try
            {
                var ids = await _riot.GetRankedMatchIdsAsync(
                    puuid, crawlRegion, perPlayerLimit, startTime, ct);
                foreach (var id in ids)
                {
                    windowIds.Add(id);
                }
                playersProcessed++;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping player {Puuid} — match IDs fetch failed", puuid);
            }
            await ThrottleAsync(ct);
        }
        _logger.LogInformation(
            "Collected {Count} unique match IDs in time window (from {Players} players)",
            windowIds.Count, playersProcessed);

        if (windowIds.Count == 0)
        {
            _logger.LogWarning("No match IDs in time window — skipping");
            return;
        }

        // --- 3. Filter out matches already aggregated (dedup via ProcessedMatches) ---
        HashSet<string> newMatchIds;
        await using (var dedupDb = await _dbFactory.CreateDbContextAsync(ct))
        {
            // Pull the subset of windowIds that already exist in ProcessedMatches.
            // EF translates `.Contains` into a SQL `IN (...)` clause — fine for a few thousand ids.
            var windowArr = windowIds.ToArray();
            var alreadyProcessed = await dedupDb.ProcessedMatches
                .AsNoTracking()
                .Where(m => windowArr.Contains(m.MatchId))
                .Select(m => m.MatchId)
                .ToListAsync(ct);

            var filtered = windowIds.Except(alreadyProcessed, StringComparer.Ordinal);
            newMatchIds = (_options.MaxTotalMatches > 0
                ? filtered.Take(_options.MaxTotalMatches)
                : filtered)
                .ToHashSet(StringComparer.Ordinal);

            _logger.LogInformation(
                "{New} new matches to fetch ({Already} already in ProcessedMatches, cap={Cap})",
                newMatchIds.Count, alreadyProcessed.Count,
                _options.MaxTotalMatches > 0 ? _options.MaxTotalMatches : "unlimited");
        }

        if (newMatchIds.Count == 0)
        {
            _logger.LogInformation("Nothing new to process — updating crawl timestamp only");
            await BumpMetadataAsync(patch, addedMatches: 0, ct);
            return;
        }

        // --- 4. Fetch details + in-memory aggregation, flushing to DB every PersistBatchSize matches ---
        // Batched persistence means progress is visible mid-crawl (matchesProcessed ticks up
        // by 100 every ~2.5 minutes with dev key) and a crash during the multi-hour backfill
        // only loses the current batch, not everything.
        var batchAggregate = new Dictionary<(int championId, string role, int itemId), AggregatedStat>();
        var batchRuneAggregate = new Dictionary<(int championId, string role, int ps, int ss, int p0, int p1, int p2, int p3, int p4, int p5, int so, int sf, int sd), AggregatedRuneStat>();
        var batchSpellAggregate = new Dictionary<(int championId, string role, int spell1, int spell2), AggregatedSpellStat>();
        var batchMatchupAggregate = new Dictionary<(int championId, string role, int opponentId), AggregatedMatchupStat>();
        var batchBuildOrderAggregate = new Dictionary<(int championId, string role, int item1, int item2, int item3), AggregatedBuildOrderStat>();
        var batchSkillOrderAggregate = new Dictionary<(int championId, string role, string earlySequence), AggregatedSkillOrderStat>();
        var batchStartingItemAggregate = new Dictionary<(int championId, string role, string itemIds), AggregatedStartingItemStat>();
        var batchBanAggregate = new Dictionary<int, (string championKey, int bans)>();
        var batchTotalMatches = 0;
        var batchMatchIds = new List<string>();
        var batchParticipants = new List<CrawledMatchParticipantEntity>();
        var batchAggregatedCount = 0;  // matches in the current batch that contributed to ItemStats
        var totalProcessed = 0;
        var totalFlushed = 0;
        var skippedWrongPatch = 0;
        var skippedWrongQueue = 0;
        var errors = 0;

        foreach (var matchId in newMatchIds)
        {
            if (ct.IsCancellationRequested) break;

            MatchDetails? match;
            try
            {
                match = await _riot.GetMatchDetailsAsync(matchId, crawlRegion, ct);
            }
            catch (Exception ex)
            {
                errors++;
                _logger.LogDebug(ex, "Skipping match {MatchId} — detail fetch failed", matchId);
                await ThrottleAsync(ct);
                continue;
            }

            await ThrottleAsync(ct);

            if (match is null) { errors++; continue; }
            if (match.QueueId != 420) { skippedWrongQueue++; continue; }

            var matchPatch = ToMajorMinor(match.GameVersion);
            // When backfilling from a fixed date (season start), accept matches from
            // ANY patch — they all get aggregated under the current patch tag so all
            // endpoints see the data. This gives us a large dataset from day one.
            // In incremental mode, keep the strict same-patch filter.
            var acceptCrossPatch = !string.IsNullOrEmpty(_options.BackfillSinceDate) && isBackfill;
            if (!acceptCrossPatch && !string.Equals(matchPatch, patch, StringComparison.Ordinal))
            {
                skippedWrongPatch++;
                batchMatchIds.Add(matchId);
                continue;
            }

            foreach (var p in match.Participants)
            {
                if (string.IsNullOrEmpty(p.TeamPosition)) continue;
                if (!champInfo.TryGetValue(p.ChampionId, out var champ)) continue;

                var role = NormalizeLane(p.TeamPosition);

                // Resolve upgraded auto-transform items to their purchasable base. .Distinct()
                // runs after the alias map so Manamune/Muramana in the same inventory (shouldn't
                // happen but defensive) count as one pick, not two.
                var resolvedItemIds = p.Items
                    .Where(id => id != 0)
                    .Select(id => ItemIdAliases.GetValueOrDefault(id, id))
                    .Distinct();

                foreach (var itemId in resolvedItemIds)
                {
                    if (!itemInfo.TryGetValue(itemId, out var item)) continue;

                    var key = (p.ChampionId, role, itemId);
                    if (!batchAggregate.TryGetValue(key, out var stat))
                    {
                        stat = new AggregatedStat
                        {
                            ChampionId = p.ChampionId,
                            ChampionKey = champ.Key,
                            Role = role,
                            ItemId = itemId,
                            ItemName = item.Name,
                        };
                        batchAggregate[key] = stat;
                    }
                    stat.Picks++;
                    if (p.Win) stat.Wins++;
                }

                // --- Rune aggregation ---
                if (p.Perks.Length == 6 && p.PrimaryStyle != 0)
                {
                    var runeKey = (p.ChampionId, role, p.PrimaryStyle, p.SubStyle,
                        p.Perks[0], p.Perks[1], p.Perks[2], p.Perks[3], p.Perks[4], p.Perks[5],
                        p.StatOffense, p.StatFlex, p.StatDefense);
                    if (!batchRuneAggregate.TryGetValue(runeKey, out var runeStat))
                    {
                        runeStat = new AggregatedRuneStat
                        {
                            ChampionId = p.ChampionId, ChampionKey = champ.Key, Role = role,
                            PrimaryStyle = p.PrimaryStyle, SubStyle = p.SubStyle,
                            Perk0 = p.Perks[0], Perk1 = p.Perks[1], Perk2 = p.Perks[2],
                            Perk3 = p.Perks[3], Perk4 = p.Perks[4], Perk5 = p.Perks[5],
                            StatOffense = p.StatOffense, StatFlex = p.StatFlex, StatDefense = p.StatDefense,
                        };
                        batchRuneAggregate[runeKey] = runeStat;
                    }
                    runeStat.Picks++;
                    if (p.Win) runeStat.Wins++;
                }

                // --- Summoner spell aggregation (normalized: min first) ---
                if (p.Summoner1Id != 0 && p.Summoner2Id != 0)
                {
                    var s1 = Math.Min(p.Summoner1Id, p.Summoner2Id);
                    var s2 = Math.Max(p.Summoner1Id, p.Summoner2Id);
                    var spellKey = (p.ChampionId, role, s1, s2);
                    if (!batchSpellAggregate.TryGetValue(spellKey, out var spellStat))
                    {
                        spellStat = new AggregatedSpellStat
                        {
                            ChampionId = p.ChampionId, ChampionKey = champ.Key, Role = role,
                            Spell1Id = s1, Spell2Id = s2,
                        };
                        batchSpellAggregate[spellKey] = spellStat;
                    }
                    spellStat.Picks++;
                    if (p.Win) spellStat.Wins++;
                }
            }

            // --- Matchup extraction: pair each participant with their lane opponent ---
            var byTeamAndRole = match.Participants
                .Where(p => !string.IsNullOrEmpty(p.TeamPosition))
                .GroupBy(p => (p.TeamId, Lane: NormalizeLane(p.TeamPosition)))
                .ToDictionary(g => g.Key, g => g.First());

            foreach (var p in match.Participants)
            {
                if (string.IsNullOrEmpty(p.TeamPosition)) continue;
                if (!champInfo.TryGetValue(p.ChampionId, out var champ)) continue;
                var role = NormalizeLane(p.TeamPosition);
                var opponentTeam = p.TeamId == 100 ? 200 : 100;
                if (byTeamAndRole.TryGetValue((opponentTeam, role), out var opponent)
                    && champInfo.TryGetValue(opponent.ChampionId, out var opponentChamp))
                {
                    var matchupKey = (p.ChampionId, role, opponent.ChampionId);
                    if (!batchMatchupAggregate.TryGetValue(matchupKey, out var matchupStat))
                    {
                        matchupStat = new AggregatedMatchupStat
                        {
                            ChampionId = p.ChampionId, ChampionKey = champ.Key, Role = role,
                            OpponentChampionId = opponent.ChampionId, OpponentChampionKey = opponentChamp.Key,
                        };
                        batchMatchupAggregate[matchupKey] = matchupStat;
                    }
                    matchupStat.Picks++;
                    if (p.Win) matchupStat.Wins++;
                }
            }

            // --- Ban tracking ---
            batchTotalMatches++;
            foreach (var bannedId in match.BannedChampionIds)
            {
                if (champInfo.TryGetValue(bannedId, out var bannedChamp))
                {
                    if (!batchBanAggregate.TryGetValue(bannedId, out var banEntry))
                        banEntry = (bannedChamp.Key, 0);
                    batchBanAggregate[bannedId] = (banEntry.championKey, banEntry.bans + 1);
                }
            }

            // --- Timeline extraction: build order + skill order + starting items ---
            try
            {
                var timeline = await _riot.GetMatchTimelineExtractAsync(matchId, crawlRegion, ct);
                await ThrottleAsync(ct);

                if (timeline is not null)
                {
                    for (var pidx = 0; pidx < match.Participants.Count; pidx++)
                    {
                        var p = match.Participants[pidx];
                        if (string.IsNullOrEmpty(p.TeamPosition)) continue;
                        if (!champInfo.TryGetValue(p.ChampionId, out var champ)) continue;
                        var role = NormalizeLane(p.TeamPosition);
                        var riotPid = pidx + 1;

                        // --- Build order: first 3 completed non-boots items by purchase time ---
                        if (timeline.ItemPurchases.TryGetValue(riotPid, out var purchases))
                        {
                            var orderedPurchases = purchases.OrderBy(x => x.timestamp);

                            // Starting items: purchased in first 90 seconds (90000 ms)
                            var startingItems = orderedPurchases
                                .Where(x => x.timestamp <= 90000 && x.itemId != 0)
                                .Select(x => x.itemId)
                                .OrderBy(id => id)
                                .ToArray();

                            if (startingItems.Length > 0)
                            {
                                var startKey = string.Join(",", startingItems);
                                var siKey = (p.ChampionId, role, startKey);
                                if (!batchStartingItemAggregate.TryGetValue(siKey, out var siStat))
                                {
                                    siStat = new AggregatedStartingItemStat
                                    {
                                        ChampionId = p.ChampionId, ChampionKey = champ.Key,
                                        Role = role, ItemIds = startKey,
                                    };
                                    batchStartingItemAggregate[siKey] = siStat;
                                }
                                siStat.Picks++;
                                if (p.Win) siStat.Wins++;
                            }

                            // Core build: first 3 completed items (non-boots, in item database)
                            var coreItems = orderedPurchases
                                .Select(x => ItemIdAliases.GetValueOrDefault(x.itemId, x.itemId))
                                .Where(id => !BootsItemIds.Contains(id) && itemInfo.ContainsKey(id))
                                .Distinct()
                                .Take(3)
                                .ToArray();

                            if (coreItems.Length == 3)
                            {
                                var boKey = (p.ChampionId, role, coreItems[0], coreItems[1], coreItems[2]);
                                if (!batchBuildOrderAggregate.TryGetValue(boKey, out var boStat))
                                {
                                    boStat = new AggregatedBuildOrderStat
                                    {
                                        ChampionId = p.ChampionId, ChampionKey = champ.Key, Role = role,
                                        Item1Id = coreItems[0], Item2Id = coreItems[1], Item3Id = coreItems[2],
                                    };
                                    batchBuildOrderAggregate[boKey] = boStat;
                                }
                                boStat.Picks++;
                                if (p.Win) boStat.Wins++;
                            }
                        }

                        // --- Skill order: first 3 skill level-ups ---
                        if (timeline.SkillLevelUps.TryGetValue(riotPid, out var skills) && skills.Count >= 3)
                        {
                            var seq = string.Join(",", skills.Take(3).Select(SkillSlotToLetter));
                            var soKey = (p.ChampionId, role, seq);
                            if (!batchSkillOrderAggregate.TryGetValue(soKey, out var soStat))
                            {
                                soStat = new AggregatedSkillOrderStat
                                {
                                    ChampionId = p.ChampionId, ChampionKey = champ.Key, Role = role,
                                    EarlySkillSequence = seq,
                                };
                                batchSkillOrderAggregate[soKey] = soStat;
                            }
                            soStat.Picks++;
                            if (p.Win) soStat.Wins++;
                        }
                    }
                }
            }
            catch
            {
                // Timeline fetch failed — non-critical
            }

            // Store per-participant data for Pro Builds page
            var now = DateTime.UtcNow;
            foreach (var p in match.Participants)
            {
                if (string.IsNullOrEmpty(p.TeamPosition)) continue;
                if (!champInfo.TryGetValue(p.ChampionId, out var pChamp)) continue;
                var itemCsv = string.Join(",", p.Items.Where(id => id != 0));

                // Match against pro player list by Riot ID game name
                string? proName = null;
                string? proTeam = null;
                if (!string.IsNullOrEmpty(p.RiotIdGameName) && ProPlayerLookup.TryGetValue(p.RiotIdGameName, out var proInfo))
                {
                    proName = proInfo.name;
                    proTeam = proInfo.team;
                }

                batchParticipants.Add(new CrawledMatchParticipantEntity
                {
                    Patch = patch,
                    MatchId = matchId,
                    ChampionId = p.ChampionId,
                    ChampionKey = pChamp.Key,
                    Role = NormalizeLane(p.TeamPosition),
                    TeamId = p.TeamId,
                    Items = itemCsv,
                    Kills = p.Kills,
                    Deaths = p.Deaths,
                    Assists = p.Assists,
                    Win = p.Win,
                    Spell1Id = p.Summoner1Id,
                    Spell2Id = p.Summoner2Id,
                    PlayerName = proName,
                    PlayerTeam = proTeam,
                    CrawledAt = now,
                });
            }

            batchMatchIds.Add(matchId);
            batchAggregatedCount++;
            totalProcessed++;

            if (batchMatchIds.Count >= PersistBatchSize)
            {
                await FlushBatchAsync(batchAggregate, batchRuneAggregate, batchSpellAggregate, batchMatchupAggregate, batchBuildOrderAggregate, batchSkillOrderAggregate, batchStartingItemAggregate, batchBanAggregate, batchTotalMatches, batchMatchIds, batchParticipants, batchAggregatedCount, patch, ct);
                totalFlushed += batchAggregatedCount;
                _logger.LogInformation(
                    "Flushed batch: {BatchSize} match IDs ({Aggregated} aggregated) → DB total {Flushed}/{All} (in-memory rows: {Rows}, errors: {Errors})",
                    batchMatchIds.Count, batchAggregatedCount, totalFlushed, newMatchIds.Count, batchAggregate.Count, errors);
                batchAggregate.Clear();
                batchRuneAggregate.Clear();
                batchSpellAggregate.Clear();
                batchMatchupAggregate.Clear();
                batchBuildOrderAggregate.Clear();
                batchSkillOrderAggregate.Clear();
                batchStartingItemAggregate.Clear();
                batchBanAggregate.Clear();
                batchTotalMatches = 0;
                batchMatchIds.Clear();
                batchParticipants.Clear();
                batchAggregatedCount = 0;
            }
        }

        // Final flush for the tail of matches that didn't fill a full batch.
        if (batchMatchIds.Count > 0)
        {
            await FlushBatchAsync(batchAggregate, batchRuneAggregate, batchSpellAggregate, batchMatchupAggregate, batchBuildOrderAggregate, batchSkillOrderAggregate, batchStartingItemAggregate, batchBanAggregate, batchTotalMatches, batchMatchIds, batchParticipants, batchAggregatedCount, patch, ct);
            totalFlushed += batchAggregatedCount;
            _logger.LogInformation(
                "Flushed final batch: {BatchSize} match IDs ({Aggregated} aggregated) → DB total {Flushed}/{All}",
                batchMatchIds.Count, batchAggregatedCount, totalFlushed, newMatchIds.Count);
        }

        var elapsed = DateTime.UtcNow - started;
        _logger.LogInformation(
            "Crawl end: processed={Processed}, flushed={Flushed}, wrongPatch={WrongPatch}, wrongQueue={WrongQueue}, errors={Errors}, elapsed={Elapsed}",
            totalProcessed, totalFlushed, skippedWrongPatch, skippedWrongQueue, errors, elapsed);
    }

    /// <summary>
    /// Persists one batch of aggregated stats + tracked match IDs + metadata bump in a
    /// single transaction. UPSERT semantics on <see cref="ItemStatEntity"/> so picks and
    /// wins accumulate across batches and across crawl cycles.
    ///
    /// <paramref name="batchMatchIds"/> contains every match ID from the batch (including
    /// wrong-patch skipped ones) so ProcessedMatches tracks them all and we don't refetch.
    /// <paramref name="aggregatedCount"/> is the subset that actually contributed to
    /// ItemStats — only this count bumps CrawlMetadata.MatchesProcessed so the counter
    /// reflects real aggregate size, not "matches fetched".
    /// </summary>
    private async Task FlushBatchAsync(
        Dictionary<(int championId, string role, int itemId), AggregatedStat> batch,
        Dictionary<(int championId, string role, int ps, int ss, int p0, int p1, int p2, int p3, int p4, int p5, int so, int sf, int sd), AggregatedRuneStat> runeBatch,
        Dictionary<(int championId, string role, int spell1, int spell2), AggregatedSpellStat> spellBatch,
        Dictionary<(int championId, string role, int opponentId), AggregatedMatchupStat> matchupBatch,
        Dictionary<(int championId, string role, int item1, int item2, int item3), AggregatedBuildOrderStat> buildOrderBatch,
        Dictionary<(int championId, string role, string earlySequence), AggregatedSkillOrderStat> skillOrderBatch,
        Dictionary<(int championId, string role, string itemIds), AggregatedStartingItemStat> startingItemBatch,
        Dictionary<int, (string championKey, int bans)> banBatch,
        int totalMatchesInBatch,
        List<string> batchMatchIds,
        List<CrawledMatchParticipantEntity> participantsBatch,
        int aggregatedCount,
        string patch,
        CancellationToken ct)
    {
        if (batchMatchIds.Count == 0) return;

        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var champIds = batch.Values.Select(v => v.ChampionId)
            .Union(runeBatch.Values.Select(v => v.ChampionId))
            .Union(spellBatch.Values.Select(v => v.ChampionId))
            .Union(matchupBatch.Values.Select(v => v.ChampionId))
            .Union(buildOrderBatch.Values.Select(v => v.ChampionId))
            .Union(skillOrderBatch.Values.Select(v => v.ChampionId))
            .Union(startingItemBatch.Values.Select(v => v.ChampionId))
            .Distinct().ToList();

        var now = DateTime.UtcNow;

        // --- Item stats UPSERT (existing logic) ---
        var existingItems = await db.ItemStats
            .Where(s => s.Patch == patch && champIds.Contains(s.ChampionId))
            .ToListAsync(ct);
        var itemByKey = existingItems.ToDictionary(s => (s.ChampionId, s.Role, s.ItemId));

        foreach (var newStat in batch.Values)
        {
            var key = (newStat.ChampionId, newStat.Role, newStat.ItemId);
            if (itemByKey.TryGetValue(key, out var existing))
            {
                existing.Picks += newStat.Picks;
                existing.Wins += newStat.Wins;
                existing.UpdatedAt = now;
            }
            else
            {
                var entity = new ItemStatEntity
                {
                    Patch = patch,
                    ChampionId = newStat.ChampionId,
                    ChampionKey = newStat.ChampionKey,
                    Role = newStat.Role,
                    ItemId = newStat.ItemId,
                    ItemName = newStat.ItemName,
                    Picks = newStat.Picks,
                    Wins = newStat.Wins,
                    UpdatedAt = now,
                };
                db.ItemStats.Add(entity);
                itemByKey[key] = entity;
            }
        }

        // --- Rune stats UPSERT ---
        var existingRunes = await db.RuneStats
            .Where(s => s.Patch == patch && champIds.Contains(s.ChampionId))
            .ToListAsync(ct);
        var runeByKey = existingRunes.ToDictionary(s => (s.ChampionId, s.Role,
            s.PrimaryStyle, s.SubStyle, s.Perk0, s.Perk1, s.Perk2, s.Perk3, s.Perk4, s.Perk5,
            s.StatOffense, s.StatFlex, s.StatDefense));

        foreach (var rs in runeBatch.Values)
        {
            var key = (rs.ChampionId, rs.Role, rs.PrimaryStyle, rs.SubStyle,
                rs.Perk0, rs.Perk1, rs.Perk2, rs.Perk3, rs.Perk4, rs.Perk5,
                rs.StatOffense, rs.StatFlex, rs.StatDefense);
            if (runeByKey.TryGetValue(key, out var existing))
            {
                existing.Picks += rs.Picks;
                existing.Wins += rs.Wins;
                existing.UpdatedAt = now;
            }
            else
            {
                var entity = new RuneStatEntity
                {
                    Patch = patch, ChampionId = rs.ChampionId, ChampionKey = rs.ChampionKey,
                    Role = rs.Role, PrimaryStyle = rs.PrimaryStyle, SubStyle = rs.SubStyle,
                    Perk0 = rs.Perk0, Perk1 = rs.Perk1, Perk2 = rs.Perk2,
                    Perk3 = rs.Perk3, Perk4 = rs.Perk4, Perk5 = rs.Perk5,
                    StatOffense = rs.StatOffense, StatFlex = rs.StatFlex, StatDefense = rs.StatDefense,
                    Picks = rs.Picks, Wins = rs.Wins, UpdatedAt = now,
                };
                db.RuneStats.Add(entity);
                runeByKey[key] = entity;
            }
        }

        // --- Spell stats UPSERT ---
        var existingSpells = await db.SpellStats
            .Where(s => s.Patch == patch && champIds.Contains(s.ChampionId))
            .ToListAsync(ct);
        var spellByKey = existingSpells.ToDictionary(s => (s.ChampionId, s.Role, s.Spell1Id, s.Spell2Id));

        foreach (var ss in spellBatch.Values)
        {
            var key = (ss.ChampionId, ss.Role, ss.Spell1Id, ss.Spell2Id);
            if (spellByKey.TryGetValue(key, out var existing))
            {
                existing.Picks += ss.Picks;
                existing.Wins += ss.Wins;
                existing.UpdatedAt = now;
            }
            else
            {
                var entity = new SpellStatEntity
                {
                    Patch = patch, ChampionId = ss.ChampionId, ChampionKey = ss.ChampionKey,
                    Role = ss.Role, Spell1Id = ss.Spell1Id, Spell2Id = ss.Spell2Id,
                    Picks = ss.Picks, Wins = ss.Wins, UpdatedAt = now,
                };
                db.SpellStats.Add(entity);
                spellByKey[key] = entity;
            }
        }

        // --- Matchup stats UPSERT ---
        var existingMatchups = await db.MatchupStats
            .Where(s => s.Patch == patch && champIds.Contains(s.ChampionId))
            .ToListAsync(ct);
        var matchupByKey = existingMatchups.ToDictionary(s => (s.ChampionId, s.Role, s.OpponentChampionId));

        foreach (var ms in matchupBatch.Values)
        {
            var key = (ms.ChampionId, ms.Role, ms.OpponentChampionId);
            if (matchupByKey.TryGetValue(key, out var existing))
            {
                existing.Picks += ms.Picks;
                existing.Wins += ms.Wins;
                existing.UpdatedAt = now;
            }
            else
            {
                var entity = new MatchupStatEntity
                {
                    Patch = patch, ChampionId = ms.ChampionId, ChampionKey = ms.ChampionKey,
                    Role = ms.Role, OpponentChampionId = ms.OpponentChampionId,
                    OpponentChampionKey = ms.OpponentChampionKey,
                    Picks = ms.Picks, Wins = ms.Wins, UpdatedAt = now,
                };
                db.MatchupStats.Add(entity);
                matchupByKey[key] = entity;
            }
        }

        // --- Build order UPSERT ---
        var existingBo = await db.BuildOrderStats
            .Where(s => s.Patch == patch && champIds.Contains(s.ChampionId))
            .ToListAsync(ct);
        var boByKey = existingBo.ToDictionary(s => (s.ChampionId, s.Role, s.Item1Id, s.Item2Id, s.Item3Id));

        foreach (var bs in buildOrderBatch.Values)
        {
            var key = (bs.ChampionId, bs.Role, bs.Item1Id, bs.Item2Id, bs.Item3Id);
            if (boByKey.TryGetValue(key, out var existing))
            {
                existing.Picks += bs.Picks;
                existing.Wins += bs.Wins;
                existing.UpdatedAt = now;
            }
            else
            {
                var entity = new BuildOrderStatEntity
                {
                    Patch = patch, ChampionId = bs.ChampionId, ChampionKey = bs.ChampionKey,
                    Role = bs.Role, Item1Id = bs.Item1Id, Item2Id = bs.Item2Id, Item3Id = bs.Item3Id,
                    Picks = bs.Picks, Wins = bs.Wins, UpdatedAt = now,
                };
                db.BuildOrderStats.Add(entity);
                boByKey[key] = entity;
            }
        }

        // --- Skill order UPSERT ---
        var existingSo = await db.SkillOrderStats
            .Where(s => s.Patch == patch && champIds.Contains(s.ChampionId))
            .ToListAsync(ct);
        var soByKey = existingSo.ToDictionary(s => (s.ChampionId, s.Role, s.EarlySkillSequence));

        foreach (var ss in skillOrderBatch.Values)
        {
            var key = (ss.ChampionId, ss.Role, ss.EarlySkillSequence);
            if (soByKey.TryGetValue(key, out var existing))
            {
                existing.Picks += ss.Picks;
                existing.Wins += ss.Wins;
                existing.UpdatedAt = now;
            }
            else
            {
                var entity = new SkillOrderStatEntity
                {
                    Patch = patch, ChampionId = ss.ChampionId, ChampionKey = ss.ChampionKey,
                    Role = ss.Role, EarlySkillSequence = ss.EarlySkillSequence,
                    Picks = ss.Picks, Wins = ss.Wins, UpdatedAt = now,
                };
                db.SkillOrderStats.Add(entity);
                soByKey[key] = entity;
            }
        }

        // --- Starting items UPSERT ---
        var existingSi = await db.StartingItemStats
            .Where(s => s.Patch == patch && champIds.Contains(s.ChampionId))
            .ToListAsync(ct);
        var siByKey = existingSi.ToDictionary(s => (s.ChampionId, s.Role, s.ItemIds));

        foreach (var si in startingItemBatch.Values)
        {
            var key = (si.ChampionId, si.Role, si.ItemIds);
            if (siByKey.TryGetValue(key, out var existing))
            {
                existing.Picks += si.Picks;
                existing.Wins += si.Wins;
                existing.UpdatedAt = now;
            }
            else
            {
                var entity = new StartingItemStatEntity
                {
                    Patch = patch, ChampionId = si.ChampionId, ChampionKey = si.ChampionKey,
                    Role = si.Role, ItemIds = si.ItemIds,
                    Picks = si.Picks, Wins = si.Wins, UpdatedAt = now,
                };
                db.StartingItemStats.Add(entity);
                siByKey[key] = entity;
            }
        }

        // --- Ban stats UPSERT ---
        var existingBans = await db.BanStats
            .Where(s => s.Patch == patch)
            .ToListAsync(ct);
        var banByKey = existingBans.ToDictionary(s => s.ChampionId);

        foreach (var (champId, (champKey, bans)) in banBatch)
        {
            if (banByKey.TryGetValue(champId, out var existing))
            {
                existing.Bans += bans;
                existing.TotalMatches += totalMatchesInBatch;
                existing.UpdatedAt = now;
            }
            else
            {
                var entity = new BanStatEntity
                {
                    Patch = patch, ChampionId = champId, ChampionKey = champKey,
                    Bans = bans, TotalMatches = totalMatchesInBatch, UpdatedAt = now,
                };
                db.BanStats.Add(entity);
                banByKey[champId] = entity;
            }
        }

        // Track match IDs so future crawls don't re-count them.
        foreach (var matchId in batchMatchIds)
        {
            db.ProcessedMatches.Add(new ProcessedMatchEntity
            {
                MatchId = matchId,
                Patch = patch,
                ProcessedAt = now,
            });
        }

        // Bump metadata.
        // --- Crawled match participants (for Pro Builds page) ---
        if (participantsBatch.Count > 0)
        {
            db.CrawledMatchParticipants.AddRange(participantsBatch);
        }

        var dbMeta = await db.CrawlMetadata.FindAsync(new object[] { patch }, ct);
        if (dbMeta is null)
        {
            db.CrawlMetadata.Add(new CrawlMetadataEntity
            {
                Patch = patch,
                UpdatedAt = now,
                MatchesProcessed = aggregatedCount,
                DataVersion = CurrentDataVersion,
            });
        }
        else
        {
            dbMeta.UpdatedAt = now;
            dbMeta.MatchesProcessed += aggregatedCount;
            dbMeta.DataVersion = CurrentDataVersion;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Pulls PUUIDs from every enabled ladder tier and stratified-samples them down to
    /// <see cref="BuildStatsOptions.MaxPlayers"/>. Stratified sampling means each tier
    /// contributes an equal share of the budget — so adding Grandmaster + Master expands
    /// champion diversity without diluting Challenger's meta data.
    /// </summary>
    private async Task<string[]> FetchPlayerPoolAsync(string crawlRegion, CancellationToken ct)
    {
        var tiers = new List<(string name, Func<Task<string[]>> fetch)>();
        if (_options.IncludeChallenger)
            tiers.Add(("Challenger", () => _riot.GetChallengerPuuidsAsync(crawlRegion, ct)));
        if (_options.IncludeGrandmaster)
            tiers.Add(("Grandmaster", () => _riot.GetGrandmasterPuuidsAsync(crawlRegion, ct)));
        if (_options.IncludeMaster)
            tiers.Add(("Master", () => _riot.GetMasterPuuidsAsync(crawlRegion, ct)));

        if (tiers.Count == 0)
        {
            _logger.LogWarning("All ladder tiers disabled in config — no players to crawl");
            return Array.Empty<string>();
        }

        var perTierBudget = Math.Max(1, _options.MaxPlayers / tiers.Count);
        var pool = new List<string>();
        var seen = new HashSet<string>();

        foreach (var (name, fetch) in tiers)
        {
            string[] tierPuuids;
            try
            {
                tierPuuids = await fetch();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch {Tier} ladder — skipping", name);
                await ThrottleAsync(ct);
                continue;
            }

            var added = 0;
            foreach (var puuid in tierPuuids)
            {
                if (added >= perTierBudget) break;
                if (seen.Add(puuid))
                {
                    pool.Add(puuid);
                    added++;
                }
            }
            _logger.LogInformation(
                "{Tier}: {Raw} total, took {Added} after stratified cap",
                name, tierPuuids.Length, added);

            await ThrottleAsync(ct);
        }

        // Top up to MaxPlayers if a tier didn't have enough players to fill its budget.
        if (pool.Count < _options.MaxPlayers)
        {
            foreach (var (name, fetch) in tiers)
            {
                if (pool.Count >= _options.MaxPlayers) break;
                try
                {
                    var tierPuuids = await fetch(); // cached at Riot layer if called again recently
                    foreach (var puuid in tierPuuids)
                    {
                        if (pool.Count >= _options.MaxPlayers) break;
                        if (seen.Add(puuid)) pool.Add(puuid);
                    }
                }
                catch { /* already logged above */ }
            }
        }

        return pool.Take(_options.MaxPlayers).ToArray();
    }

    // Helper — read the latest metadata row for this patch WITHOUT modifying state.
    // Used to decide backfill vs incremental mode at the start of each crawl.
    private async Task<CrawlMetadataEntity?> GetExistingMetadataAsync(string patch, CancellationToken ct)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return await db.CrawlMetadata
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Patch == patch, ct);
    }

    // True when we have aggregates for the patch but no dedup tracking — the telltale
    // sign that data came from an older crawler version that used replace-all semantics.
    private async Task<bool> IsProcessedMatchesEmptyForPatchAsync(string patch, CancellationToken ct)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        return !await db.ProcessedMatches
            .AsNoTracking()
            .AnyAsync(m => m.Patch == patch, ct);
    }

    // Drops all data for the specified patch so a fresh backfill can write clean rows.
    // ONLY affects the current patch — rows from other patches (historical data) are untouched.
    private async Task ClearCurrentPatchAsync(string patch, CancellationToken ct)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        await db.ItemStats.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.RuneStats.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.SpellStats.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.MatchupStats.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.BuildOrderStats.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.SkillOrderStats.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.StartingItemStats.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.BanStats.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.CrawledMatchParticipants.Where(s => s.Patch == patch).ExecuteDeleteAsync(ct);
        await db.CrawlMetadata.Where(m => m.Patch == patch).ExecuteDeleteAsync(ct);
    }

    // Helper — only used when nothing new was processed but we still want to advance
    // the UpdatedAt so the next incremental starts from a slightly later timestamp.
    private async Task BumpMetadataAsync(string patch, int addedMatches, CancellationToken ct)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        var meta = await db.CrawlMetadata.FindAsync(new object[] { patch }, ct);
        if (meta is null)
        {
            meta = new CrawlMetadataEntity
            {
                Patch = patch,
                UpdatedAt = DateTime.UtcNow,
                MatchesProcessed = addedMatches,
                DataVersion = CurrentDataVersion,
            };
            db.CrawlMetadata.Add(meta);
        }
        else
        {
            meta.UpdatedAt = DateTime.UtcNow;
            meta.MatchesProcessed += addedMatches;
            meta.DataVersion = CurrentDataVersion;
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task ThrottleAsync(CancellationToken ct)
    {
        if (_options.RequestDelayMs <= 0) return;
        try
        {
            await Task.Delay(_options.RequestDelayMs, ct);
        }
        catch (OperationCanceledException) { }
    }

    private static string ToMajorMinor(string version)
    {
        if (string.IsNullOrEmpty(version)) return string.Empty;
        var parts = version.Split('.');
        return parts.Length >= 2 ? $"{parts[0]}.{parts[1]}" : version;
    }

    private static string NormalizeLane(string riotLane) => riotLane.ToUpperInvariant() switch
    {
        "TOP" => LaneAssigner.Top,
        "JUNGLE" => LaneAssigner.Jungle,
        "MIDDLE" => LaneAssigner.Middle,
        "BOTTOM" => LaneAssigner.Bottom,
        "UTILITY" => LaneAssigner.Utility,
        _ => LaneAssigner.Middle,
    };

    private class AggregatedStat
    {
        public int ChampionId { get; set; }
        public string ChampionKey { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int ItemId { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public int Picks { get; set; }
        public int Wins { get; set; }
    }

    private class AggregatedRuneStat
    {
        public int ChampionId { get; set; }
        public string ChampionKey { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int PrimaryStyle { get; set; }
        public int SubStyle { get; set; }
        public int Perk0 { get; set; }
        public int Perk1 { get; set; }
        public int Perk2 { get; set; }
        public int Perk3 { get; set; }
        public int Perk4 { get; set; }
        public int Perk5 { get; set; }
        public int StatOffense { get; set; }
        public int StatFlex { get; set; }
        public int StatDefense { get; set; }
        public int Picks { get; set; }
        public int Wins { get; set; }
    }

    private class AggregatedSpellStat
    {
        public int ChampionId { get; set; }
        public string ChampionKey { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int Spell1Id { get; set; }
        public int Spell2Id { get; set; }
        public int Picks { get; set; }
        public int Wins { get; set; }
    }

    private class AggregatedMatchupStat
    {
        public int ChampionId { get; set; }
        public string ChampionKey { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int OpponentChampionId { get; set; }
        public string OpponentChampionKey { get; set; } = string.Empty;
        public int Picks { get; set; }
        public int Wins { get; set; }
    }

    private class AggregatedBuildOrderStat
    {
        public int ChampionId { get; set; }
        public string ChampionKey { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int Item1Id { get; set; }
        public int Item2Id { get; set; }
        public int Item3Id { get; set; }
        public int Picks { get; set; }
        public int Wins { get; set; }
    }

    private class AggregatedSkillOrderStat
    {
        public int ChampionId { get; set; }
        public string ChampionKey { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string EarlySkillSequence { get; set; } = string.Empty;
        public int Picks { get; set; }
        public int Wins { get; set; }
    }

    private class AggregatedStartingItemStat
    {
        public int ChampionId { get; set; }
        public string ChampionKey { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string ItemIds { get; set; } = string.Empty;
        public int Picks { get; set; }
        public int Wins { get; set; }
    }
}
