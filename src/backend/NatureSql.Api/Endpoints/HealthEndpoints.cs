using Microsoft.Extensions.Options;
using NatureSql.Api.Configuration;

namespace NatureSql.Api.Endpoints;

/// <summary>
/// Endpoint de diagnóstico: confirma que el proceso está vivo y en qué modo se ha arrancado.
/// No expone nada sensible, porque en modo Demo es accesible desde internet.
/// </summary>
public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/health", (IOptions<NatureSqlOptions> options) =>
            Results.Ok(new HealthResponse(Status: "ok", Mode: options.Value.Mode.ToString())));

        return endpoints;
    }

    private sealed record HealthResponse(string Status, string Mode);
}
