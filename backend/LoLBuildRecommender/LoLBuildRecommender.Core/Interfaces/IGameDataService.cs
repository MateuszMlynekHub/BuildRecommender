using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Interfaces;

public interface IGameDataService
{
    Task<Dictionary<int, ChampionInfo>> GetChampionsAsync();
    Task<Dictionary<int, ItemInfo>> GetCompletedItemsAsync();

    /// <summary>
    /// Looks up a single item by its Data Dragon ID across the FULL pool (components
    /// and completed items). Returns null when the ID doesn't correspond to a
    /// Summoner's Rift item. Used for surfacing sub-components that should be
    /// rushed early (e.g., Tear of the Goddess 3070 for Manamune builds).
    /// </summary>
    Task<ItemInfo?> GetItemByIdAsync(int id);

    Task<string> GetCurrentVersionAsync();
    Task EnsureDataLoadedAsync();
}
