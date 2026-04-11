using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Interfaces;

public interface IBuildRecommenderService
{
    Task<BuildRecommendation> RecommendBuildAsync(
        int championId,
        int[] enemyChampionIds,
        int[] allyChampionIds,
        string? role = null);
}
