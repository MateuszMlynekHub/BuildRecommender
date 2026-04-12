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
