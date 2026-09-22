using NatureSql.Api.Configuration;
using NatureSql.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddOptions<NatureSqlOptions>()
    .Bind(builder.Configuration.GetSection(NatureSqlOptions.SectionName))
    .ValidateOnStart();

var app = builder.Build();

// El Angular compilado se copia a wwwroot al construir la imagen Docker.
// En desarrollo esa carpeta no existe y el frontend se sirve con `ng serve`.
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapHealthEndpoints();

// Cualquier ruta desconocida devuelve el index.html para que el enrutador de Angular
// resuelva la navegación en el cliente (sin esto, recargar /ajustes daría 404).
app.MapFallbackToFile("index.html");

app.Run();

/// <summary>
/// Declarada explícitamente para que los tests de integración puedan arrancar la API
/// con <c>WebApplicationFactory&lt;Program&gt;</c>.
/// </summary>
public partial class Program;
