using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Interfaces;

public interface IDataDragonService
{
    Task<string> GetLatestVersionAsync();
    Task<Dictionary<int, ChampionInfo>> GetChampionsAsync();
    Task<Dictionary<int, ItemInfo>> GetItemsAsync();
}
