using NatureSql.Core;

namespace NatureSql.Api.Configuration;

/// <summary>
/// Opciones generales de la aplicación, leídas de la sección <c>NatureSql</c>.
/// Con el proveedor de variables de entorno, <c>NATURESQL__MODE=Demo</c> rellena <see cref="Mode"/>:
/// el doble guion bajo es el separador de secciones y el nombre no distingue mayúsculas.
/// </summary>
public sealed class NatureSqlOptions
{
    public const string SectionName = "NatureSql";

    public AppMode Mode { get; init; } = AppMode.Local;
}
