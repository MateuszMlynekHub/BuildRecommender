using LoLBuildRecommender.Core.Interfaces;
using LoLBuildRecommender.Core.Models;
using Microsoft.AspNetCore.Mvc;

namespace LoLBuildRecommender.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BuildController : ControllerBase
{
    private readonly IBuildRecommenderService _recommender;

    public BuildController(IBuildRecommenderService recommender)
    {
        _recommender = recommender;
    }

    [HttpGet("recommend")]
    public async Task<ActionResult<BuildRecommendation>> RecommendBuild(
        [FromQuery] int championId,
        [FromQuery] string enemyChampions,
        [FromQuery] string? allyChampions = null,
        [FromQuery] string? role = null)
    {
        if (championId <= 0)
            return BadRequest("championId is required");

        if (string.IsNullOrWhiteSpace(enemyChampions))
            return BadRequest("enemyChampions is required");

        var enemyIds = ParseIds(enemyChampions);
        var allyIds = allyChampions is not null ? ParseIds(allyChampions) : [];

        try
        {
            var recommendation = await _recommender.RecommendBuildAsync(championId, enemyIds, allyIds, role);
            return Ok(recommendation);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private static int[] ParseIds(string commaSeparated)
        => commaSeparated.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => int.TryParse(s.Trim(), out var id) ? id : 0)
            .Where(id => id > 0)
            .ToArray();
}
