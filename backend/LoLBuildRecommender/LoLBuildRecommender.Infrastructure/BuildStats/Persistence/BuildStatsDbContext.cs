using Microsoft.EntityFrameworkCore;

namespace LoLBuildRecommender.Infrastructure.BuildStats.Persistence;

/// <summary>
/// Single SQLite context for pro-build statistics. Intentionally tiny — just two
/// tables (per-patch item stats + crawler metadata). Registered via IDbContextFactory
/// so singleton services (BuildStatsService, BuildStatsCrawler) can create short-lived
/// contexts per operation without scope gymnastics.
/// </summary>
public class BuildStatsDbContext : DbContext
{
    public BuildStatsDbContext(DbContextOptions<BuildStatsDbContext> options)
        : base(options) { }

    public DbSet<ItemStatEntity> ItemStats => Set<ItemStatEntity>();
    public DbSet<CrawlMetadataEntity> CrawlMetadata => Set<CrawlMetadataEntity>();
    public DbSet<ProcessedMatchEntity> ProcessedMatches => Set<ProcessedMatchEntity>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<ItemStatEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            e.Property(x => x.ChampionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();
            e.Property(x => x.ItemName).HasMaxLength(128).IsRequired();

            // Fast top-N query on GetCoreItems hot path.
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role });

            // Uniqueness guard so aggregation never inserts a duplicate row.
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role, x.ItemId })
                .IsUnique();
        });

        mb.Entity<CrawlMetadataEntity>(e =>
        {
            e.HasKey(x => x.Patch);
            e.Property(x => x.Patch).HasMaxLength(16);
        });

        mb.Entity<ProcessedMatchEntity>(e =>
        {
            e.HasKey(x => x.MatchId);
            e.Property(x => x.MatchId).HasMaxLength(32).IsRequired();
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            // Index for patch-scoped cleanup when a new patch drops.
            e.HasIndex(x => x.Patch);
        });
    }
}
