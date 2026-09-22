namespace NatureSql.Core;

/// <summary>
/// Modo de ejecución de la aplicación. Se controla con la variable de entorno
/// <c>NATURESQL__MODE</c>. Ver PROYECTO.md, sección 2.
/// </summary>
public enum AppMode
{
    /// <summary>Instalación del usuario: crea sus conexiones y usa su propia clave de LLM.</summary>
    Local,

    /// <summary>Escaparate público: una única conexión fija, sesiones anónimas y límite de preguntas.</summary>
    Demo
}
