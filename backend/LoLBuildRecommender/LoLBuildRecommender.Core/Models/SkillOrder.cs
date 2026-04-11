namespace LoLBuildRecommender.Core.Models;

/// <summary>
/// Per-champion ability leveling recommendation. Derived from Meraki ability leveling
/// data with a small override table for edge cases where raw damage scaling alone doesn't
/// predict the optimal order (tanks, utility champs, Malzahar-type DoT outliers).
///
/// <para>The <see cref="Priority"/> list is the ordered max priority of basic abilities
/// (Q/W/E only — R is always levelled at 6/11/16). <see cref="FirstSkill"/> is the
/// ability the player should take on their first point (usually the max-first ability,
/// but can differ, e.g., Ezreal usually starts Q regardless).</para>
/// </summary>
public record SkillOrder
{
    /// <summary>The slot the player should put their first point into. One of "Q", "W", "E".</summary>
    public string FirstSkill { get; init; } = "Q";

    /// <summary>
    /// Max priority for basic abilities — leftmost is maxed first. Always 3 entries,
    /// e.g. ["Q", "E", "W"]. R is implied (always levelled when available).
    /// </summary>
    public string[] Priority { get; init; } = ["Q", "E", "W"];

    /// <summary>
    /// Short Polish explanation of where the order comes from: "Meraki damage scaling",
    /// "Overrride (meta)", "Default fallback". Shown in the UI as a subtitle so the user
    /// knows this is heuristic-derived and not a match-history ground truth.
    /// </summary>
    public string Source { get; init; } = string.Empty;

    /// <summary>
    /// Full display names for Q/W/E so the frontend can render them without a separate
    /// champion lookup (e.g., "Mystic Shot" for Ezreal Q).
    /// </summary>
    public string QName { get; init; } = string.Empty;
    public string WName { get; init; } = string.Empty;
    public string EName { get; init; } = string.Empty;
    public string RName { get; init; } = string.Empty;

    /// <summary>
    /// 18-entry per-level sequence — exactly which ability to level up at each champion
    /// level from 1 to 18. Each entry is one of "Q", "W", "E", "R". Generated from
    /// <see cref="FirstSkill"/> + <see cref="Priority"/> by the standard LoL rule:
    /// take all three basics by level 3, R at 6/11/16, then follow priority order for
    /// maxing (priority[0] reaches rank 5 first, then priority[1], then priority[2]).
    /// </summary>
    public string[] Levels { get; init; } = [];
}
