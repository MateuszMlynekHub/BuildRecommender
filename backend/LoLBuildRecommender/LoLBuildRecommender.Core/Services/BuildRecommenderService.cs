using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;

namespace LoLBuildRecommender.Core.Services;

public class BuildRecommenderService : IBuildRecommenderService
{
    // Cassiopeia cannot purchase boots — her passive grants bonus move speed instead.
    private const string CassiopeiaKey = "Cassiopeia";
    private const int TotalBuildSlots = 6;

    // Tear of the Goddess — the shared sub-component of Manamune (3004), Archangel's
    // Staff (3003) and Winter's Approach (3119). Its passive stacks over time, so when
    // any of these full items are in the recommended build, we surface Tear as an
    // "early component" hint so the player knows to buy it BEFORE finishing the
    // rest of the build (even when the full item ends up at slot 3+).
    private const int TearOfTheGoddessId = 3070;
    private static readonly HashSet<int> TearDependentItemIds = new() { 3003, 3004, 3119 };

    // Champions that love Ardent Censer / Staff of Flowing Water style auras —
    // AS-scaling ranged carries that benefit heavily from the on-hit boost.
    private static readonly HashSet<string> ArdentFriendlyCarries = new(StringComparer.OrdinalIgnoreCase)
    {
        "Jinx", "Kaisa", "KogMaw", "Vayne", "Kalista", "Tristana",
        "Xayah", "Twitch", "Varus", "Caitlyn", "Jhin", "Ashe", "Zeri",
        "Aphelios", "Nilah", "MissFortune",
    };

    // Carries that don't want Ardent Censer — crit/burst carries without strong
    // auto-attack-speed scaling (Yasuo/Yone cap out on Shieldbow+IE, Draven favors BT rush,
    // Samira wants crit, Swain-bot doesn't auto-attack).
    private static readonly HashSet<string> ArdentUnfriendlyCarries = new(StringComparer.OrdinalIgnoreCase)
    {
        "Yasuo", "Yone", "Draven", "Samira", "Swain",
    };

    // Groups of items that share core functionality and should NEVER both appear in
    // a single build. Match is by item name (case-insensitive) so it survives Data Dragon
    // patch renumbering. Add more groups as LoL introduces overlapping items.
    //
    // Current groups:
    //  • Last Whisper upgrades — LDR / Mortal Reminder / Serylda's all build from Last
    //    Whisper and provide %armor pen that doesn't stack. One per build.
    //  • Tear of the Goddess upgrades — Manamune / Archangel's Staff both scale from a
    //    Tear. Technically two tears is legal but practically always suboptimal.
    private static readonly string[][] FunctionalExclusionGroups =
    {
        new[] { "Lord Dominik's Regards", "Serylda's Grudge", "Mortal Reminder" },
        new[] { "Manamune", "Archangel's Staff" },
    };

    // Curated healing-intensity tiers used in place of the raw ability-text heuristic.
    // Reasons for the override:
    //   • Text parsing in MerakiService counts "heal" mentions equally — so Bard's weak
    //     Meep passive ends up rated like Taric's Q. That's fine as a rough signal but
    //     it can't tell a dedicated sustain kit (Soraka triple heal) from an incidental
    //     one (Hecarim W lifesteal). This table is Riot/meta knowledge that overrides
    //     the heuristic for the champions where it matters.
    //   • Keys are Data Dragon ids (champion.Key). Champs not listed fall through to the
    //     Meraki-derived HealingIntensity + Marksman lifesteal baseline below.
    //
    // Tier guidance:
    //   0.90–1.00 — dedicated sustain kit. Anti-heal is mandatory.
    //   0.60–0.80 — strong self-sustain or a main heal spell. Anti-heal is very valuable.
    //   0.35–0.55 — notable heal but conditional / one of several kit pieces.
    //   0.10–0.30 — incidental heal (passive trinket, minor lifesteal). Anti-heal low prio.
    private static readonly Dictionary<string, double> HealingTierOverrides =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Tier S — dedicated sustain cores
            ["Soraka"]       = 1.00,
            ["Yuumi"]        = 0.95,
            ["Milio"]        = 0.90,
            ["Sona"]         = 0.85,
            ["Nami"]         = 0.80,
            ["Seraphine"]    = 0.75,
            ["Taric"]        = 0.70,
            ["Vladimir"]     = 0.90,
            ["DrMundo"]      = 0.90,
            ["Aatrox"]       = 0.80,
            ["Warwick"]      = 0.75,
            ["Fiddlesticks"] = 0.65,

            // Tier A — strong secondary sustain
            ["Janna"]        = 0.50,
            ["Lulu"]         = 0.50,
            ["Karma"]        = 0.45,
            ["Rakan"]        = 0.50,
            ["Senna"]        = 0.50,
            ["Renata"]       = 0.45,
            ["Alistar"]      = 0.45,
            ["Swain"]        = 0.60,
            ["Illaoi"]       = 0.55,
            ["Fiora"]        = 0.55,
            ["Ivern"]        = 0.60,
            ["Zac"]          = 0.50,
            ["Volibear"]     = 0.45,
            ["Mordekaiser"]  = 0.45,
            ["Yorick"]       = 0.40,
            ["Olaf"]         = 0.45,
            ["Nidalee"]      = 0.40,
            ["Sett"]         = 0.40,
            ["Briar"]        = 0.55,
            ["Tryndamere"]   = 0.40,
            ["Udyr"]         = 0.35,

            // Tier B — incidental / conditional heals (anti-heal low priority)
            ["Bard"]         = 0.25,
            ["Pyke"]         = 0.20,
            ["Katarina"]     = 0.20,
            ["Hecarim"]      = 0.30,
            ["Trundle"]      = 0.30,
            ["Kindred"]      = 0.25,
            ["Kayn"]         = 0.35,
            ["Gangplank"]    = 0.30,
            ["Darius"]       = 0.25,
            ["Camille"]      = 0.20,
            ["Irelia"]       = 0.20,
            ["Jax"]          = 0.20,
            ["Garen"]        = 0.10,
            ["Poppy"]        = 0.10,
            ["Rengar"]       = 0.15,
            ["Shen"]         = 0.15,
            ["Kled"]         = 0.15,
            ["Shyvana"]      = 0.20,
            ["Rammus"]       = 0.05,
        };

    // Curated shield-intensity tiers. Shields are mechanically distinct from heals:
    // Grievous Wounds does NOT reduce shield strength, so a team that sustains through
    // Lulu/Janna/Karma shields can laugh at a Morellonomicon rush. We track shielding
    // separately so the recommender can:
    //   • De-prioritize GW items when ShieldThreat exceeds HealingThreat
    //   • (Future) Boost lethality/Serpent's-Fang-style anti-shield items
    // Ability-text parsing is too noisy for this (shield mentions appear all over
    // passive descriptions) so we go straight to a curated override.
    //
    // Tiers:
    //   0.80–0.95 — dedicated shield enchanter, anti-shield is mandatory
    //   0.55–0.75 — strong aura/link shields, anti-shield is valuable
    //   0.30–0.50 — personal/situational shield, minor sustain contribution
    //   0.10–0.25 — incidental passive shield
    private static readonly Dictionary<string, double> ShieldTierOverrides =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Tier S — dedicated shield enchanters
            ["Lulu"]       = 0.95,
            ["Janna"]      = 0.85,
            ["Karma"]      = 0.80,
            ["Orianna"]    = 0.70,
            ["Lux"]        = 0.65,
            ["Taric"]      = 0.70,
            ["Morgana"]    = 0.60,
            ["Seraphine"]  = 0.60,
            ["Shen"]       = 0.70,
            ["Galio"]      = 0.60,
            ["Milio"]      = 0.55,

            // Tier A — significant personal / aura shields
            ["Braum"]      = 0.55,
            ["Thresh"]     = 0.50,
            ["Renata"]     = 0.50,
            ["Rakan"]      = 0.45,
            ["Annie"]      = 0.40,
            ["Sett"]       = 0.45,
            ["Riven"]      = 0.50,
            ["Urgot"]      = 0.40,
            ["Camille"]    = 0.40,
            ["Pantheon"]   = 0.40,
            ["Yasuo"]      = 0.45,
            ["Yone"]       = 0.40,
            ["Kassadin"]   = 0.35,
            ["Sylas"]      = 0.40,
            ["Renekton"]   = 0.30,
            ["Bard"]       = 0.30,
            ["KSante"]     = 0.45,
            ["Kalista"]    = 0.30,
            ["Gragas"]     = 0.30,

            // Tier B — conditional / minor shields
            ["Sona"]       = 0.35,
            ["Sivir"]      = 0.40,
            ["Nocturne"]   = 0.30,
            ["Fiora"]      = 0.25,
            ["Jax"]        = 0.25,
            ["Diana"]      = 0.25,
            ["Blitzcrank"] = 0.25,
            ["Volibear"]   = 0.20,
            ["Sion"]       = 0.25,
            ["Garen"]      = 0.15,
            ["Vi"]         = 0.15,
            ["Shaco"]      = 0.15,
            ["Ornn"]       = 0.20,
        };

    // Curated engage/dive-threat tiers. This is the "how likely am I to eat a Malphite R"
    // dimension, orthogonal to raw CC — a Thresh hook is hard CC but not engage (it pulls
    // the enemy *away* from me), while a Malphite ult is instant dive with no counterplay
    // other than stasis. High EngageThreat drives Zhonya's / Banshee's / Edge of Night /
    // Gargoyle's Stoneplate into the rush slots, not just raw tenacity.
    //
    // Tiers:
    //   0.85–1.00 — instant point-and-click or very reliable dive + hard CC
    //   0.60–0.80 — strong gap-closer with hard CC or combo stun
    //   0.40–0.55 — mobility engage that can kill carries but requires setup
    //   0.20–0.35 — has a dash but rarely initiates fights with it
    private static readonly Dictionary<string, double> EngageTierOverrides =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Tier S — instant dive, the reason Zhonya's exists
            ["Malphite"]   = 1.00,
            ["Amumu"]      = 1.00,
            ["Nautilus"]   = 0.95,
            ["Rell"]       = 0.95,
            ["Leona"]      = 0.90,
            ["Rakan"]      = 0.85,
            ["Sejuani"]    = 0.85,
            ["Hecarim"]    = 0.85,
            ["Zac"]        = 0.85,
            ["JarvanIV"]   = 0.85,
            ["Kennen"]     = 0.85,
            ["Diana"]      = 0.80,
            ["Gragas"]     = 0.80,
            ["Alistar"]    = 0.80,

            // Tier A — strong dive + CC
            ["Ornn"]       = 0.70,
            ["Maokai"]     = 0.70,
            ["Rumble"]     = 0.70,
            ["Jax"]        = 0.70,
            ["Kled"]       = 0.70,
            ["Wukong"]     = 0.70,
            ["Vi"]         = 0.70,
            ["Camille"]    = 0.70,
            ["LeeSin"]     = 0.65,
            ["XinZhao"]    = 0.65,
            ["Pantheon"]   = 0.60,
            ["Nocturne"]   = 0.65,
            ["Warwick"]    = 0.65,
            ["Galio"]      = 0.65,
            ["Urgot"]      = 0.60,
            ["Gnar"]       = 0.60,
            ["Rengar"]     = 0.75, // leap-from-bush one-shot
            ["Briar"]      = 0.65,
            ["Sett"]       = 0.55,
            ["Kayn"]       = 0.55,
            ["Elise"]      = 0.55,
            ["Volibear"]   = 0.55,
            ["Olaf"]       = 0.50,
            ["Fizz"]       = 0.50,
            ["Ekko"]       = 0.50,
            ["Riven"]      = 0.50,
            ["Irelia"]     = 0.50,
            ["Darius"]     = 0.50,
            ["Shen"]       = 0.45,
            ["Skarner"]    = 0.55,

            // Tier B — mobility but seldom the initiator
            ["Khazix"]     = 0.55,
            ["Zed"]        = 0.50,
            ["Akali"]      = 0.45,
            ["Qiyana"]     = 0.50,
            ["Viego"]      = 0.40,
            ["Aatrox"]     = 0.45,
            ["Evelynn"]    = 0.55,
            ["Nidalee"]    = 0.30,
            ["Yone"]       = 0.35,
            ["Yasuo"]      = 0.35,
            ["Samira"]     = 0.40,
            ["Tristana"]   = 0.40,
            ["Kalista"]    = 0.30,
            ["MonkeyKing"] = 0.70, // Wukong's DD id
        };

    // Items with active damage avoidance / spellshield / damage reduction that directly
    // counter hard engage. When EngageThreat is high we boost their score and push them
    // into an earlier build slot — a Zhonya's in slot 3 saves you from a Malphite R that
    // a Zhonya's in slot 6 wouldn't have.
    private static readonly HashSet<string> AntiEngageItemNames =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "Zhonya's Hourglass",
            "Edge of Night",
            "Banshee's Veil",
            "Gargoyle's Stoneplate",
        };

    // Curated long-range poke tiers. Poke is about "you cannot approach the lane without
    // losing 30% HP" — dedicated artillery mages (Xerath/Ziggs/Vel'Koz), piercing-arrow
    // ADCs (Varus/Caitlyn/Jhin), and long-javelin assassins (Nidalee). Counter strategy
    // is HP/regen sustain (Rod of Ages, Warmog's, Spirit Visage) or magic-block for AD
    // champs (Maw of Malmortius), NOT stasis — a Zhonya's doesn't help when you're just
    // slowly bleeding out from Ziggs Q.
    //
    // Tiers:
    //   0.85–1.00 — entire kit is long-range poke (Xerath-level)
    //   0.60–0.80 — at least 2 reliable long-range damage tools
    //   0.35–0.55 — one notable poke tool among other kit pieces
    private static readonly Dictionary<string, double> PokeTierOverrides =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Tier S — artillery
            ["Xerath"]       = 1.00,
            ["Ziggs"]        = 0.95,
            ["Velkoz"]       = 0.90,
            ["Jayce"]        = 0.85,
            ["Nidalee"]      = 0.85,
            ["Varus"]        = 0.80,
            ["Caitlyn"]      = 0.80,
            ["Corki"]        = 0.75,
            ["Lux"]          = 0.75,
            ["Heimerdinger"] = 0.70,

            // Tier A — strong poke kits
            ["Ezreal"]       = 0.70,
            ["Ashe"]         = 0.65,
            ["Jhin"]         = 0.65,
            ["Senna"]        = 0.65,
            ["Zoe"]          = 0.70,
            ["Karma"]        = 0.55,
            ["MissFortune"]  = 0.55,
            ["Orianna"]      = 0.55,
            ["Syndra"]       = 0.60,
            ["Morgana"]      = 0.55,
            ["Lissandra"]    = 0.50,
            ["TwistedFate"]  = 0.55,
            ["Brand"]        = 0.55,
            ["Zyra"]         = 0.55,
            ["Taliyah"]      = 0.55,
            ["Neeko"]        = 0.50,
            ["Cassiopeia"]   = 0.45,
            ["Anivia"]       = 0.50,
            ["Kennen"]       = 0.45,
            ["Rumble"]       = 0.40,
            ["Swain"]        = 0.40,
            ["Vladimir"]     = 0.35,
            ["Seraphine"]    = 0.50,
            ["KogMaw"]       = 0.60, // R artillery
            ["Ryze"]         = 0.40,
            ["Viktor"]       = 0.45,
            ["Ahri"]         = 0.40,
            ["Lulu"]         = 0.40, // Q ranged poke
        };

    // Items that make a poke laning phase survivable: HP stacking, HP regen, or magic
    // damage lifelines. Anti-poke priority is about "don't lose lane to Ziggs farming
    // from a screen away" — stasis items wouldn't help here.
    private static readonly HashSet<string> AntiPokeItemNames =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "Rod of Ages",
            "Warmog's Armor",
            "Spirit Visage",
            "Maw of Malmortius",
            "Heartsteel",
            "Force of Nature",
        };

    // Curated %max-HP / true-damage tiers. These champions punish HP-stacking — Warmog's
    // or Heartsteel become strictly worse vs them because the damage either bypasses
    // resists entirely (true damage) or grows WITH your HP pool (%max-HP). The counter
    // is to buy armor/MR instead, which reduces the non-true portion of incoming damage
    // and leaves the true portion unscaled.
    //
    // Tiers:
    //   0.85–1.00 — entire kit bypasses HP (Vayne W, Kog'Maw W, Fiora passive, Gwen passive)
    //   0.55–0.75 — reliable execute or secondary %HP tool (Cho'Gath R, Garen R, Twitch E, Pyke R)
    //   0.30–0.50 — single incidental mechanic (Akali R2, Camille passive, Yi E, Kayle late)
    // Champions whose typical build revolves around crit items (Infinity Edge, Rapid
    // Firecannon, LDR, Collector, Lord Dominik's). Used to flag Randuin's Omen as a
    // valuable counter-pick — Randuin's passive reduces incoming crit damage, which
    // only matters when the enemy actually crits. Non-crit marksmen (Varus lethality,
    // Kog'Maw / Twitch on-hit, Senna) are excluded.
    private static readonly HashSet<string> CritCarryChampions =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "Caitlyn", "Jinx", "Jhin", "MissFortune", "Tristana", "Xayah",
            "Ashe", "Draven", "Sivir", "Nilah", "Zeri", "Kalista",
            "Yasuo", "Yone", "Tryndamere", "MasterYi", "Samira", "Lucian",
        };

    // Champions with stealth / camouflage mechanics. This is used purely as a UI hint
    // (buy Control Wards / use Oracle Lens) — there's no item in the completed-items
    // pool that counters stealth directly. Keeping the list tight to real stealth:
    // brief short-range dashes or clones aren't stealth.
    private static readonly HashSet<string> InvisibleChampions =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Abilities that grant true stealth/camouflage (not brief dashes or clones).
            "Evelynn",    // passive Demon Shade at 6+
            "Twitch",     // Q Ambush
            "Akali",      // W Twilight Shroud
            "Shaco",      // Q Deceive
            "Rengar",     // R Thrill of the Hunt
            "Khazix",     // R (evolved) stealth
            "Talon",      // R Shadow Assault
            "MonkeyKing", // Wukong W clone + brief stealth
            "Teemo",      // passive Guerrilla Warfare + Camouflage from items
        };

    private static readonly Dictionary<string, double> TrueDamageOverrides =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Tier S — entire damage profile bypasses HP
            ["Vayne"]      = 1.00, // W true on 3rd hit (actually true dmg % max hp)
            ["KogMaw"]     = 0.95, // W % max HP magic
            ["Fiora"]      = 0.90, // passive true damage vitals
            ["Gwen"]       = 0.90, // passive % max HP
            ["Chogath"]    = 0.85, // R true execute
            ["Twitch"]     = 0.75, // E true damage execute

            // Tier A — strong conditional execute / key true dmg spell
            ["Garen"]      = 0.70, // R true damage villain execute
            ["Pyke"]       = 0.75, // R true damage execute
            ["Akali"]      = 0.60, // R2 true damage execute
            ["Darius"]     = 0.55, // passive bleed scaling (physical technically)
            ["Kayle"]      = 0.70, // passive + R true damage late
            ["MasterYi"]   = 0.70, // E Wuju Style true damage
            ["Camille"]    = 0.55, // passive true damage first hit
            ["Shyvana"]    = 0.55, // E % max HP magic
            ["Kindred"]    = 0.50, // passive true dmg stacks
            ["FiddleSticks"] = 0.45, // R % max HP drain
            ["Fiddlesticks"] = 0.45,

            // Tier B — minor true/%HP element
            ["RekSai"]     = 0.40, // R true damage execute
            ["Nasus"]      = 0.40, // R drain % max HP aura (was %, now hybrid)
            ["Senna"]      = 0.35, // Q true damage on kill stacks
            ["Varus"]      = 0.35, // lethality partial
            ["Olaf"]       = 0.35, // E true damage
            ["Tryndamere"] = 0.30, // crit but no true dmg
            ["Irelia"]     = 0.30, // true dmg on Q? no, skip — low
            ["Urgot"]      = 0.35, // %HP W
            ["Belveth"]    = 0.40, // R void spawn true dmg
            ["Mordekaiser"] = 0.40, // R % max HP
            ["Ornn"]       = 0.35, // R % max HP slow
            ["Volibear"]   = 0.35, // R % max HP magic
            ["Illaoi"]     = 0.40, // tentacle % max HP
            ["Rammus"]     = 0.35, // W aura % damage return
        };

    // Hardcoded whitelist of "real" enchanter core items for the Enchanter archetype.
    // These get a large priority bonus so Lulu/Janna/Soraka/Morgana-sup/etc. pick them
    // instead of mage damage items that happen to share AP + AH stats. IDs are stable
    // across Data Dragon patches; add new items here as Riot introduces them.
    private static readonly HashSet<int> CoreEnchanterItemIds = new()
    {
        3107, // Redemption
        3222, // Mikael's Blessing
        3504, // Ardent Censer
        6617, // Moonstone Renewer
        3011, // Chemtech Putrifier
        6616, // Staff of Flowing Water
        3190, // Locket of the Iron Solari
        6665, // Dawncore
        2065, // Shurelya's Battlesong
        3905, // Echoes of Helia
        3050, // Zeke's Convergence
        3109, // Knight's Vow
        3800, // Righteous Glory
        3869, // Celestial Opposition (new support item)
    };

    private readonly IGameDataService _gameData;
    private readonly IBuildStatsService _buildStats;

    public BuildRecommenderService(IGameDataService gameData, IBuildStatsService buildStats)
    {
        _gameData = gameData;
        _buildStats = buildStats;
    }

    public async Task<BuildRecommendation> RecommendBuildAsync(
        int championId, int[] enemyChampionIds, int[] allyChampionIds, string? role = null)
    {
        var champions = await _gameData.GetChampionsAsync();
        var items = await _gameData.GetCompletedItemsAsync();

        if (!champions.TryGetValue(championId, out var myChampion))
            throw new ArgumentException($"Champion {championId} not found");

        var enemies = enemyChampionIds
            .Where(id => champions.ContainsKey(id))
            .Select(id => ClassifyEnemy(champions[id]))
            .ToArray();

        var allies = allyChampionIds
            .Where(id => champions.ContainsKey(id))
            .Select(id => champions[id])
            .ToArray();

        var threatProfile = CalculateThreatProfile(enemies);
        var requestedRole = NormalizeRole(role, myChampion);

        // --- Historical data lookup with off-meta role fallback ---
        // Aatrox assigned UTILITY, Poppy assigned TOP despite being a support etc. — the
        // Riot API reports the in-game teamPosition which can differ from the champion's
        // natural role (players swap in lobby without switching picks). When the crawler
        // has zero picks for (champion, requestedRole), fall back to the champion's natural
        // positions from Meraki so we don't serve a nonsensical Enchanter build for Aatrox.
        var coreItemStats = await _buildStats.GetCoreItemsAsync(championId, requestedRole, count: 5);
        var effectiveRole = requestedRole;
        AnomalyInfo? anomaly = null;

        if (coreItemStats.Count == 0)
        {
            // Try each natural position for this champion, in Meraki's order (most common first).
            foreach (var naturalPosition in myChampion.Positions)
            {
                var naturalLane = naturalPosition.ToUpperInvariant();
                if (naturalLane == requestedRole) continue; // already queried above

                var fallback = await _buildStats.GetCoreItemsAsync(championId, naturalLane, count: 5);
                if (fallback.Count > 0)
                {
                    coreItemStats = fallback;
                    effectiveRole = naturalLane;
                    // Lane names go through their own lane.* translation keys on the
                    // frontend — we pass the raw role strings here so the client can
                    // localize them alongside the anomaly sentence.
                    anomaly = new AnomalyInfo
                    {
                        Key = "anomaly.offMeta",
                        Args = new Dictionary<string, object>
                        {
                            ["champion"] = myChampion.Name,
                            ["requestedLane"] = RoleToLaneKey(requestedRole),
                            ["naturalLane"] = RoleToLaneKey(naturalLane),
                        },
                    };
                    break;
                }
            }

            // Still nothing? Note that we're running on heuristics only.
            if (coreItemStats.Count == 0 && myChampion.Positions.Length > 0)
            {
                anomaly = new AnomalyInfo
                {
                    Key = "anomaly.noData",
                    Args = new Dictionary<string, object>
                    {
                        ["champion"] = myChampion.Name,
                        ["requestedLane"] = RoleToLaneKey(requestedRole),
                    },
                };
            }
        }

        var coreItemNames = coreItemStats.Select(s => s.ItemName).ToArray();

        // From here on use effectiveRole so archetype + filters + counter value all align
        // with the champion's natural kit, not the mismatched assignment.
        var normalizedRole = effectiveRole;

        // Fetch Tear of the Goddess (sub-component) once before building variants — it's
        // not in `items` (which is the COMPLETED-items pool), so we look it up from the
        // full Data Dragon pool via GetItemByIdAsync. Null-safe: if Riot ever removes it,
        // the rush-component hint just silently disappears.
        var tearComponent = await _gameData.GetItemByIdAsync(TearOfTheGoddessId);

        // Generate three build variants with different style biases. Each one runs
        // the full selection pipeline so its slot picks can differ even though the
        // champion core build stays the same. Labels + descriptions are translation
        // keys — the frontend resolves them via its t pipe.
        var variants = new List<BuildVariant>
        {
            BuildVariantFor(BuildStyle.Standard,   "build.variant.standard",   "build.variant.standard.description"),
            BuildVariantFor(BuildStyle.Aggressive, "build.variant.aggressive", "build.variant.aggressive.description"),
            BuildVariantFor(BuildStyle.Defensive,  "build.variant.defensive",  "build.variant.defensive.description"),
        };

        return new BuildRecommendation
        {
            ChampionId = championId,
            ChampionName = myChampion.Name,
            EnemyThreatProfile = threatProfile,
            Variants = variants,
            RequestedRole = requestedRole,
            EffectiveRole = effectiveRole,
            Anomaly = anomaly,
            SkillOrder = myChampion.SkillOrder,
        };

        BuildVariant BuildVariantFor(BuildStyle style, string labelKey, string descriptionKey)
        {
            var buildItems = BuildItemSet(myChampion, threatProfile, items, normalizedRole, allies, style, coreItemNames);
            var earlyComponents = DetectEarlyComponents(buildItems, tearComponent);
            return new BuildVariant
            {
                Style = style.ToString().ToLowerInvariant(),
                LabelKey = labelKey,
                DescriptionKey = descriptionKey,
                Items = buildItems,
                EarlyComponents = earlyComponents,
            };
        }
    }

    /// <summary>
    /// Maps the uppercase role string from Riot / LaneAssigner (TOP / JUNGLE / MIDDLE /
    /// BOTTOM / UTILITY) to the lane.* translation key the frontend renders. Used inside
    /// anomaly args so the client can localize the role name without the server shipping
    /// Polish locative forms.
    /// </summary>
    private static string RoleToLaneKey(string role) => role.ToUpperInvariant() switch
    {
        "TOP"     => "lane.top",
        "JUNGLE"  => "lane.jungle",
        "MIDDLE"  => "lane.middle",
        "BOTTOM"  => "lane.bottom",
        "UTILITY" => "lane.utility",
        _         => "lane.unknown",
    };

    /// <summary>
    /// Finds sub-components in the final build that should be purchased early. Today this
    /// is limited to Tear of the Goddess (for Manamune/Archangel's/Winter's Approach builds)
    /// — the Tear's passive stacks over time, so owning it as soon as possible materially
    /// improves the completed item. Even when the full item ends up in slot 3, the player
    /// should swing by the shop on an early back to pick up the Tear.
    /// </summary>
    private static List<EarlyComponent> DetectEarlyComponents(
        List<RecommendedItem> buildItems, ItemInfo? tearComponent)
    {
        var result = new List<EarlyComponent>();
        if (tearComponent is null) return result;

        // Check if any Tear-dependent item is in the build. We match by both id-membership
        // and by `BuildsFrom` containing Tear, so if Riot ever adds a new Tear item we
        // catch it automatically via the component graph.
        var tearFullItem = buildItems
            .Select(ri => ri.Item)
            .FirstOrDefault(it => TearDependentItemIds.Contains(it.Id)
                                  || (it.BuildsFrom?.Contains(TearOfTheGoddessId) ?? false));

        if (tearFullItem is null) return result;

        result.Add(new EarlyComponent
        {
            Component = tearComponent,
            BuildsInto = tearFullItem,
            ReasonKey = "earlyComponent.tearRush",
            ReasonArgs = new Dictionary<string, object> { ["item"] = tearFullItem.Name },
        });
        return result;
    }

    private enum BuildStyle { Standard, Aggressive, Defensive }

    private static string NormalizeRole(string? role, ChampionInfo champion)
    {
        if (!string.IsNullOrWhiteSpace(role))
        {
            var upper = role.Trim().ToUpperInvariant();
            return upper switch
            {
                "SUPPORT" or "UTILITY" => LaneAssigner.Utility,
                "BOT" or "ADC" or "BOTTOM" => LaneAssigner.Bottom,
                "MID" or "MIDDLE" => LaneAssigner.Middle,
                "JGL" or "JUNGLE" => LaneAssigner.Jungle,
                "TOP" => LaneAssigner.Top,
                _ => LaneAssigner.Middle,
            };
        }

        // Fallback if caller didn't pass a role — guess from champion positions.
        if (champion.Positions.Contains("UTILITY", StringComparer.OrdinalIgnoreCase))
            return LaneAssigner.Utility;
        if (champion.Positions.Contains("JUNGLE", StringComparer.OrdinalIgnoreCase))
            return LaneAssigner.Jungle;
        if (champion.Positions.Contains("BOTTOM", StringComparer.OrdinalIgnoreCase))
            return LaneAssigner.Bottom;
        if (champion.Positions.Contains("TOP", StringComparer.OrdinalIgnoreCase))
            return LaneAssigner.Top;
        return LaneAssigner.Middle;
    }

    private static EnemyClassification ClassifyEnemy(ChampionInfo champion)
    {
        var threatType = DetermineThreatType(champion);

        // Healing intensity: curated override wins when available because raw ability-text
        // parsing can't tell Soraka's triple heal from Bard's incidental Meep-passive heal.
        // For champs not in the tier table, fall back to Meraki-derived HealingIntensity
        // and the Marksman lifesteal baseline.
        double healingIntensity;
        if (HealingTierOverrides.TryGetValue(champion.Key, out var curatedHeal))
        {
            healingIntensity = curatedHeal;
        }
        else
        {
            healingIntensity = champion.HealingIntensity;
            if (healingIntensity <= 0 && champion.HasHealing)
                healingIntensity = 0.25;
            if (champion.Tags.Contains("Marksman"))
                healingIntensity = Math.Max(healingIntensity, 0.2);
        }

        // Shield intensity: curated only (no Meraki fallback). Champs outside the table
        // are assumed to have negligible shielding — which is correct for almost everyone
        // except the enchanter and tank-support archetypes the table already covers.
        ShieldTierOverrides.TryGetValue(champion.Key, out var shieldIntensity);

        // Engage/dive score — curated. No text-based fallback: "has a dash" is not the
        // same as "dives the backline". Unknown champs score 0 which is the safe default.
        EngageTierOverrides.TryGetValue(champion.Key, out var engageScore);

        // Long-range poke score — curated (same reasoning as engage: ability range is
        // hard to infer from text alone).
        PokeTierOverrides.TryGetValue(champion.Key, out var pokeScore);

        // True / %max-HP damage — curated. These bypass armor/MR or scale with target HP,
        // flipping the usual "stack HP vs assassins" recommendation toward resists.
        TrueDamageOverrides.TryGetValue(champion.Key, out var trueDamageScore);

        return new EnemyClassification
        {
            ChampionId = champion.Id,
            ChampionName = champion.Name,
            ChampionKey = champion.Key,
            PrimaryDamage = champion.DamageProfile.PrimaryDamageType,
            ThreatType = threatType,
            HasHealing = healingIntensity > 0.05,
            HealingIntensity = healingIntensity,
            ShieldIntensity = shieldIntensity,
            EngageScore = engageScore,
            PokeScore = pokeScore,
            TrueDamageScore = trueDamageScore,
            HasHardCC = champion.HasHardCC,
            CcScore = champion.CcScore,
            DamageRating = champion.AttributeRatings.Damage,
            TankScore = Math.Clamp(champion.AttributeRatings.Toughness / 5.0, 0, 1),
            Tags = champion.Tags,
        };
    }

    private static ThreatType DetermineThreatType(ChampionInfo champion)
    {
        var tags = champion.Tags;
        var attr = champion.AttributeRatings;

        if (attr.Toughness >= 3 && attr.Damage <= 2)
            return ThreatType.Tank;
        if (tags.Contains("Assassin"))
            return ThreatType.Burst;
        if (tags.Contains("Mage") && attr.Damage >= 3)
            return ThreatType.Burst;
        if (tags.Contains("Marksman"))
            return ThreatType.SustainedDps;
        if (attr.Utility >= 3 && attr.Damage <= 2)
            return ThreatType.Utility;

        return ThreatType.SustainedDps;
    }

    private static TeamThreatProfile CalculateThreatProfile(EnemyClassification[] enemies)
    {
        if (enemies.Length == 0)
            return new TeamThreatProfile();

        double adWeight = 0, apWeight = 0, tankTotal = 0, totalDamageWeight = 0;

        foreach (var e in enemies)
        {
            // Weight each champion's AD/AP contribution by Meraki's 1-3 damage rating so
            // enchanters/tanks who happen to deal magic (Bard, Taric, Braum) don't inflate
            // ApRatio the way a dedicated mage (Vel'Koz, Syndra) should. Floor at 0.4 so
            // low-damage champs still register a signal — they do land some damage.
            var damageWeight = Math.Max(0.4, e.DamageRating / 3.0);
            totalDamageWeight += damageWeight;

            switch (e.PrimaryDamage)
            {
                case DamageType.Physical: adWeight += damageWeight; break;
                case DamageType.Magic:    apWeight += damageWeight; break;
                case DamageType.Mixed:    adWeight += damageWeight * 0.5; apWeight += damageWeight * 0.5; break;
                case DamageType.True:     adWeight += damageWeight * 0.3; apWeight += damageWeight * 0.3; break;
            }

            tankTotal += e.TankScore;
        }

        // Max+avg blend for CC and healing. A plain average dilutes a single dominant
        // healer or CC dealer to near-zero in an otherwise damage-focused team — but in
        // practice a solo Soraka or Leona still makes anti-heal / tenacity a priority.
        // The 0.5/0.5 weight lets the strongest threat count as much as the team average,
        // matching how an experienced player reads a draft.
        //
        // Examples with this formula:
        //   • Yasuo/Hecarim/Velkoz/Bard/Taric (the team the user flagged):
        //       CC: max≈0.67, avg≈0.47 → ~0.57 (was 1.00 binary)
        //       Heal: max=0.70 Taric, avg≈0.25 → ~0.47 (was ~0.13 plain average)
        //   • Solo Soraka + 4 damage champs:
        //       Heal: max=1.00, avg≈0.20 → 0.60 (was 0.20 — Soraka now actually triggers
        //       anti-heal priority)
        //   • Full engage (Leona/Lissandra/Maokai/Nautilus/Amumu): CC ~0.97 (stays ~100%)
        var ccMax = enemies.Max(e => e.CcScore);
        var ccAvg = enemies.Average(e => e.CcScore);
        // Engage-vs-peel CC split: a champion whose EngageScore crosses 0.5 gets to
        // DELIVER their CC on top of me (Leona Q on flash), while pure peelers (Thresh/
        // Janna/Lulu) need to hit me from range with no frontline and rarely do. Tenacity
        // priority should follow the engage slice, not the raw sum.
        const double EngageCcCutoff = 0.5;
        var engageCcChamps = enemies.Where(e => e.EngageScore >= EngageCcCutoff).ToArray();
        var peelCcChamps = enemies.Where(e => e.EngageScore < EngageCcCutoff).ToArray();
        var engageCcMax = engageCcChamps.Length == 0 ? 0 : engageCcChamps.Max(e => e.CcScore);
        var engageCcAvg = engageCcChamps.Length == 0 ? 0 : engageCcChamps.Average(e => e.CcScore);
        var peelCcMax = peelCcChamps.Length == 0 ? 0 : peelCcChamps.Max(e => e.CcScore);
        var peelCcAvg = peelCcChamps.Length == 0 ? 0 : peelCcChamps.Average(e => e.CcScore);
        var healMax = enemies.Max(e => e.HealingIntensity);
        var healAvg = enemies.Average(e => e.HealingIntensity);
        var shieldMax = enemies.Max(e => e.ShieldIntensity);
        var shieldAvg = enemies.Average(e => e.ShieldIntensity);
        // Engage threat uses 0.6*max + 0.4*avg — one reliable engage champion (e.g., Malphite)
        // is the whole threat, teammates either amplify it or don't matter. Lean toward max.
        var engageMax = enemies.Max(e => e.EngageScore);
        var engageAvg = enemies.Average(e => e.EngageScore);
        // Poke threat behaves like engage — one artillery mage defines the lane, the other
        // 4 champs can't cancel the poke. Use the same max-leaning blend.
        var pokeMax = enemies.Max(e => e.PokeScore);
        var pokeAvg = enemies.Average(e => e.PokeScore);
        // True/%HP damage — again, a single Vayne/Kog/Cho is the whole problem. Max-leaning.
        var trueMax = enemies.Max(e => e.TrueDamageScore);
        var trueAvg = enemies.Average(e => e.TrueDamageScore);

        var count = (double)enemies.Length;
        return new TeamThreatProfile
        {
            AdRatio = Math.Clamp(totalDamageWeight > 0 ? adWeight / totalDamageWeight : 0, 0, 1),
            ApRatio = Math.Clamp(totalDamageWeight > 0 ? apWeight / totalDamageWeight : 0, 0, 1),
            HealingThreat = Math.Clamp(0.5 * healMax + 0.5 * healAvg, 0, 1),
            ShieldThreat = Math.Clamp(0.5 * shieldMax + 0.5 * shieldAvg, 0, 1),
            CcThreat = Math.Clamp(0.5 * ccMax + 0.5 * ccAvg, 0, 1),
            EngageCcThreat = Math.Clamp(0.5 * engageCcMax + 0.5 * engageCcAvg, 0, 1),
            PeelCcThreat = Math.Clamp(0.5 * peelCcMax + 0.5 * peelCcAvg, 0, 1),
            EngageThreat = Math.Clamp(0.6 * engageMax + 0.4 * engageAvg, 0, 1),
            PokeThreat = Math.Clamp(0.6 * pokeMax + 0.4 * pokeAvg, 0, 1),
            TrueDamageThreat = Math.Clamp(0.6 * trueMax + 0.4 * trueAvg, 0, 1),
            HasCritCarry = enemies.Any(e => CritCarryChampions.Contains(e.ChampionKey)),
            HasInvisibleEnemy = enemies.Any(e => InvisibleChampions.Contains(e.ChampionKey)),
            TankLevel = Math.Clamp(tankTotal / count, 0, 1),
            EnemyCount = enemies.Length,
            TankCount = enemies.Count(e => e.ThreatType == ThreatType.Tank),
            AssassinCount = enemies.Count(e => e.Tags.Contains("Assassin")),
            MageCount = enemies.Count(e => e.Tags.Contains("Mage")),
            MarksmanCount = enemies.Count(e => e.Tags.Contains("Marksman")),
            FighterCount = enemies.Count(e => e.Tags.Contains("Fighter")),
            BurstCount = enemies.Count(e => e.ThreatType == ThreatType.Burst),
        };
    }

    private static List<RecommendedItem> BuildItemSet(
        ChampionInfo champion, TeamThreatProfile threat, Dictionary<int, ItemInfo> allItems,
        string role, ChampionInfo[] allies, BuildStyle style, string[] coreItemNames)
    {
        var selected = new List<RecommendedItem>();
        var usedIds = new HashSet<int>();
        var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var skipBoots = string.Equals(champion.Key, CassiopeiaKey, StringComparison.OrdinalIgnoreCase);

        var isSupportRole = role == LaneAssigner.Utility;
        var isJungleRole = role == LaneAssigner.Jungle;

        var candidates = allItems.Values
            .Where(i => !i.Classification.IsJungleItem || isJungleRole)
            .Where(i => !i.Classification.IsSupportItem || isSupportRole)
            .ToList();

        // Step 1: pick boots first (unless Cassiopeia).
        if (!skipBoots)
        {
            var boots = PickBest(candidates, usedIds, usedNames, selected, champion, threat, role, allies, style, coreItemNames, bootsOnly: true);
            if (boots is not null)
                AddPick(boots, selected, usedIds, usedNames);
        }

        // Step 2: fill remaining slots with non-boots items by best score.
        var remainingSlots = TotalBuildSlots - selected.Count;
        for (int slot = 0; slot < remainingSlots; slot++)
        {
            var pick = PickBest(candidates, usedIds, usedNames, selected, champion, threat, role, allies, style, coreItemNames, bootsOnly: false);
            if (pick is null) break;
            AddPick(pick, selected, usedIds, usedNames);
        }

        // Step 3: reorder into a sensible build progression (boots stay at index 0).
        var allyCoversGw = !IsNaturalGwCarrier(champion) && allies.Any(IsNaturalGwCarrier);
        return ReorderForBuildProgression(selected, threat, allyCoversGw);
    }

    /// <summary>
    /// Reorders the final selection into a reasonable build order. Boots stay at index 0,
    /// then the non-boots items are sorted by "buy priority": core damage items first,
    /// urgent counter picks (anti-heal, tenacity) boosted when the threat is high, and
    /// pure defensive items pushed later unless the enemy has overwhelming burst.
    /// </summary>
    private static List<RecommendedItem> ReorderForBuildProgression(
        List<RecommendedItem> items, TeamThreatProfile threat, bool allyCoversGw)
    {
        var boots = items.Where(i => i.Item.Classification.IsBoots).ToList();
        var nonBoots = items.Where(i => !i.Item.Classification.IsBoots).ToList();

        var ordered = nonBoots
            .OrderByDescending(i => CalculateBuildPriority(i, threat, allyCoversGw))
            .ThenByDescending(i => i.Score)
            .ToList();

        var result = new List<RecommendedItem>(boots);
        result.AddRange(ordered);
        return result;
    }

    /// <summary>
    /// Healing threat that a Grievous Wounds item would actually mitigate. Shields are
    /// NOT reduced by GW, so when the enemy team sustains primarily through shields
    /// (Lulu/Janna/Karma comps) GW is a wasted slot — cut its effective weight in half
    /// so the recommender leans toward raw damage instead.
    /// </summary>
    private static double EffectiveHealingThreat(TeamThreatProfile threat)
    {
        if (threat.ShieldThreat > threat.HealingThreat)
            return threat.HealingThreat * 0.5;
        return threat.HealingThreat;
    }

    private static double CalculateBuildPriority(RecommendedItem rec, TeamThreatProfile threat, bool allyCoversGw)
    {
        var stats = rec.Item.Stats;
        var itemName = rec.Item.Name;
        // Start from the raw score — it already reflects archetype fit + counter value.
        double priority = rec.Score;

        // Urgent anti-heal vs sustain-heavy comps: push grievous items to rush-2nd/3rd slot.
        // Only when healing is the dominant sustain — shields need a different counter.
        // Also skip the rush push when an ally is the natural GW carrier; we don't need
        // two team members racing to buy Mortal Reminder first.
        if (stats.HasGrievousWounds && EffectiveHealingThreat(threat) >= 0.4 && !allyCoversGw)
            priority += 12;

        // Urgent tenacity vs CC-heavy comps. Use the *engage* CC slice, not the raw total
        // — a team of 5 peel supports has high CcThreat but their Thresh hooks / Janna
        // tornadoes never reach me mid-fight. Tenacity rush is about surviving Leona Q →
        // Malphite R → dead-in-2-seconds, which only matters when the CC is attached to
        // engage tools.
        if (stats.HasTenacity && threat.EngageCcThreat >= 0.5)
            priority += 8;

        // Anti-engage actives (Zhonya/EoN/Banshee/Gargoyle) vs dive-heavy comps. The raw
        // score already gives them some baseline based on burst/assassin count, but
        // engage-specific threat deserves an explicit rush bonus — a slot-3 Zhonya saves
        // you from a Malphite R that a slot-6 Zhonya never gets to.
        if (threat.EngageThreat >= 0.55 && AntiEngageItemNames.Contains(itemName))
            priority += 10;

        // Anti-poke sustain items (Rod of Ages/Warmog/Maw/Spirit Visage) vs artillery comps.
        // These need to come EARLY — they solve the lane phase, not the late game.
        if (threat.PokeThreat >= 0.55 && AntiPokeItemNames.Contains(itemName))
            priority += 9;

        // Pure defensive items (no damage output) normally come late, unless the enemy
        // team is exploding us in 2 seconds — then they're worth rushing.
        var hasOwnDamage = stats.AttackDamage > 0 || stats.AbilityPower > 0
                           || stats.Lethality > 0 || stats.CritChance > 0 || stats.AttackSpeed > 0;
        var isPureDefensive = !hasOwnDamage
                              && (stats.Armor > 0 || stats.MagicResist > 0 || stats.Health >= 300);
        var burstPressure = threat.BurstCount >= 3 || threat.AssassinCount >= 2;
        if (isPureDefensive && !burstPressure)
            priority -= 18;

        return priority;
    }

    private sealed record ItemPick(ItemInfo Item, double Score, List<RecommendationReason> Reasons);

    private static ItemPick? PickBest(
        List<ItemInfo> candidates,
        HashSet<int> usedIds,
        HashSet<string> usedNames,
        List<RecommendedItem> selected,
        ChampionInfo champion,
        TeamThreatProfile threat,
        string role,
        ChampionInfo[] allies,
        BuildStyle style,
        string[] coreItemNames,
        bool bootsOnly)
    {
        ItemPick? best = null;

        foreach (var item in candidates)
        {
            if (usedIds.Contains(item.Id)) continue;
            if (usedNames.Contains(item.Name)) continue;
            if (bootsOnly)
            {
                if (!item.Classification.IsBoots) continue;
            }
            else
            {
                if (item.Classification.IsBoots) continue;
            }
            if (!PassesSlotConstraints(item, selected)) continue;

            var (score, reasons) = ScoreItem(item, champion, threat, selected, role, allies, style, coreItemNames);
            if (best is null || score > best.Score)
            {
                best = new ItemPick(item, score, reasons);
            }
        }

        return best;
    }

    private static void AddPick(
        ItemPick pick, List<RecommendedItem> selected, HashSet<int> usedIds, HashSet<string> usedNames)
    {
        selected.Add(new RecommendedItem
        {
            Item = pick.Item,
            Score = Math.Round(pick.Score, 1),
            Reasons = pick.Reasons,
        });
        usedIds.Add(pick.Item.Id);
        usedNames.Add(pick.Item.Name);
    }

    private static bool PassesSlotConstraints(ItemInfo item, List<RecommendedItem> selected)
    {
        // Defence-in-depth: dedup by id and name in case Data Dragon exposes duplicate entries.
        if (selected.Any(s => s.Item.Id == item.Id
            || string.Equals(s.Item.Name, item.Name, StringComparison.OrdinalIgnoreCase)))
            return false;
        if (item.Classification.IsBoots && selected.Any(s => s.Item.Classification.IsBoots))
            return false;
        if (item.Stats.HasGrievousWounds && selected.Any(s => s.Item.Stats.HasGrievousWounds))
            return false;
        if (item.Classification.IsSupportItem && selected.Any(s => s.Item.Classification.IsSupportItem))
            return false;

        // Functional exclusion: if this item belongs to a "pick-one-of" group, skip it
        // when another member of the group is already in the build (e.g., LDR blocks
        // Serylda's Grudge and vice versa — they overlap in %armor pen and shared components).
        foreach (var group in FunctionalExclusionGroups)
        {
            var itemInGroup = group.Contains(item.Name, StringComparer.OrdinalIgnoreCase);
            if (!itemInGroup) continue;

            var alreadyHaveGroupMember = selected.Any(s =>
                group.Contains(s.Item.Name, StringComparer.OrdinalIgnoreCase));
            if (alreadyHaveGroupMember) return false;
        }

        return true;
    }

    private static (double score, List<RecommendationReason> reasons) ScoreItem(
        ItemInfo item, ChampionInfo champion, TeamThreatProfile threat,
        List<RecommendedItem> selected, string role, ChampionInfo[] allies, BuildStyle style,
        string[] coreItemNames)
    {
        double score = 0;
        var reasons = new List<RecommendationReason>();

        // === A. Archetype Fit (-60 to +90) — strong signal of whether this item belongs on this champ ===
        score += CalculateArchetypeFit(item, champion, role, coreItemNames);

        // === B. Counter Value (0-55) ===
        var (counterScore, counterReasons) = CalculateCounterValue(item, champion, threat, role, allies);
        score += counterScore;
        reasons.AddRange(counterReasons);

        // === C. Synergy (-15 to +10) ===
        score += CalculateSynergy(item, champion, selected);

        // === D. Role Penalties & Bonuses ===
        score += CalculateRoleBias(item, champion, role);

        // === E. Historical Core Build Boost (+50 to +90) — pulled from Riot Match API stats
        //    for this patch. Empty list = no boost applied, falls back to archetype + counter. ===
        var coreBoost = CalculateChampionCoreBoost(item, coreItemNames);
        if (coreBoost.Rank >= 0)
        {
            score += coreBoost.Score;
            // Pro meta reason goes at index 0 so it shows as the first bullet — players
            // care most about "this is the meta pick" before any counter bonus.
            reasons.Insert(0, new RecommendationReason
            {
                Key = "reason.proMeta",
                Args = new Dictionary<string, object>
                {
                    ["champion"] = champion.Name,
                    ["rank"] = coreBoost.Rank + 1,
                    ["total"] = coreBoost.Total,
                },
            });
        }

        // === F. Ally Synergy — e.g. Ardent Censer great with Jinx/Kaisa, bad with Yasuo/Yone ===
        var (synergyScore, synergyReason) = CalculateAllySynergy(item, role, allies);
        score += synergyScore;
        if (synergyReason is not null)
            reasons.Add(synergyReason);

        // === G. Build Style Modifier — tilts non-core slots toward damage/defense ===
        score += CalculateStyleModifier(item, style);

        if (reasons.Count == 0 && score > 0)
        {
            reasons.Add(new RecommendationReason
            {
                Key = "reason.goodItem",
                Args = new Dictionary<string, object> { ["champion"] = champion.Name },
            });
        }

        return (score, reasons);
    }

    /// <summary>
    /// Aggressive/Defensive styles nudge secondary slots toward damage or survival.
    /// Core items aren't affected in practice because their +50–90 boost dwarfs the ±20 style swing,
    /// so the three variants share the same "must-buy" items but differ on the situational picks.
    /// </summary>
    private static double CalculateStyleModifier(ItemInfo item, BuildStyle style)
    {
        if (style == BuildStyle.Standard) return 0;
        if (item.Classification.IsBoots) return 0;

        var s = item.Stats;

        if (style == BuildStyle.Aggressive)
        {
            double bonus = 0;
            if (s.AttackDamage > 0) bonus += 10;
            if (s.AbilityPower > 0) bonus += 10;
            if (s.CritChance > 0) bonus += 9;
            if (s.Lethality > 0) bonus += 9;
            if (s.ArmorPen > 0) bonus += 6;
            if (s.MagicPen > 0) bonus += 9;
            if (s.AttackSpeed > 0) bonus += 6;

            // Pure defensive items (resist/HP with no offensive stat) get pushed out.
            var hasOwnDamage = s.AttackDamage > 0 || s.AbilityPower > 0
                               || s.Lethality > 0 || s.CritChance > 0 || s.AttackSpeed > 0;
            var pureDefensive = !hasOwnDamage
                                && (s.Armor > 0 || s.MagicResist > 0 || s.Health >= 300);
            if (pureDefensive) bonus -= 20;

            return bonus;
        }

        if (style == BuildStyle.Defensive)
        {
            double bonus = 0;
            if (s.Health >= 200) bonus += 10;
            if (s.Armor > 0) bonus += 12;
            if (s.MagicResist > 0) bonus += 12;
            if (s.AbilityHaste > 0) bonus += 3;

            // Soft penalty on fragile damage items that give no survivability.
            var pureOffensive = (s.CritChance > 0 || s.Lethality > 0)
                                && s.Armor == 0 && s.MagicResist == 0 && s.Health == 0;
            if (pureOffensive) bonus -= 10;

            return bonus;
        }

        return 0;
    }

    private readonly record struct CoreBoost(double Score, int Rank, int Total)
    {
        public static readonly CoreBoost None = new(0, -1, 0);
    }

    private static CoreBoost CalculateChampionCoreBoost(ItemInfo item, string[] coreItemNames)
    {
        if (coreItemNames.Length == 0) return CoreBoost.None;

        var rank = IndexOfName(coreItemNames, item.Name);
        if (rank < 0) return CoreBoost.None;

        // Rank 0 (most important): +90. Each subsequent rank drops by 10.
        // Rank 4 floor at +50 — enough that a core item's base+boost beats any non-core
        // item's archetype fit (≤90) alone without a strong counter value tailwind.
        var boost = Math.Max(50, 90 - rank * 10);
        return new CoreBoost(boost, rank, coreItemNames.Length);
    }

    private static int IndexOfName(string[] names, string target)
    {
        for (int i = 0; i < names.Length; i++)
        {
            if (string.Equals(names[i], target, StringComparison.OrdinalIgnoreCase))
                return i;
        }
        return -1;
    }

    private static (double score, RecommendationReason? reason) CalculateAllySynergy(
        ItemInfo item, string role, ChampionInfo[] allies)
    {
        // Ally synergy currently applies only to the support role — the main case is
        // Ardent Censer / Staff of Flowing Water depending on which ADC you're laning with.
        if (role != LaneAssigner.Utility || allies is null || allies.Length == 0)
            return (0, null);

        var name = item.Name;

        // Ardent Censer — auto-attack speed aura. Good for AS marksmen, weak for crit/burst carries.
        if (string.Equals(name, "Ardent Censer", StringComparison.OrdinalIgnoreCase))
        {
            var friendly = allies.FirstOrDefault(a => ArdentFriendlyCarries.Contains(a.Key));
            if (friendly is not null)
                return (15, new RecommendationReason
                {
                    Key = "reason.synergy.ardentFriendly",
                    Args = new Dictionary<string, object> { ["ally"] = friendly.Name },
                });

            var unfriendly = allies.FirstOrDefault(a => ArdentUnfriendlyCarries.Contains(a.Key));
            if (unfriendly is not null)
                return (-25, new RecommendationReason
                {
                    Key = "reason.synergy.ardentUnfriendly",
                    Args = new Dictionary<string, object> { ["ally"] = unfriendly.Name },
                });
        }

        // Staff of Flowing Water — on heal/shield grants AP + MS to ally. Benefits most
        // carries but really shines with AP/on-hit carries like Kai'Sa.
        if (string.Equals(name, "Staff of Flowing Water", StringComparison.OrdinalIgnoreCase))
        {
            var unfriendly = allies.FirstOrDefault(a => ArdentUnfriendlyCarries.Contains(a.Key));
            if (unfriendly is not null && !allies.Any(a => ArdentFriendlyCarries.Contains(a.Key)))
                return (-10, new RecommendationReason
                {
                    Key = "reason.synergy.flowingWaterMediocre",
                    Args = new Dictionary<string, object> { ["ally"] = unfriendly.Name },
                });
        }

        return (0, null);
    }

    private enum BuildArchetype
    {
        Mage,        // Pure caster: Morgana, Lux, Syndra, Brand, Vel'Koz, Ahri
        AdCarry,     // Crit-based ADC: Jinx, Caitlyn, Aphelios, Jhin, Kai'Sa
        Assassin,    // Lethality burst: Zed, Talon, Qiyana, Khazix, LeBlanc
        AdBruiser,   // AD bruiser/fighter: Darius, Camille, Sett, Jax, Olaf
        ApBruiser,   // AP bruiser: Mordekaiser, Vladimir, Rumble, Swain, Sylas
        Tank,        // Pure tank: Malphite, Ornn, Leona, Rammus, Alistar
        Enchanter,   // Heal/shield support: Soraka, Janna, Nami, Yuumi, Lulu, Morgana-sup
        Skirmisher,  // Hybrid DPS fighters: Yasuo, Yone, Tryndamere, Master Yi
    }

    private static BuildArchetype DetermineArchetype(ChampionInfo champ, string role)
    {
        var tags = champ.Tags;
        var attr = champ.AttributeRatings;
        var isAP = champ.AdaptiveType.Contains("MAGIC", StringComparison.OrdinalIgnoreCase);

        // Support role → Enchanter, UNLESS the champion is a caster-mage support.
        // Zyra, Brand, Xerath, Vel'Koz, damage-Morgana and damage-Lux build full AP
        // (Liandry's / Rylai's / Rabadon / Shadowflame), not enchanter utility items.
        // They're identified by the Mage tag + high Damage attribute rating from Meraki.
        if (role == LaneAssigner.Utility && !tags.Contains("Marksman"))
        {
            var isCasterSupport = tags.Contains("Mage") && attr.Damage >= 3;
            if (!isCasterSupport)
                return BuildArchetype.Enchanter;
            // Fall through — caster supports get routed into the Mage branch below.
        }

        if (tags.Contains("Marksman"))
            return BuildArchetype.AdCarry;

        // Crit-based fighters — ad-hoc catch for "Fighter + Assassin" AD hybrids that build crit (Yasuo/Yone/Tryndamere).
        var isFighterAssassin = tags.Contains("Fighter") && tags.Contains("Assassin") && !isAP;
        if (isFighterAssassin)
            return BuildArchetype.Skirmisher;

        // Pure tank: high toughness, low damage.
        if (attr.Toughness >= 3 && attr.Damage <= 2)
            return BuildArchetype.Tank;

        // Bruisers: tanky + damage. Split by adaptive type.
        var hasFrontlineTag = tags.Contains("Tank") || tags.Contains("Fighter");
        if (hasFrontlineTag && attr.Damage >= 2 && attr.Toughness >= 2)
            return isAP ? BuildArchetype.ApBruiser : BuildArchetype.AdBruiser;

        if (tags.Contains("Assassin") && !isAP)
            return BuildArchetype.Assassin;

        if (tags.Contains("Mage") || isAP)
            return BuildArchetype.Mage;

        // Fallback: AD fighters without tank stats land in AdBruiser (e.g., Riven).
        if (tags.Contains("Fighter"))
            return isAP ? BuildArchetype.ApBruiser : BuildArchetype.AdBruiser;

        return isAP ? BuildArchetype.Mage : BuildArchetype.Assassin;
    }

    /// <summary>
    /// Archetype-aware item fit. Returns a signed score — off-archetype items go deeply negative
    /// so they can't be rescued by a single counter bonus (e.g., Sunfire on Morgana).
    /// Range is roughly [-50, +55], boots always get a small positive so their dedicated slot stays fair.
    /// Items on the hardcoded champion core build get a non-negative floor — the core list is
    /// the source of truth and shouldn't be vetoed by stat heuristics.
    /// </summary>
    private static double CalculateArchetypeFit(ItemInfo item, ChampionInfo champion, string role, string[] coreItemNames)
    {
        var stats = item.Stats;

        // Boots never get penalized for "wrong stats" — their own slot ensures a boot is always chosen,
        // and the relative ranking between boots works off CounterValue and RoleBias instead.
        if (item.Classification.IsBoots)
            return 5;

        var archetype = DetermineArchetype(champion, role);

        // Resourceless (energy/fury/rage/etc.) champions don't want mana items.
        var manaPenalty = champion.Resourceless && stats.Mana > 0 ? -6 : 0;

        var baseScore = archetype switch
        {
            BuildArchetype.Mage => ScoreMage(stats),
            BuildArchetype.AdCarry => ScoreAdCarry(stats),
            BuildArchetype.Assassin => ScoreAssassin(stats),
            BuildArchetype.AdBruiser => ScoreAdBruiser(stats),
            BuildArchetype.ApBruiser => ScoreApBruiser(stats),
            BuildArchetype.Tank => ScoreTank(stats),
            BuildArchetype.Enchanter => ScoreEnchanter(item),
            BuildArchetype.Skirmisher => ScoreSkirmisher(stats),
            _ => 0,
        };

        var result = Math.Clamp(baseScore + manaPenalty, -60, 90);

        // Items on the historical core build for this champion+role override the archetype
        // penalties — if pro stats say Morgana-sup builds Rabadon's Deathcap, don't let
        // ScoreEnchanter's looksLikeMageBurst penalty drag it below zero. Core list is
        // authoritative because it reflects real winning builds, not heuristic guesses.
        var isInCore = IndexOfName(coreItemNames, item.Name) >= 0;
        if (isInCore && result < 0)
            return 0;

        return result;
    }

    // --- Archetype scoring tables ---
    // Each table reflects "what this build is trying to buy" with large penalties for obvious mismatches.
    // The goal is that a single wrong stat tanks the item below any counter bonus it might pick up.

    private static double ScoreMage(ItemStats s)
    {
        double score = 0;
        if (s.AbilityPower > 0) score += 30;
        else score -= 30;                            // no AP = not a mage item
        if (s.AbilityHaste > 0) score += 8;
        if (s.MagicPen > 0) score += 15;
        if (s.Mana > 0) score += 3;
        if (s.Health > 0) score += 2;                // HP on mage items is fine (battlemage bonus)
        if (s.AttackDamage > 0) score -= 35;
        if (s.CritChance > 0) score -= 45;
        if (s.AttackSpeed > 0) score -= 25;
        if (s.Lethality > 0) score -= 30;
        return score;
    }

    private static double ScoreAdCarry(ItemStats s)
    {
        double score = 0;
        if (s.AttackDamage > 0) score += 18;
        if (s.CritChance > 0) score += 22;
        if (s.AttackSpeed > 0) score += 14;
        if (s.ArmorPen > 0) score += 8;
        if (s.LifeSteal > 0) score += 8;
        if (s.Lethality > 0) score -= 5;             // ADC prefers crit path; small deprioritization
        if (s.AbilityHaste > 0) score += 2;
        if (s.AbilityPower > 0) score -= 45;
        if (s.MagicPen > 0) score -= 25;
        if (s.Mana > 0) score -= 3;
        if (s.Armor > 0) score -= 10;
        if (s.MagicResist > 0) score -= 10;
        return score;
    }

    private static double ScoreAssassin(ItemStats s)
    {
        double score = 0;
        if (s.AttackDamage > 0) score += 18;
        if (s.Lethality > 0) score += 22;
        if (s.ArmorPen > 0) score += 10;
        if (s.AbilityHaste > 0) score += 8;
        if (s.Health > 0) score += 2;
        if (s.CritChance > 0) score -= 20;
        if (s.AttackSpeed > 0) score -= 10;
        if (s.AbilityPower > 0) score -= 45;
        if (s.MagicPen > 0) score -= 20;
        return score;
    }

    private static double ScoreAdBruiser(ItemStats s)
    {
        double score = 0;
        if (s.AttackDamage > 0) score += 16;
        if (s.Health > 0) score += 10;
        if (s.AbilityHaste > 0) score += 10;
        if (s.Armor > 0) score += 3;
        if (s.MagicResist > 0) score += 3;
        if (s.ArmorPen > 0) score += 6;
        if (s.Lethality > 0) score += 3;
        if (s.CritChance > 0) score -= 5;            // soft discourage, some bruisers crit (Trinity/Essence)
        if (s.AttackSpeed > 0) score += 2;
        if (s.AbilityPower > 0) score -= 40;
        if (s.MagicPen > 0) score -= 25;
        return score;
    }

    private static double ScoreApBruiser(ItemStats s)
    {
        double score = 0;
        if (s.AbilityPower > 0) score += 18;
        if (s.Health > 0) score += 12;
        if (s.AbilityHaste > 0) score += 10;
        if (s.MagicPen > 0) score += 8;
        if (s.Armor > 0) score += 2;
        if (s.MagicResist > 0) score += 2;
        if (s.AttackDamage > 0) score -= 40;
        if (s.CritChance > 0) score -= 40;
        if (s.Lethality > 0) score -= 25;
        return score;
    }

    private static double ScoreTank(ItemStats s)
    {
        double score = 0;
        if (s.Health > 0) score += 16;
        if (s.Armor > 0) score += 12;
        if (s.MagicResist > 0) score += 12;
        if (s.AbilityHaste > 0) score += 6;
        if (s.AttackDamage > 0) score -= 35;
        if (s.AbilityPower > 0) score -= 35;
        if (s.CritChance > 0) score -= 45;
        if (s.AttackSpeed > 0) score -= 25;
        if (s.Lethality > 0) score -= 40;
        if (s.ArmorPen > 0) score -= 20;
        if (s.MagicPen > 0) score -= 20;
        return score;
    }

    private static double ScoreEnchanter(ItemInfo item)
    {
        var s = item.Stats;
        var cls = item.Classification;
        double score = 0;

        // Priority: hardcoded whitelist of canonical enchanter items (Ardent, Moonstone,
        // Mikael's, Redemption, Locket, Staff of Flowing Water, Echoes of Helia, etc.).
        // Without this boost the archetype scoring can't distinguish them from generic
        // AP/AH items like Morellonomicon, because Data Dragon doesn't expose "Heal & Shield Power".
        var isCoreEnchanter = CoreEnchanterItemIds.Contains(item.Id);
        if (isCoreEnchanter) score += 50;

        // Quest-line support items (Bloodsong/Dream Maker/Bulwark/Pauldrons/Celestial Opposition)
        // are detected via the transitive BuildsFrom chain in DataDragonService. Boost them too.
        if (cls.IsSupportItem) score += 30;

        if (s.AbilityHaste > 0) score += 14;
        if (s.AbilityPower > 0) score += 8;
        if (s.Mana > 0) score += 5;
        if (s.Health > 0) score += 3;
        if (s.Armor > 0) score += 2;
        if (s.MagicResist > 0) score += 2;

        // Hard no-go stats on an enchanter.
        if (s.CritChance > 0) score -= 45;
        if (s.Lethality > 0) score -= 40;
        if (s.AttackSpeed > 0) score -= 30;
        if (s.AttackDamage > 0) score -= 30;

        // Mage-burst items (Shadowflame, Stormsurge, Morellonomicon, Malignance, Horizon Focus…)
        // accidentally score well here because they share AP+AH with real enchanter items.
        // If it's not on the whitelist and doesn't build from a support quest item, penalize.
        var looksLikeMageBurst = !isCoreEnchanter
            && !cls.IsSupportItem
            && s.AbilityPower >= 60
            && s.MagicPen > 0;
        if (looksLikeMageBurst) score -= 30;

        // Generic mage-bruiser / battlemage items with HP+AP but no enchanter utility
        // (Riftmaker, Rylai's, Liandry's, Rod of Ages, Everfrost). Not outright bad but
        // should lose to real enchanter picks.
        var looksLikeBattlemage = !isCoreEnchanter
            && !cls.IsSupportItem
            && s.AbilityPower >= 60
            && s.Health >= 300;
        if (looksLikeBattlemage) score -= 22;

        // Pure tank items (Spirit Visage, Abyssal Mask, Warmog, Thornmail, Jak'Sho…) — they
        // tempt the scorer via Counter Value's "MR vs AP team" + "HP vs assassins" bonuses.
        var looksLikeTank = !isCoreEnchanter
            && s.AbilityPower == 0
            && s.Health >= 300
            && (s.Armor > 0 || s.MagicResist > 0);
        if (looksLikeTank) score -= 30;

        return score;
    }

    private static double ScoreSkirmisher(ItemStats s)
    {
        // Yasuo/Yone/Tryndamere/Master Yi: AD, crit, AS all OK.
        double score = 0;
        if (s.AttackDamage > 0) score += 14;
        if (s.CritChance > 0) score += 16;
        if (s.AttackSpeed > 0) score += 12;
        if (s.ArmorPen > 0) score += 6;
        if (s.LifeSteal > 0) score += 6;
        if (s.Health > 0) score += 4;
        if (s.AbilityHaste > 0) score += 3;
        if (s.AbilityPower > 0) score -= 40;
        if (s.Lethality > 0) score -= 5;
        return score;
    }

    /// <summary>
    /// Is this champion a "natural" Grievous Wounds carrier for their role? Natural GW
    /// carriers are picks that will reach a GW item in their core build regardless of
    /// the recommender — typically AD marksmen (Mortal Reminder) and AD bruiser/assassins
    /// (Chempunk Chainsword, Executioner's Calling component). Mages sometimes go
    /// Morellonomicon but less reliably — they're treated as non-natural so the
    /// recommender can still push it if healing threat is extreme.
    /// </summary>
    private static bool IsNaturalGwCarrier(ChampionInfo champion)
    {
        var tags = champion.Tags;
        if (tags.Contains("Marksman")) return true;
        var isPhysical = champion.AdaptiveType.Contains("PHYSICAL", StringComparison.OrdinalIgnoreCase);
        if (isPhysical && (tags.Contains("Assassin") || tags.Contains("Fighter")))
            return true;
        return false;
    }

    private static (double score, List<RecommendationReason> reasons) CalculateCounterValue(
        ItemInfo item, ChampionInfo champion, TeamThreatProfile threat, string role, ChampionInfo[] allies)
    {
        double score = 0;
        var reasons = new List<RecommendationReason>();
        // Local helpers: R() builds a RecommendationReason with optional args inline —
        // keeps every call site below a single line. Pct() converts 0..1 fractions to
        // integer percent values the UI renders (0.658 → 66).
        static RecommendationReason R(string key, Dictionary<string, object>? args = null)
            => new() { Key = key, Args = args };
        static int Pct(double v) => (int)Math.Round(v * 100);

        var stats = item.Stats;
        var isAD = champion.AdaptiveType.Contains("PHYSICAL", StringComparison.OrdinalIgnoreCase);
        var isAP = champion.AdaptiveType.Contains("MAGIC", StringComparison.OrdinalIgnoreCase);
        var isSquishy = !champion.Tags.Contains("Tank") && !champion.Tags.Contains("Fighter");
        var isSupportRole = role == LaneAssigner.Utility;

        // Ally anti-heal coverage: if the team already has a natural GW carrier (usually
        // a marksman ally) and I'm NOT that carrier, the team will still get anti-heal
        // without me spending a slot on Morellonomicon/Chempunk. Reduce my GW bonus so
        // mid AP / top bruiser / support picks lean into damage instead of duplicating.
        var iAmNaturalGwCarrier = IsNaturalGwCarrier(champion);
        var allyWillCarryGw = !iAmNaturalGwCarrier && allies.Any(IsNaturalGwCarrier);

        if (threat.AdRatio > 0.5 && stats.Armor > 0)
        {
            score += threat.AdRatio * 20;
            reasons.Add(R("reason.armorVsAd",
                new Dictionary<string, object> { ["percent"] = Pct(threat.AdRatio) }));
        }

        if (threat.ApRatio > 0.5 && stats.MagicResist > 0)
        {
            score += threat.ApRatio * 20;
            reasons.Add(R("reason.mrVsAp",
                new Dictionary<string, object> { ["percent"] = Pct(threat.ApRatio) }));
        }

        if (stats.HasGrievousWounds)
        {
            // Use effective healing — if enemies sustain through shields instead of
            // heals, GW buys us almost nothing and we'd rather spend the slot on damage.
            var effectiveHeal = EffectiveHealingThreat(threat);
            if (effectiveHeal > 0.2)
            {
                // Ally coverage: if the marksman is almost certainly going to buy GW,
                // a second GW on me is a wasted item slot 80% of the time. Cut the
                // bonus by 60% so damage/utility items win that slot instead.
                var coverageMultiplier = allyWillCarryGw ? 0.4 : 1.0;
                score += effectiveHeal * 25 * coverageMultiplier;
                if (allyWillCarryGw)
                    reasons.Add(R("reason.gwAllyCovered"));
                else if (threat.ShieldThreat > threat.HealingThreat)
                    reasons.Add(R("reason.gwVsShields",
                        new Dictionary<string, object> { ["percent"] = Pct(threat.ShieldThreat) }));
                else
                    reasons.Add(R("reason.gwVsHealing"));
            }
        }

        // Tank-pen bonuses only make sense for damage dealers — an enchanter doesn't
        // solve tank enemies with penetration, they solve it via allied damage buffs.
        if (!isSupportRole)
        {
            if (threat.TankCount >= 2)
            {
                if (isAD && (stats.ArmorPen > 0 || stats.Lethality > 0))
                {
                    score += 10 + threat.TankCount * 4;
                    reasons.Add(R("reason.armorPenCount",
                        new Dictionary<string, object> { ["count"] = threat.TankCount }));
                }
                if (isAP && stats.MagicPen > 0)
                {
                    score += 10 + threat.TankCount * 4;
                    reasons.Add(R("reason.magicPenCount",
                        new Dictionary<string, object> { ["count"] = threat.TankCount }));
                }
            }
            else if (threat.TankLevel > 0.3)
            {
                if (stats.ArmorPen > 0 || stats.Lethality > 0)
                {
                    score += threat.TankLevel * 15;
                    reasons.Add(R("reason.armorPen"));
                }
                if (stats.MagicPen > 0)
                {
                    score += threat.TankLevel * 12;
                    reasons.Add(R("reason.magicPen"));
                }
            }
        }

        // Anti-assassin / anti-burst HP bonuses are for carries (mage/adc/assassin)
        // staying alive. Enchanters handle burst threats with Mikael's/Locket/shields
        // on whitelist, not by buying Morellonomicon for HP.
        if (!isSupportRole)
        {
            if (threat.AssassinCount >= 2 && isSquishy)
            {
                if (stats.Health >= 300)
                {
                    score += 8 + threat.AssassinCount * 3;
                    reasons.Add(R("reason.hpVsAssassins",
                        new Dictionary<string, object> { ["count"] = threat.AssassinCount }));
                }
                if (stats.Armor > 0 && threat.AdRatio > 0.3)
                {
                    score += 5;
                }
            }

            if (threat.BurstCount >= 3 && isSquishy && stats.Health >= 300
                && (stats.Armor > 0 || stats.MagicResist > 0))
            {
                score += 6;
                reasons.Add(R("reason.defVsBurst",
                    new Dictionary<string, object> { ["count"] = threat.BurstCount }));
            }
        }

        if (stats.HasTenacity)
        {
            // Scoring: engage-CC slice drives tenacity value for squishy carries. Tanks
            // and frontliners take peel CC to the face too, so they still care about the
            // raw CcThreat — fall back to the max of the two for non-squishy roles.
            var relevantCc = isSquishy
                ? threat.EngageCcThreat
                : Math.Max(threat.EngageCcThreat, threat.CcThreat);
            if (relevantCc > 0.4)
            {
                score += relevantCc * 15;
                reasons.Add(R("reason.tenacity",
                    new Dictionary<string, object> { ["percent"] = Pct(relevantCc) }));
            }
        }

        // Anti-engage actives: when enemies have reliable dive (Malphite/Amumu/Leona/…)
        // squishy carries get a strong bonus for Zhonya's/EoN/Banshee's/Gargoyle's on top
        // of the generic burst-defense bonus above. These items win fights the penetration
        // items don't — stasis is the only counter to a point-and-click ultimate.
        if (threat.EngageThreat > 0.5 && isSquishy && AntiEngageItemNames.Contains(item.Name))
        {
            score += threat.EngageThreat * 18;
            reasons.Add(R("reason.antiEngage",
                new Dictionary<string, object> { ["percent"] = Pct(threat.EngageThreat) }));
        }

        // Anti-poke HP/sustain items: Rod of Ages, Warmog's, Maw, Spirit Visage, Force of
        // Nature. Only for non-support roles (enchanters already have the laning-phase
        // tools baked into their support items). Maw is AD-only — the hashset includes it
        // but the raw-stat archetype scoring already gates AP champions off of it.
        if (threat.PokeThreat > 0.45 && !isSupportRole && AntiPokeItemNames.Contains(item.Name))
        {
            score += threat.PokeThreat * 16;
            reasons.Add(R("reason.antiPoke",
                new Dictionary<string, object> { ["percent"] = Pct(threat.PokeThreat) }));
        }

        // Randuin's Omen passive specifically reduces incoming crit damage. Only valuable
        // when the enemy team actually has a crit carry — against a lethality Varus or
        // on-hit Kog'Maw it's a dead passive.
        if (threat.HasCritCarry && string.Equals(item.Name, "Randuin's Omen", StringComparison.OrdinalIgnoreCase))
        {
            score += 10;
            reasons.Add(R("reason.randuinVsCrit"));
        }

        // True / %max-HP damage flips the HP-vs-resists calculus. When the enemy has a
        // Vayne / Kog'Maw / Fiora / Cho'Gath, raw HP stacking is actively bad because:
        //   • True damage isn't reduced by either HP or resists, so HP scaling buys you
        //     nothing against it.
        //   • %max-HP damage GROWS with your HP pool, so Warmog's actually makes you take
        //     MORE damage from Vayne W, not less.
        // Counter: buy armor/MR instead. Resists still reduce the non-true-damage portion,
        // and you don't feed the %HP mechanic.
        if (threat.TrueDamageThreat > 0.4 && isSquishy && !isSupportRole)
        {
            if (stats.Armor >= 30 || stats.MagicResist >= 30)
            {
                score += threat.TrueDamageThreat * 12;
                reasons.Add(R("reason.resistVsTrue",
                    new Dictionary<string, object> { ["percent"] = Pct(threat.TrueDamageThreat) }));
            }
            // Pure HP items with no resists lose value: Warmog's, Heartsteel. They still
            // help a little (true dmg is only part of the profile) so penalty is modest.
            var isPureHpItem = stats.Health >= 700 && stats.Armor == 0 && stats.MagicResist == 0;
            if (isPureHpItem)
            {
                score -= threat.TrueDamageThreat * 10;
                reasons.Add(R("reason.hpScalesWithTrue",
                    new Dictionary<string, object> { ["penalty"] = (int)Math.Round(threat.TrueDamageThreat * 10) }));
            }
        }

        return (Math.Clamp(score, 0, 55), reasons);
    }

    private static double CalculateSynergy(
        ItemInfo item, ChampionInfo champion, List<RecommendedItem> selected)
    {
        double score = 0;

        if (item.Stats.CritChance > 0 && champion.Tags.Contains("Marksman"))
        {
            var critItems = selected.Count(s => s.Item.Stats.CritChance > 0);
            if (critItems is > 0 and < 3) score += 3;
        }

        if (item.Stats.Armor > 0 && !champion.Tags.Contains("Tank"))
        {
            var armorItems = selected.Count(s => s.Item.Stats.Armor > 0);
            if (armorItems >= 2) score -= 5;
        }

        if (item.Stats.MagicResist > 0 && !champion.Tags.Contains("Tank"))
        {
            var mrItems = selected.Count(s => s.Item.Stats.MagicResist > 0);
            if (mrItems >= 2) score -= 5;
        }

        return Math.Clamp(score, -15, 10);
    }

    private static double CalculateRoleBias(ItemInfo item, ChampionInfo champion, string role)
    {
        double score = 0;
        var stats = item.Stats;
        var cls = item.Classification;

        // Hard role filters — never recommend a jungle/support completed item outside its role.
        if (cls.IsJungleItem && role != LaneAssigner.Jungle)
            return -1000;
        if (cls.IsSupportItem && role != LaneAssigner.Utility)
            return -1000;

        if (role == LaneAssigner.Utility)
        {
            // Support: reward utility, punish selfish damage items for non-marksman enchanters.
            if (cls.IsSupportItem) score += 20;
            if (stats.AbilityHaste > 0) score += 4;
            if (stats.Health > 0) score += 2;
            if (stats.Mana > 0 && !champion.Resourceless) score += 2;
            if (cls.IsBoots) score += 2;

            // Discourage raw carry items unless it's an ADC-style support.
            var isCarryStat = stats.CritChance > 0 || stats.Lethality > 0 || stats.AttackSpeed > 0;
            if (isCarryStat && !champion.Tags.Contains("Marksman"))
                score -= 15;
        }
        else if (role == LaneAssigner.Jungle)
        {
            if (cls.IsJungleItem) score += 10;
            if (stats.Health > 0) score += 2;
            if (stats.AbilityHaste > 0) score += 2;
        }
        else
        {
            // Laner: slight nudge against utility-only items without damage.
            var hasDamageStat = stats.AttackDamage > 0 || stats.AbilityPower > 0
                                || stats.Lethality > 0 || stats.CritChance > 0 || stats.AttackSpeed > 0;
            if (!hasDamageStat && !cls.IsBoots && !cls.IsDefensive)
                score -= 3;
        }

        return score;
    }
}
