using System.Net.Http.Headers;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Infrastructure.BuildStats;
using LoLBuildRecommender.Infrastructure.BuildStats.Configuration;
using LoLBuildRecommender.Infrastructure.BuildStats.Persistence;
using LoLBuildRecommender.Infrastructure.Caching;
using LoLBuildRecommender.Infrastructure.Configuration;
using LoLBuildRecommender.Infrastructure.DataDragon;
using LoLBuildRecommender.Infrastructure.Meraki;
using LoLBuildRecommender.Infrastructure.RiotApi;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LoLBuildRecommender.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        services.Configure<RiotApiSettings>(
            config.GetSection(RiotApiSettings.SectionName));

        services.AddMemoryCache();

        services.AddTransient<RiotApiDelegatingHandler>();

        services.AddHttpClient("RiotApi", client =>
        {
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
            // Bounded timeout — fast fail instead of 100 s hang when rate-limited/throttled.
            client.Timeout = TimeSpan.FromSeconds(30);
        }).AddHttpMessageHandler<RiotApiDelegatingHandler>();

        services.AddHttpClient("DataDragon", client =>
        {
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
        });

        services.AddHttpClient("Meraki", client =>
        {
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
        });

        services.AddSingleton<IDataDragonService, DataDragonService>();
        services.AddSingleton<IMerakiService, MerakiService>();
        services.AddSingleton<IRiotApiService, RiotApiService>();
        services.AddSingleton<IGameDataService, GameDataCacheService>();

        // --- Build stats pipeline ---
        services.Configure<BuildStatsOptions>(config.GetSection(BuildStatsOptions.SectionName));

        var buildStatsOptions = config.GetSection(BuildStatsOptions.SectionName)
            .Get<BuildStatsOptions>() ?? new BuildStatsOptions();

        // Resolve DB path: absolute as-is, relative under AppContext.BaseDirectory so
        // the file lives alongside the API binary on the VPS and survives restarts.
        var dbPath = Path.IsPathRooted(buildStatsOptions.DatabasePath)
            ? buildStatsOptions.DatabasePath
            : Path.Combine(AppContext.BaseDirectory, buildStatsOptions.DatabasePath);
        var dbDir = Path.GetDirectoryName(dbPath);
        if (!string.IsNullOrEmpty(dbDir)) Directory.CreateDirectory(dbDir);

        services.AddDbContextFactory<BuildStatsDbContext>(options =>
            options.UseSqlite($"Data Source={dbPath}"));

        services.AddSingleton<BuildStatsCrawler>();
        services.AddSingleton<IBuildStatsService, BuildStatsService>();
        services.AddHostedService<BuildStatsRefreshService>();

        return services;
    }
}
