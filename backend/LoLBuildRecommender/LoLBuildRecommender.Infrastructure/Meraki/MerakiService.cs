using System.Net.Http.Json;
using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using LoLBuildRecommender.Infrastructure.Meraki.Dtos;
using Microsoft.Extensions.Logging;

namespace LoLBuildRecommender.Infrastructure.Meraki;

public class MerakiService : IMerakiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<MerakiService> _logger;

    // Override table for champions where raw damage-scaling heuristic produces the wrong
    // answer. Typically tanks, enchanters, and utility/DoT champions whose "best" max
    // priority is based on utility numbers (shield strength, CD reduction, slow duration)
    // rather than raw damage. Keys are champion keys (Data Dragon id, e.g. "Malzahar").
    //
    // Format: (firstSkill, priority[3]) where priority is max order leftmost-first.
    // Only add entries here when you're confident the heuristic is wrong — leave
    // damage-focused champions to the leveling parser.
    private static readonly Dictionary<string, (string First, string[] Priority)> SkillOrderOverrides =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Spreading DoT — E scales and spreads through Visions, not Q burst
            ["Malzahar"] = ("Q", new[] { "E", "Q", "W" }),
            // Tanks / engage supports — utility value on E/W beats Q damage per rank
            ["Leona"]    = ("E", new[] { "E", "W", "Q" }),
            ["Nautilus"] = ("Q", new[] { "Q", "E", "W" }),
            ["Alistar"]  = ("W", new[] { "W", "Q", "E" }),
            ["Braum"]    = ("E", new[] { "E", "W", "Q" }),
            ["Blitzcrank"] = ("Q", new[] { "E", "W", "Q" }),
            ["Thresh"]   = ("Q", new[] { "E", "Q", "W" }),
            // Enchanters — W/E shield/heal value > Q damage growth
            ["Janna"]    = ("Q", new[] { "W", "Q", "E" }),
            ["Soraka"]   = ("E", new[] { "E", "Q", "W" }),
            ["Lulu"]     = ("E", new[] { "E", "Q", "W" }),
            ["Nami"]     = ("W", new[] { "W", "E", "Q" }),
            ["Karma"]    = ("Q", new[] { "Q", "E", "W" }),
            // Taric's E is the stun; W is the shield/aura value
            ["Taric"]    = ("E", new[] { "W", "Q", "E" }),
            // Mordekaiser typically maxes Q (Obliterate) but starts W (Indestructible) for trade
            ["Mordekaiser"] = ("Q", new[] { "Q", "E", "W" }),
            // Renekton Q is his lane presence despite W being the stun
            ["Renekton"] = ("Q", new[] { "Q", "W", "E" }),
            // Ezreal Q (Mystic Shot) is always first and maxed first
            ["Ezreal"]   = ("Q", new[] { "Q", "W", "E" }),
            // Graves Q is the main damage window — maxes first despite W mechanic
            ["Graves"]   = ("Q", new[] { "Q", "E", "W" }),
        };

    public MerakiService(IHttpClientFactory httpClientFactory, ILogger<MerakiService> logger)
    {
        _httpClient = httpClientFactory.CreateClient("Meraki");
        _logger = logger;
    }

    public async Task<Dictionary<string, MerakiChampionData>> GetAllChampionsAsync()
    {
        try
        {
            var response = await _httpClient.GetFromJsonAsync<MerakiChampionsResponse>(
                "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json");

            if (response is null) return new();

            var result = new Dictionary<string, MerakiChampionData>();
            foreach (var (key, champ) in response)
            {
                result[key] = AnalyzeChampion(champ, key);
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch Meraki champion data, falling back to DDragon only");
            return new();
        }
    }

    private static MerakiChampionData AnalyzeChampion(MerakiChampionDto dto, string championKey)
    {
        var abilities = dto.Abilities.All().ToList();

        int physical = 0, magic = 0, trueDmg = 0;
        int healingAbilities = 0;
        int hardCcAbilities = 0;

        foreach (var ability in abilities)
        {
            var dmgType = ability.DamageType?.ToUpperInvariant() ?? "";
            if (dmgType.Contains("PHYSICAL")) physical++;
            else if (dmgType.Contains("MAGIC")) magic++;
            else if (dmgType.Contains("TRUE")) trueDmg++;

            var desc = (ability.Description ?? "").ToLowerInvariant();
            var effectDescs = string.Join(" ", ability.Effects.Select(e => e.Description.ToLowerInvariant()));
            var allText = desc + " " + effectDescs;

            // Count distinct healing abilities — gives us a scalar intensity instead
            // of a binary has/hasn't heal. "Grievous wounds / healing reduction" must NOT
            // be counted as a heal mention.
            var isHealAbility = !allText.Contains("grievous") && !allText.Contains("heal reduction") && (
                allText.Contains("heal")
                || allText.Contains("restore")
                || allText.Contains("life steal")
                || allText.Contains("omnivamp")
                || allText.Contains("regenerat"));
            if (isHealAbility) healingAbilities++;

            // Count distinct hard-CC abilities so we can compute a scalar CC score instead
            // of the old "any CC at all → 100%" binary. Only one increment per ability even
            // if multiple CC keywords appear in the description.
            var isHardCcAbility =
                allText.Contains("stun") || allText.Contains("knock") || allText.Contains("suppress")
                || allText.Contains("root") || allText.Contains("snare") || allText.Contains("airborne")
                || allText.Contains("charm") || allText.Contains("taunt") || allText.Contains("fear")
                || allText.Contains("sleep") || allText.Contains("pull") || allText.Contains("polymorph")
                || allText.Contains("petrif") || allText.Contains("stasis");
            if (isHardCcAbility) hardCcAbilities++;
        }

        // Scale heal intensity: 1 ability → 0.33, 2 → 0.67, 3+ → 1.0.
        // Soraka/Yuumi/Zac hit 1.0; Ashe (lone lifesteal mention) stays around 0.33.
        var healingIntensity = Math.Min(1.0, healingAbilities / 3.0);
        var hasHealing = healingAbilities > 0;

        // Same shape of curve for hard CC: 1 ability → 0.33, 2 → 0.67, 3+ → 1.0. A team
        // of 5 single-CC champs (Yasuo-Q3, Velkoz-E, Taric-E, Bard-Q, Hecarim-R/E) averages
        // out to ~50% team CC threat instead of the old flat 100%, while engage comps like
        // Leona/Nautilus/Maokai (3+ hard CC each) correctly land near 100%.
        var ccScore = Math.Min(1.0, hardCcAbilities / 3.0);
        var hasHardCC = hardCcAbilities > 0;

        var primaryDamage = DeterminePrimaryDamage(physical, magic, trueDmg, dto.AdaptiveType);
        var resourceless = string.IsNullOrEmpty(dto.Resource)
                          || dto.Resource.Equals("NONE", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("ENERGY", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("HEALTH", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("FURY", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("RAGE", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("FEROCITY", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("HEAT", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("FLOW", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("GRIT", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("BLOODTHIRST", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("COURAGE", StringComparison.OrdinalIgnoreCase)
                          || dto.Resource.Equals("SHIELD", StringComparison.OrdinalIgnoreCase);

        var skillOrder = ComputeSkillOrder(dto, championKey);

        return new MerakiChampionData
        {
            AdaptiveType = dto.AdaptiveType,
            Roles = dto.Roles.ToArray(),
            Positions = dto.Positions.ToArray(),
            AttributeRatings = new AttributeRatings
            {
                Damage = dto.AttributeRatings.Damage,
                Toughness = dto.AttributeRatings.Toughness,
                Control = dto.AttributeRatings.Control,
                Mobility = dto.AttributeRatings.Mobility,
                Utility = dto.AttributeRatings.Utility,
            },
            DamageProfile = new DamageProfile
            {
                PhysicalAbilities = physical,
                MagicAbilities = magic,
                TrueAbilities = trueDmg,
                PrimaryDamageType = primaryDamage,
            },
            HasHealing = hasHealing,
            HasHardCC = hasHardCC,
            Resourceless = resourceless,
            HealingIntensity = healingIntensity,
            CcScore = ccScore,
            SkillOrder = skillOrder,
        };
    }

    /// <summary>
    /// Computes the Q/W/E max priority and level-1 pick from Meraki ability leveling
    /// data. The heuristic:
    ///   1. For each of Q/W/E, sum "damage-like" leveling values across every effect.
    ///      "Damage-like" = attribute contains "damage" and not "reduction".
    ///   2. Compute growth = (sum at rank 5) - (sum at rank 1). Ability with highest
    ///      growth is maxed first.
    ///   3. Level-1 pick = ability with highest base damage at rank 1 (or the max-first
    ///      if tied).
    /// Override table (<see cref="SkillOrderOverrides"/>) takes precedence for champions
    /// where utility scaling dominates raw damage (tanks/enchanters/DoT spreaders).
    /// Falls back to a Q→E→W default if leveling data is missing (utility champs with
    /// no damage numbers like Yuumi often trip this).
    /// </summary>
    private static SkillOrder? ComputeSkillOrder(MerakiChampionDto dto, string championKey)
    {
        var qName = dto.Abilities.Q.FirstOrDefault()?.Name ?? "Q";
        var wName = dto.Abilities.W.FirstOrDefault()?.Name ?? "W";
        var eName = dto.Abilities.E.FirstOrDefault()?.Name ?? "E";
        var rName = dto.Abilities.R.FirstOrDefault()?.Name ?? "R";

        // Override wins outright — no heuristic math, just use the curated meta value.
        if (SkillOrderOverrides.TryGetValue(championKey, out var over))
        {
            return new SkillOrder
            {
                FirstSkill = over.First,
                Priority = over.Priority,
                Source = "Meta (curated override)",
                QName = qName, WName = wName, EName = eName, RName = rName,
                Levels = GenerateLevels(over.First, over.Priority),
            };
        }

        var qScale = SumDamageScaling(dto.Abilities.Q);
        var wScale = SumDamageScaling(dto.Abilities.W);
        var eScale = SumDamageScaling(dto.Abilities.E);

        // If none of the basic abilities expose damage scaling (pure utility champs like
        // Yuumi, Ivern), we can't rank them — return null so the UI hides the section
        // rather than showing an arbitrary order.
        if (qScale.Growth <= 0 && wScale.Growth <= 0 && eScale.Growth <= 0)
        {
            return null;
        }

        // Sort by damage growth descending — highest growth = most value per level-up.
        var byGrowth = new[]
        {
            ("Q", qScale),
            ("W", wScale),
            ("E", eScale),
        }
        .OrderByDescending(t => t.Item2.Growth)
        .ThenByDescending(t => t.Item2.BaseDamage)
        .ToArray();

        var priority = byGrowth.Select(t => t.Item1).ToArray();

        // Level 1 = whichever has the highest rank-1 damage (so the player gets a
        // poke / last-hit option right away). Tie-break to the max-first ability.
        var firstSkill = new[]
        {
            ("Q", qScale),
            ("W", wScale),
            ("E", eScale),
        }
        .OrderByDescending(t => t.Item2.BaseDamage)
        .ThenBy(t => Array.IndexOf(priority, t.Item1))
        .First().Item1;

        return new SkillOrder
        {
            FirstSkill = firstSkill,
            Priority = priority,
            Source = "Meraki damage scaling",
            QName = qName, WName = wName, EName = eName, RName = rName,
            Levels = GenerateLevels(firstSkill, priority),
        };
    }

    /// <summary>
    /// Generates the 18-level step-by-step skill order from a firstSkill + priority pair.
    /// Rules:
    ///   • Level 1 = <paramref name="firstSkill"/> (may differ from priority[0] for champs
    ///     like Malzahar who want the slow/silence at level 1 but max E afterwards).
    ///   • Levels 2-3 = the two remaining basics, ordered by priority so the higher
    ///     priority ability gets its first rank first.
    ///   • Levels 6, 11, 16 = R (always take the ultimate when it unlocks).
    ///   • Every other level = put a point into the highest-priority basic that isn't
    ///     yet rank 5. This produces the canonical "max priority[0] first → priority[1]
    ///     → priority[2]" progression used by every LoL guide.
    /// Final tally: priority[0]=5, priority[1]=5, priority[2]=5, R=3, total=18 ✓.
    /// </summary>
    private static string[] GenerateLevels(string firstSkill, string[] priority)
    {
        var levels = new string[18];
        var ranks = new Dictionary<string, int>
        {
            ["Q"] = 0, ["W"] = 0, ["E"] = 0, ["R"] = 0,
        };

        // Level 1 — the designated starter.
        levels[0] = firstSkill;
        ranks[firstSkill] = 1;

        // Levels 2-3 — pick up the two remaining basics so the champion has at least
        // rank 1 in all three by level 3. Iterate priority to decide WHICH of the two
        // remaining abilities comes at level 2 vs level 3 (higher priority = earlier).
        var missing = priority.Where(p => ranks[p] == 0).ToList();
        if (missing.Count >= 1) { levels[1] = missing[0]; ranks[missing[0]] = 1; }
        if (missing.Count >= 2) { levels[2] = missing[1]; ranks[missing[1]] = 1; }

        // Levels 4-18 — R at 6/11/16, otherwise max priority in order.
        for (int lvl = 4; lvl <= 18; lvl++)
        {
            if ((lvl == 6 || lvl == 11 || lvl == 16) && ranks["R"] < 3)
            {
                levels[lvl - 1] = "R";
                ranks["R"]++;
                continue;
            }

            // Walk priority and pick the first basic that still has a rank available.
            var next = priority.FirstOrDefault(p => ranks[p] < 5);
            if (next is null) break;
            levels[lvl - 1] = next;
            ranks[next]++;
        }

        return levels;
    }

    private readonly record struct AbilityScale(double BaseDamage, double MaxDamage)
    {
        public double Growth => MaxDamage - BaseDamage;
    }

    /// <summary>
    /// Walks every effect → leveling → modifier of an ability and sums the per-rank
    /// values that look like damage numbers. Returns rank-1 and rank-5 totals so the
    /// caller can compute both "starting damage" and "growth per rank" without a
    /// second pass.
    /// </summary>
    private static AbilityScale SumDamageScaling(List<MerakiAbilityDto> abilityForms)
    {
        double baseSum = 0;
        double maxSum = 0;

        // Most abilities only have one "form", but Riven/Aphelios/etc. have multiple
        // forms — sum across them so the total reflects the ability's full damage.
        foreach (var ability in abilityForms)
        {
            foreach (var effect in ability.Effects)
            {
                foreach (var leveling in effect.Leveling)
                {
                    var attr = (leveling.Attribute ?? "").ToLowerInvariant();
                    // Only count true damage-scaling attributes. Skip shields/slows/heals/CC
                    // — the heuristic is about combat damage growth, not utility.
                    var isDamage = attr.Contains("damage")
                                   && !attr.Contains("reduction")
                                   && !attr.Contains("mitigation");
                    if (!isDamage) continue;

                    foreach (var modifier in leveling.Modifiers)
                    {
                        var values = modifier.Values;
                        if (values.Count == 0) continue;

                        // Rank-1 = first entry; rank-N = last entry (usually rank 5 for
                        // basic abilities, rank 3 for ultimates — we're only called for
                        // Q/W/E so it's rank 5 in practice).
                        baseSum += values[0];
                        maxSum += values[^1];
                    }
                }
            }
        }

        return new AbilityScale(baseSum, maxSum);
    }

    private static DamageType DeterminePrimaryDamage(int physical, int magic, int trueDmg, string adaptiveType)
    {
        if (physical == 0 && magic == 0 && trueDmg == 0)
        {
            return adaptiveType.Contains("MAGIC", StringComparison.OrdinalIgnoreCase)
                ? DamageType.Magic
                : DamageType.Physical;
        }

        if (trueDmg > physical && trueDmg > magic) return DamageType.True;
        if (physical > 0 && magic > 0 && Math.Abs(physical - magic) <= 1) return DamageType.Mixed;
        if (magic > physical) return DamageType.Magic;
        return DamageType.Physical;
    }
}
