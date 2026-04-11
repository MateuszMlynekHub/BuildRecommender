using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Services;
using LoLBuildRecommender.Infrastructure;
using LoLBuildRecommender.Infrastructure.BuildStats.Persistence;
using LoLBuildRecommender.Infrastructure.Configuration;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);

// --- Configuration ---------------------------------------------------------
// appsettings.{Environment}.json layers on top of appsettings.json automatically;
// env vars (double-underscore for nested keys, e.g. RiotApi__ApiKey) override both.
// The production host is expected to set: RiotApi__ApiKey, Cors__AllowedOrigins__0
builder.Configuration.AddEnvironmentVariables();

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<IBuildRecommenderService, BuildRecommenderService>();

// Health checks — /health is what the container orchestrator and uptime monitor poll.
// Intentionally a simple liveness check (no Riot API ping) so a temporary Riot outage
// doesn't mark the container unhealthy and trigger a restart loop.
builder.Services.AddHealthChecks();

// Response compression — Brotli for modern clients, gzip fallback. Huge win for the
// build-recommendation JSON which can reach 20–40 KB uncompressed.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[] { "application/json" });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

// Forwarded headers — required when running behind Nginx/Caddy/Traefik so the app
// sees the real client IP (for logging) and the original scheme (https) instead of
// the reverse-proxy's internal http://backend:8080.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // In Docker the proxy is always on the same bridge network, so KnownNetworks/Proxies
    // would require guessing the docker subnet. Clearing the allow-lists trusts every
    // upstream hop, which is the correct behavior when the ONLY way in is through the
    // compose-managed proxy container.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// CORS — Production origins come from config (Cors:AllowedOrigins). The default
// appsettings.json lists localhost:4200 so `dotnet run` keeps working; appsettings
// .Production.json wipes the list and the deploy `.env` injects the real origin via
// Cors__AllowedOrigins__0=https://draftsense.net.
var corsOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (corsOrigins.Length > 0)
        {
            policy.WithOrigins(corsOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
        // No origins configured = no CORS applied (same-origin deployments where the
        // frontend and backend share a host via reverse proxy — no preflight needed).
    });
});

var app = builder.Build();

// --- Production startup validation -----------------------------------------
// Fail loudly when a critical secret is missing in production. Better a 60-second
// hard crash on deploy than a silently-broken API that 500s on every Riot call.
if (app.Environment.IsProduction())
{
    var riotSettings = app.Services.GetRequiredService<IOptions<RiotApiSettings>>().Value;
    if (string.IsNullOrWhiteSpace(riotSettings.ApiKey))
    {
        app.Logger.LogCritical(
            "RiotApi:ApiKey is not configured. Set RiotApi__ApiKey env var before starting the container.");
        throw new InvalidOperationException(
            "RiotApi:ApiKey is required in Production. Set the RiotApi__ApiKey environment variable.");
    }
    if (corsOrigins.Length == 0)
    {
        app.Logger.LogWarning(
            "Cors:AllowedOrigins is empty — CORS is disabled. Configure Cors__AllowedOrigins__0 if the frontend is on a different origin.");
    }
}

// Ensure the SQLite build-stats database exists and has every table the current EF
// model expects. This is a FORWARD-COMPATIBLE migration — existing historical data is
// preserved across restarts, we only ADD missing tables with idempotent DDL.
// Never wipes the file.
using (var scope = app.Services.CreateScope())
{
    var dbFactory = scope.ServiceProvider
        .GetRequiredService<IDbContextFactory<BuildStatsDbContext>>();
    await using var ctx = await dbFactory.CreateDbContextAsync();

    // First-run: build the full schema. No-op if the DB file already exists.
    await ctx.Database.EnsureCreatedAsync();

    // Forward-compatible additions for DBs created before a new table was introduced.
    // Each statement is idempotent (IF NOT EXISTS) so it's safe to run on every startup.
    // When you add a new table to BuildStatsDbContext, add its DDL here too.
    await ctx.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""ProcessedMatches"" (
            ""MatchId"" TEXT NOT NULL CONSTRAINT ""PK_ProcessedMatches"" PRIMARY KEY,
            ""Patch"" TEXT NOT NULL,
            ""ProcessedAt"" TEXT NOT NULL
        )");
    await ctx.Database.ExecuteSqlRawAsync(@"
        CREATE INDEX IF NOT EXISTS ""IX_ProcessedMatches_Patch""
        ON ""ProcessedMatches"" (""Patch"")");

    // Forward-compatible ALTER — add DataVersion column to CrawlMetadata if absent.
    // SQLite doesn't support IF NOT EXISTS on ALTER TABLE ADD COLUMN, so we check
    // the column's presence via pragma_table_info first. Pre-checking (instead of
    // catching "duplicate column") avoids the noisy EF Core "fail:" log that appears
    // every restart after the migration is already applied.
    var dataVersionColumnExists = await ColumnExistsAsync(ctx, "CrawlMetadata", "DataVersion");
    if (!dataVersionColumnExists)
    {
        await ctx.Database.ExecuteSqlRawAsync(
            @"ALTER TABLE ""CrawlMetadata"" ADD COLUMN ""DataVersion"" INTEGER NOT NULL DEFAULT 0");
        app.Logger.LogInformation("Added DataVersion column to CrawlMetadata (schema migration)");
    }
}

// Scalar "does this column exist on this table" check using SQLite's pragma_table_info.
// Uses raw ADO.NET so it doesn't trigger EF Core's command failure logger on misses.
static async Task<bool> ColumnExistsAsync(BuildStatsDbContext ctx, string table, string column)
{
    var conn = ctx.Database.GetDbConnection();
    if (conn.State != System.Data.ConnectionState.Open)
        await conn.OpenAsync();

    await using var cmd = conn.CreateCommand();
    cmd.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = '{column}'";
    var result = await cmd.ExecuteScalarAsync();
    return result is not null && Convert.ToInt64(result) > 0;
}

// Preload game data cache at startup
var gameDataService = app.Services.GetRequiredService<IGameDataService>();
_ = Task.Run(async () =>
{
    try
    {
        await gameDataService.EnsureDataLoadedAsync();
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to preload game data");
    }
});

// --- Request pipeline ------------------------------------------------------
// ForwardedHeaders MUST run first so downstream middleware (auth, logging, redirect)
// sees the real scheme and remote IP.
app.UseForwardedHeaders();

app.UseResponseCompression();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// HTTPS redirect is handled by the reverse proxy (Caddy/Nginx) in production.
// Running it inside the container would double-redirect and break health probes.
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("Frontend");

// Liveness endpoint — exposed for container healthchecks and uptime monitors.
// No Riot API dependency; returns 200 as long as the process is up and the DI
// container is wired.
app.MapHealthChecks("/health");

app.MapControllers();

app.Run();
