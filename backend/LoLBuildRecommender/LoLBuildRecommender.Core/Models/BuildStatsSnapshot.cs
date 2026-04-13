namespace LoLBuildRecommender.Core.Models;

/// <summary>
/// One aggregated data point for the recommender: "out of N recent high-elo ranked matches
/// on patch X, champion Y playing role Z built item W in their final inventory K times,
/// winning L of those games". Produced hourly by the Riot Match API crawler, stored in
/// SQLite tagged with the patch so stale data from previous patches is never served.
/// </summary>
public class ItemStat
{
    public int ItemId { get; set; }
    public string ItemName { get; set; } = string.Empty;

    /// <summary>Number of observed matches where this item was in the final build.</summary>
    public int Picks { get; set; }

    /// <summary>Of those, how many the champion won.</summary>
    public int Wins { get; set; }

    /// <summary>0.0 for unpicked items.</summary>
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// Aggregated rune page: a specific combination of primary tree, secondary tree,
/// 6 perks and 3 stat shards, with pick/win counts from high-elo matches.
/// </summary>
public class RunePage
{
    public int PrimaryStyle { get; set; }
    public int SubStyle { get; set; }
    public int[] Perks { get; set; } = [];
    public int StatOffense { get; set; }
    public int StatFlex { get; set; }
    public int StatDefense { get; set; }
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// Aggregated summoner spell pair (normalized: Spell1Id is always the smaller ID).
/// </summary>
public class SpellSet
{
    public int Spell1Id { get; set; }
    public int Spell2Id { get; set; }
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// Matchup data: win rate of champion X in role Y against opponent champion Z.
/// </summary>
public class MatchupStat
{
    public int OpponentChampionId { get; set; }
    public string OpponentChampionKey { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// Meta shift entry: champion win rate change between current and previous patch.
/// </summary>
public class MetaShiftEntry
{
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int CurrentPicks { get; set; }
    public double CurrentWinRate { get; set; }
    public int PreviousPicks { get; set; }
    public double PreviousWinRate { get; set; }
    public double WinRateDelta => CurrentWinRate - PreviousWinRate;
}

/// <summary>
/// 3-item core build path with pick/win rates.
/// </summary>
public class BuildOrderEntry
{
    public int Item1Id { get; set; }
    public int Item2Id { get; set; }
    public int Item3Id { get; set; }
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// Role-specific early skill order (levels 1-3) with pick/win rates.
/// </summary>
public class SkillOrderEntry
{
    public string EarlySkillSequence { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// Starting items purchased in first 90 seconds.
/// </summary>
public class StartingItemEntry
{
    /// <summary>Comma-separated item IDs, sorted ascending.</summary>
    public string ItemIds { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// Per-individual-rune statistics: aggregated across all rune pages, shows how often
/// a specific perk was picked and its win rate. Used for the detailed rune table.
/// </summary>
public class IndividualRuneStat
{
    public int PerkId { get; set; }
    /// <summary>Slot index 0-5 (0=keystone, 1-3=primary, 4-5=secondary).</summary>
    public int Slot { get; set; }
    /// <summary>Rune tree ID (8000-8400) this perk belongs to.</summary>
    public int TreeId { get; set; }
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
    /// <summary>Pick rate relative to total games for this champion/lane.</summary>
    public double PickRate { get; set; }
}

/// <summary>
/// Win rate data for a single champion+role on a single patch. Used to render
/// patch-to-patch trend charts on the frontend.
/// </summary>
public class PatchTrend
{
    public string Patch { get; set; } = string.Empty;
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// A contextual strategy tip generated by comparing two champions' attributes.
/// Tips are returned as translation keys so the frontend can render them in
/// the user's language with placeholder substitution.
/// </summary>
public class CounterTip
{
    public int ChampionId { get; set; }
    public int OpponentChampionId { get; set; }

    /// <summary>Translation key rendered by the frontend t pipe, e.g. "counterTip.antiHeal".</summary>
    public string TipKey { get; set; } = string.Empty;

    /// <summary>Optional placeholder args for the translation template (e.g. {percent}).</summary>
    public Dictionary<string, object>? TipArgs { get; set; }

    /// <summary>Category: "laning", "teamfight", or "itemization".</summary>
    public string Category { get; set; } = string.Empty;
}

/// <summary>
/// Tier list entry: aggregated champion performance in a specific role on the current patch.
/// Picks = total games observed, Wins = games won. Pick rate is computed client-side
/// from total games in the patch.
/// </summary>
public class TierListEntry
{
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
    public int Bans { get; set; }
    public int TotalMatches { get; set; }
    public double BanRate => TotalMatches == 0 ? 0 : (double)Bans / TotalMatches;
}

/// <summary>
/// Win rate bucketed by game duration. Since the crawler does not currently store per-match
/// duration, these are synthetic estimates derived from total pick counts and champion
/// archetype (early-game vs late-game tags). Will be replaced with real data once the
/// crawler tracks match duration.
/// </summary>
public class GameLengthStat
{
    /// <summary>Duration bucket label: "0-20", "20-25", "25-30", "30-35", "35-40", "40+".</summary>
    public string DurationBucket { get; set; } = string.Empty;
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// Rank/tier filter for build stats queries. For now all crawled data comes from
/// Challenger/GM/Master, so the tier parameter is accepted but not yet filtered.
/// This prepares the API contract for when the crawler is extended to cover more tiers.
/// </summary>
public class RankFilter
{
    public static readonly string[] ValidTiers = ["CHALLENGER", "GRANDMASTER", "MASTER", "DIAMOND", "EMERALD", "PLATINUM", "GOLD", "ALL"];

    public static string Normalize(string? tier)
    {
        if (string.IsNullOrWhiteSpace(tier)) return "ALL";
        var upper = tier.Trim().ToUpperInvariant();
        return ValidTiers.Contains(upper) ? upper : "ALL";
    }
}

/// <summary>
/// Duo synergy entry: how well two champions perform together in a pair of lanes.
/// Generated from matchup statistics by pairing champions that commonly co-occur.
/// </summary>
public class DuoSynergy
{
    public int Champion1Id { get; set; }
    public string Champion1Key { get; set; } = string.Empty;
    public int Champion2Id { get; set; }
    public string Champion2Key { get; set; } = string.Empty;
    public string Lane1 { get; set; } = string.Empty;
    public string Lane2 { get; set; } = string.Empty;
    public int Picks { get; set; }
    public int Wins { get; set; }
    public double WinRate => Picks == 0 ? 0 : (double)Wins / Picks;
}

/// <summary>
/// A single high-elo build entry formatted as a "pro build". Until a real pro-player
/// database is available, these are populated from Challenger/Grandmaster matches.
/// </summary>
public class ProBuild
{
    public string PlayerName { get; set; } = string.Empty;
    public string Team { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int[] Items { get; set; } = [];
    public int Kills { get; set; }
    public int Deaths { get; set; }
    public int Assists { get; set; }
    public bool Win { get; set; }
    public string MatchId { get; set; } = string.Empty;
    public List<ProBuildParticipant> Participants { get; set; } = [];
}

public class ProBuildParticipant
{
    public int ChampionId { get; set; }
    public string ChampionKey { get; set; } = string.Empty;
    public string ChampionImage { get; set; } = string.Empty;
    public string TeamPosition { get; set; } = string.Empty;
    public int TeamId { get; set; }
    public int Kills { get; set; }
    public int Deaths { get; set; }
    public int Assists { get; set; }
    public int[] Items { get; set; } = [];
    public bool Win { get; set; }
    public string SummonerName { get; set; } = string.Empty;
}
