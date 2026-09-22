using System.Reflection;
using NatureSql.Core;

namespace NatureSql.UnitTests.Architecture;

/// <summary>
/// Protege la regla de arquitectura limpia de PROYECTO.md (sección 3): las dependencias
/// apuntan siempre hacia <c>Core</c>, nunca al revés, y <c>Core</c> no conoce infraestructura.
/// </summary>
public class CoreDependencyTests
{
    private static readonly Assembly CoreAssembly = typeof(AppMode).Assembly;

    /// <summary>
    /// Prefijos de ensamblado que <c>Core</c> no puede usar: los otros dos proyectos
    /// y las librerías de infraestructura que deben quedar detrás de una interfaz.
    /// </summary>
    public static TheoryData<string> ForbiddenAssemblyPrefixes =>
    [
        "NatureSql.Api",
        "NatureSql.Infrastructure",
        "Microsoft.EntityFrameworkCore",
        "Npgsql",
        "Microsoft.AspNetCore"
    ];

    [Theory]
    [MemberData(nameof(ForbiddenAssemblyPrefixes))]
    public void Core_does_not_reference(string forbiddenPrefix)
    {
        var offendingReferences = CoreAssembly
            .GetReferencedAssemblies()
            .Select(reference => reference.Name ?? string.Empty)
            .Where(name => name.StartsWith(forbiddenPrefix, StringComparison.OrdinalIgnoreCase))
            .ToArray();

        Assert.True(
            offendingReferences.Length == 0,
            $"NatureSql.Core no debe depender de '{forbiddenPrefix}', pero usa: {string.Join(", ", offendingReferences)}.");
    }
}
