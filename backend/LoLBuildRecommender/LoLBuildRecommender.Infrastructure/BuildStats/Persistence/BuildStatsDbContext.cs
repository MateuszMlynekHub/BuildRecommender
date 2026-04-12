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
    public DbSet<RuneStatEntity> RuneStats => Set<RuneStatEntity>();
    public DbSet<SpellStatEntity> SpellStats => Set<SpellStatEntity>();
    public DbSet<MatchupStatEntity> MatchupStats => Set<MatchupStatEntity>();
    public DbSet<BuildOrderStatEntity> BuildOrderStats => Set<BuildOrderStatEntity>();
    public DbSet<SkillOrderStatEntity> SkillOrderStats => Set<SkillOrderStatEntity>();
    public DbSet<StartingItemStatEntity> StartingItemStats => Set<StartingItemStatEntity>();
    public DbSet<BanStatEntity> BanStats => Set<BanStatEntity>();
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

        mb.Entity<RuneStatEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            e.Property(x => x.ChampionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();

            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role });
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role,
                x.PrimaryStyle, x.SubStyle,
                x.Perk0, x.Perk1, x.Perk2, x.Perk3, x.Perk4, x.Perk5,
                x.StatOffense, x.StatFlex, x.StatDefense })
                .IsUnique();
        });

        mb.Entity<SpellStatEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            e.Property(x => x.ChampionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();

            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role });
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role, x.Spell1Id, x.Spell2Id })
                .IsUnique();
        });

        mb.Entity<MatchupStatEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            e.Property(x => x.ChampionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.OpponentChampionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();

            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role });
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role, x.OpponentChampionId })
                .IsUnique();
        });

        mb.Entity<BuildOrderStatEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            e.Property(x => x.ChampionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role });
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role, x.Item1Id, x.Item2Id, x.Item3Id })
                .IsUnique();
        });

        mb.Entity<SkillOrderStatEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            e.Property(x => x.ChampionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();
            e.Property(x => x.EarlySkillSequence).HasMaxLength(16).IsRequired();
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role });
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role, x.EarlySkillSequence })
                .IsUnique();
        });

        mb.Entity<BanStatEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            e.Property(x => x.ChampionKey).HasMaxLength(64).IsRequired();
            e.HasIndex(x => new { x.Patch, x.ChampionId }).IsUnique();
        });

        mb.Entity<StartingItemStatEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Patch).HasMaxLength(16).IsRequired();
            e.Property(x => x.ChampionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();
            e.Property(x => x.ItemIds).HasMaxLength(128).IsRequired();
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role });
            e.HasIndex(x => new { x.Patch, x.ChampionId, x.Role, x.ItemIds }).IsUnique();
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
