using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Interfaces;

public interface IBuildRecommenderService
{
    Task<BuildRecommendation> RecommendBuildAsync(
        int championId,
        int[] enemyChampionIds,
        int[] allyChampionIds,
        string? role = null);

    /// <summary>
    /// Returns the most gold-efficient items the player can afford right now.
    /// When <paramref name="championId"/> is provided, items that are components of
    /// the champion's recommended build are prioritised.
    /// </summary>
    Task<GoldRecommendation> GetGoldEfficientItemsAsync(
        int gold,
        int? championId = null,
        string? role = null);
}
