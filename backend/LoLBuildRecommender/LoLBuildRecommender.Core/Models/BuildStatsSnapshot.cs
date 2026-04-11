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
