namespace LoLBuildRecommender.Infrastructure.Configuration;

public class RiotApiSettings
{
    public const string SectionName = "RiotApi";
    public string ApiKey { get; set; } = string.Empty;
}
