using LoLBuildRecommender.Infrastructure.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LoLBuildRecommender.Infrastructure.RiotApi;

/// <summary>
/// Injects the Riot API key into every outgoing request and handles 429 Too Many Requests
/// by honoring the Retry-After header. Retries up to <see cref="MaxRetries"/> times with a
/// capped delay so a single live request never blocks indefinitely — this protects the
/// /api/game/active endpoint from hanging when the crawler is active.
/// </summary>
public class RiotApiDelegatingHandler : DelegatingHandler
{
    // Keep retries bounded so a live request (HttpClient.Timeout = 30s) never sits on the
    // delegating handler long enough to trigger a TaskCanceledException. One retry after
    // at most 4s means worst case ~2 underlying sends + 4s delay ≈ 10–15 s — well under timeout.
    private const int MaxRetries = 1;
    private static readonly TimeSpan MaxRetryDelay = TimeSpan.FromSeconds(4);

    private readonly RiotApiSettings _settings;
    private readonly ILogger<RiotApiDelegatingHandler> _logger;

    public RiotApiDelegatingHandler(
        IOptions<RiotApiSettings> settings,
        ILogger<RiotApiDelegatingHandler> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.Headers.TryAddWithoutValidation("X-Riot-Token", _settings.ApiKey);

        HttpResponseMessage response;
        var attempt = 0;

        while (true)
        {
            response = await base.SendAsync(request, cancellationToken);

            if ((int)response.StatusCode != 429)
                return response;

            if (attempt >= MaxRetries)
            {
                _logger.LogWarning(
                    "Riot API returned 429 after {Attempts} attempts for {Url} — giving up",
                    attempt + 1, request.RequestUri);
                return response;
            }

            // Honor Retry-After but clamp so we never wait longer than a live request can tolerate.
            var retryAfter = response.Headers.RetryAfter?.Delta
                             ?? TimeSpan.FromSeconds(2 * (attempt + 1));
            if (retryAfter > MaxRetryDelay) retryAfter = MaxRetryDelay;

            _logger.LogDebug(
                "Riot API 429 for {Url}, retry {Attempt}/{Max} after {Delay}",
                request.RequestUri, attempt + 1, MaxRetries, retryAfter);

            try
            {
                await Task.Delay(retryAfter, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                return response;
            }

            attempt++;
        }
    }
}
