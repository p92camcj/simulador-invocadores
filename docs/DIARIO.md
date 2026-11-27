# Diario del proyecto

Lo leen y lo escriben Dukas (el orquestador de Julio), sus sesiones de Claude Code y cualquier hilo de Claude
que trabaje en este repositorio. **Al empezar, lee las últimas entradas. Al terminar, añade una al final** con:
fecha, qué se hizo, decisiones tomadas y qué queda pendiente. Lo más reciente va abajo.

## 2026-11-27 09:36 · Reconstruir la historia del proyecto

- Hecho por: Dukas (tarea t2f9932064581)

> He creado `docs/HISTORIA.md` y he añadido la sección «Diario del proyecto (Dukas)» al final de `CLAUDE.md`, sin cambiar ningún otro fichero del proyecto. Está todo en el commit `24ccb4f`. No he podido ejecutar los tests, así que la historia no confirma que funcionen hoy.
>
> **Qué contiene la historia.** Sigue las cinco partes pedidas y está escrita a partir del `git log` (88 commits), el README, `CLAUDE.md`, `CHANGELOG.md`, los documentos de `docs/` y los TODO del código. `docs/DIARIO.md` no existía todavía.
> - **Por fechas:** la primera versión jugable es de abril de 2025 (v1.0 a v1.3). Después hubo casi 15 meses sin commits. El 19, 20 y 21 de julio de 2026 se puso al día con el reglamento revisado y se añadieron los autómatas, el marcador final, el nivel «Difícil» del autómata y los tests. El 5 de noviembre de 2026 entraron las reglas confirmadas con el autor y el PDF del reglamento (PR #1). La versión actual es `1.25.0.86`.
> - **Fallos conocidos:**
>   - El bug (b) de la Clarividente (al robar se ve como ninguna de las dos cartas de la mano) sigue sin reproducirse y no se conoce la causa.
>   - Todo el flujo de la partida depende de ventanas nativas de aviso (`alert()`/`confirm()`).
> - **Pendiente:** el personaje Entusiasta, los modos Introductorio, Avanzado y Experto, la variante 2 contra 2, el dibujo del Metamorfo transformado, mejoras de interfaz y el multijugador en red.
>
> **Comprobación.**
> - Las fechas y mensajes salen directamente del `git log`. No hay carpeta `.github/`, así…

**Decisiones**
- ¿Nombrar en HISTORIA.md al diseñador del juego y los nombres por defecto de jugadoras? → No; se remite a los créditos del README (decidió Claude)
- ¿No subir version.json/CHANGELOG/NOVEDADES pese a la regla de versionado de CLAUDE.md? → No se tocan (decidió Claude)

<details><summary>Archivos</summary>

```
CLAUDE.md        |  11 ++++
 docs/HISTORIA.md | 167 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 178 insertions(+)
```
</details>
