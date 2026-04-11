using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Services;

/// <summary>
/// Infers lane assignments for a team's 5 participants from spectator data.
/// Uses summoner spells (Smite → Jungle) plus a greedy optimal match over the
/// remaining lanes based on Meraki positions, champion tags and attribute ratings.
/// </summary>
public static class LaneAssigner
{
    public const string Top = "TOP";
    public const string Jungle = "JUNGLE";
    public const string Middle = "MIDDLE";
    public const string Bottom = "BOTTOM";
    public const string Utility = "UTILITY";

    private const long SmiteSpellId = 11;
    private static readonly string[] AllLanes = { Top, Jungle, Middle, Bottom, Utility };

    /// <summary>
    /// Returns an array of lanes, one per participant, in the same order as the input list.
    /// Guarantees every participant gets a lane — if the optimization leaves someone blank,
    /// the remaining unused lanes are assigned deterministically so no slot stays empty.
    /// </summary>
    public static string[] AssignLanes(
        IReadOnlyList<GameParticipant> teamParticipants,
        IReadOnlyDictionary<int, ChampionInfo> champions)
    {
        var result = new string[teamParticipants.Count];
        if (teamParticipants.Count == 0) return result;

        var availableLanes = new List<string>(AllLanes);
        var toAssign = Enumerable.Range(0, teamParticipants.Count).ToList();

        // Step 1: the player with Smite is always the jungler.
        int junglerIdx = -1;
        foreach (var i in toAssign)
        {
            var p = teamParticipants[i];
            if (p.Spell1Id == SmiteSpellId || p.Spell2Id == SmiteSpellId)
            {
                junglerIdx = i;
                break;
            }
        }
        if (junglerIdx >= 0)
        {
            result[junglerIdx] = Jungle;
            toAssign.Remove(junglerIdx);
            availableLanes.Remove(Jungle);
        }

        // Step 2: brute-force best assignment for the remaining (≤ 4! = 24 permutations).
        if (toAssign.Count > 0 && availableLanes.Count > 0)
        {
            int bestScore = int.MinValue;
            int[]? bestPerm = null;
            var permIndices = Enumerable.Range(0, toAssign.Count).ToArray();

            foreach (var perm in Permutations(permIndices))
            {
                int score = 0;
                for (int slot = 0; slot < perm.Length && slot < availableLanes.Count; slot++)
                {
                    var pIdx = toAssign[perm[slot]];
                    var participant = teamParticipants[pIdx];
                    if (champions.TryGetValue(participant.ChampionId, out var champ))
                        score += ScoreLaneFit(champ, availableLanes[slot]);
                }
                if (score > bestScore)
                {
                    bestScore = score;
                    bestPerm = perm;
                }
            }

            if (bestPerm is not null)
            {
                for (int slot = 0; slot < bestPerm.Length && slot < availableLanes.Count; slot++)
                {
                    var pIdx = toAssign[bestPerm[slot]];
                    result[pIdx] = availableLanes[slot];
                }
            }
        }

        // Step 3: safety net — any slot that's still empty gets the leftover lanes in order.
        // This covers edge cases like "4 players assigned, 5th somehow blank" caused by
        // off-meta team comps, missing Meraki data, or non-5-player teams (ARAM, bots).
        var usedLanes = new HashSet<string>(
            result.Where(l => !string.IsNullOrEmpty(l)), StringComparer.OrdinalIgnoreCase);
        var leftoverLanes = new Queue<string>(AllLanes.Where(l => !usedLanes.Contains(l)));

        for (int i = 0; i < result.Length; i++)
        {
            if (!string.IsNullOrEmpty(result[i])) continue;
            result[i] = leftoverLanes.Count > 0 ? leftoverLanes.Dequeue() : Middle;
        }

        return result;
    }

    private static int ScoreLaneFit(ChampionInfo champ, string lane)
    {
        int score = 0;

        // Meraki-provided positions are the strongest signal.
        if (champ.Positions.Contains(lane, StringComparer.OrdinalIgnoreCase))
            score += 20;

        var tags = champ.Tags;

        switch (lane)
        {
            case Top:
                if (tags.Contains("Fighter")) score += 8;
                if (tags.Contains("Tank")) score += 8;
                if (tags.Contains("Marksman")) score -= 10;
                if (tags.Contains("Support")) score -= 10;
                break;

            case Middle:
                if (tags.Contains("Mage")) score += 8;
                if (tags.Contains("Assassin")) score += 8;
                if (tags.Contains("Marksman")) score -= 5;
                if (tags.Contains("Support")) score -= 10;
                break;

            case Bottom:
                if (tags.Contains("Marksman")) score += 15;
                if (tags.Contains("Mage") && !tags.Contains("Support")) score += 1;
                if (tags.Contains("Support")) score -= 10;
                break;

            case Utility:
                if (tags.Contains("Support")) score += 15;
                if (tags.Contains("Tank")) score += 4;
                if (tags.Contains("Mage") && champ.AttributeRatings.Utility >= 3) score += 3;
                if (tags.Contains("Marksman")) score -= 15;
                if (tags.Contains("Assassin")) score -= 8;
                break;
        }

        return score;
    }

    private static IEnumerable<int[]> Permutations(int[] items)
    {
        if (items.Length <= 1)
        {
            yield return items.ToArray();
            yield break;
        }

        for (int i = 0; i < items.Length; i++)
        {
            var rest = new int[items.Length - 1];
            Array.Copy(items, 0, rest, 0, i);
            Array.Copy(items, i + 1, rest, i, items.Length - i - 1);

            foreach (var sub in Permutations(rest))
            {
                var result = new int[items.Length];
                result[0] = items[i];
                Array.Copy(sub, 0, result, 1, sub.Length);
                yield return result;
            }
        }
    }
}
