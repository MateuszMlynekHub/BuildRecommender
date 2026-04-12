using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Interfaces;

public interface IRiotApiService
{
    Task<string> GetPuuidByRiotIdAsync(string gameName, string tagLine, string platform);
    Task<ActiveGameInfo?> GetActiveGameAsync(string puuid, string platform);

    // --- Match API endpoints used by the build-stats crawler ---

    /// <summary>Returns PUUIDs of Challenger players in solo-queue ranked on the given platform.</summary>
    Task<string[]> GetChallengerPuuidsAsync(string platform, CancellationToken ct = default);

    /// <summary>Returns PUUIDs of Grandmaster players in solo-queue ranked on the given platform.</summary>
    Task<string[]> GetGrandmasterPuuidsAsync(string platform, CancellationToken ct = default);

    /// <summary>Returns PUUIDs of Master players in solo-queue ranked on the given platform.</summary>
    Task<string[]> GetMasterPuuidsAsync(string platform, CancellationToken ct = default);

    /// <summary>
    /// Returns match IDs for a player's solo-queue ranked games. When <paramref name="startTime"/>
    /// is provided, only matches played at or after that timestamp are returned — used by the
    /// build-stats crawler for both full 7-day backfills and incremental hourly sweeps.
    /// </summary>
    Task<string[]> GetRankedMatchIdsAsync(
        string puuid,
        string platform,
        int count,
        DateTimeOffset? startTime = null,
        CancellationToken ct = default);

    /// <summary>Returns final itemization + winner for each participant in a match.</summary>
    Task<MatchDetails?> GetMatchDetailsAsync(string matchId, string platform, CancellationToken ct = default);

    /// <summary>
    /// Returns skill level-up events from the match timeline. Each entry is (participantId, skillSlot, level).
    /// Only the first 3 level-ups per participant are returned (levels 1-3 skill order).
    /// Returns empty array if timeline is unavailable.
    /// </summary>
    Task<List<(int participantId, int skillSlot)>> GetEarlySkillOrderAsync(
        string matchId, string platform, CancellationToken ct = default);
}
