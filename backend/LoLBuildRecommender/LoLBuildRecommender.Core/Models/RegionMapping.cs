namespace LoLBuildRecommender.Core.Models;

public static class RegionMapping
{
    public static readonly Dictionary<string, string> PlatformToRegional = new()
    {
        ["euw1"] = "europe",
        ["eun1"] = "europe",
        ["tr1"] = "europe",
        ["ru"] = "europe",
        ["me1"] = "europe",
        ["na1"] = "americas",
        ["br1"] = "americas",
        ["la1"] = "americas",
        ["la2"] = "americas",
        ["kr"] = "asia",
        ["jp1"] = "asia",
        ["oc1"] = "sea",
        ["ph2"] = "sea",
        ["sg2"] = "sea",
        ["th2"] = "sea",
        ["tw2"] = "sea",
        ["vn2"] = "sea",
    };

    public static readonly Dictionary<string, string> PlatformDisplayNames = new()
    {
        ["euw1"] = "Europe West",
        ["eun1"] = "Europe Nordic & East",
        ["na1"] = "North America",
        ["kr"] = "Korea",
        ["jp1"] = "Japan",
        ["br1"] = "Brazil",
        ["la1"] = "Latin America North",
        ["la2"] = "Latin America South",
        ["oc1"] = "Oceania",
        ["tr1"] = "Turkey",
        ["ru"] = "Russia",
        ["ph2"] = "Philippines",
        ["sg2"] = "Singapore",
        ["th2"] = "Thailand",
        ["tw2"] = "Taiwan",
        ["vn2"] = "Vietnam",
        ["me1"] = "Middle East",
    };

    public static string GetRegionalRoute(string platform)
        => PlatformToRegional.GetValueOrDefault(platform, "europe");
}
