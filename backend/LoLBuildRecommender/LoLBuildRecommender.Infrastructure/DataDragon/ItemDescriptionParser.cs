using System.Text.RegularExpressions;

namespace LoLBuildRecommender.Infrastructure.DataDragon;

public static partial class ItemDescriptionParser
{
    public static double ParseLethality(string description)
        => ParseStatValue(description, LethRegex());

    public static double ParseArmorPen(string description)
        => ParseStatValue(description, ArmorPenRegex());

    public static double ParseMagicPen(string description)
        => ParseStatValue(description, MagicPenRegex());

    public static double ParseAbilityHaste(string description)
        => ParseStatValue(description, AbilityHasteRegex());

    public static double ParseLifeSteal(string description)
        => ParseStatValue(description, LifeStealRegex());

    public static bool HasGrievousWounds(string description)
        => description.Contains("Grievous Wounds", StringComparison.OrdinalIgnoreCase)
           || description.Contains("reduce healing", StringComparison.OrdinalIgnoreCase);

    public static bool HasTenacity(string description)
        => description.Contains("Tenacity", StringComparison.OrdinalIgnoreCase);

    public static bool IsAntiHealItem(string description)
        => HasGrievousWounds(description);

    public static bool IsBootsItem(string[] tags, string name)
        => tags.Contains("Boots") || name.Contains("Boots", StringComparison.OrdinalIgnoreCase);

    public static bool IsJungleItem(string description, string name)
        => description.Contains("Jungle", StringComparison.OrdinalIgnoreCase)
           && (description.Contains("monster", StringComparison.OrdinalIgnoreCase)
               || name.Contains("Smite", StringComparison.OrdinalIgnoreCase));

    public static bool IsSupportItem(string[] tags, string description)
        => tags.Contains("GoldPer")
           || description.Contains("Quest", StringComparison.OrdinalIgnoreCase)
              && description.Contains("gold", StringComparison.OrdinalIgnoreCase)
              && description.Contains("minion", StringComparison.OrdinalIgnoreCase);

    private static double ParseStatValue(string description, Regex regex)
    {
        var match = regex.Match(description);
        if (match.Success && double.TryParse(match.Groups[1].Value, out var value))
            return value;
        return 0;
    }

    [GeneratedRegex(@"(\d+)\s*Lethality", RegexOptions.IgnoreCase)]
    private static partial Regex LethRegex();

    [GeneratedRegex(@"(\d+)%?\s*Armor Penetration", RegexOptions.IgnoreCase)]
    private static partial Regex ArmorPenRegex();

    [GeneratedRegex(@"(\d+)\s*Magic Penetration", RegexOptions.IgnoreCase)]
    private static partial Regex MagicPenRegex();

    [GeneratedRegex(@"(\d+)\s*Ability Haste", RegexOptions.IgnoreCase)]
    private static partial Regex AbilityHasteRegex();

    [GeneratedRegex(@"(\d+)%?\s*Life Steal", RegexOptions.IgnoreCase)]
    private static partial Regex LifeStealRegex();
}
