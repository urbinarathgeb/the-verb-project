# MECHANICS.md — Mecánicas de Juego, The Verb Project

> Este documento especifica _cómo se juega_ cada modo, a nivel suficiente para diseñar estado, componentes y modelo de datos. Para el _por qué_ del producto, ver `PRODUCT.md`. Para stack y protocolos, ver `CLAUDE.md`.

## 1. Mecánica Base: Tablero de Emparejamiento

- El tablero muestra un set de **N verbos** (ej. 10) en sus 3 formas: presente, pasado, participio → **3N celdas** en total.
- Las celdas se distribuyen en **3 columnas** (una por forma verbal). Dentro de cada columna, el orden de las filas está **desordenado** — la fila no indica correspondencia entre columnas.
- **Interacción:** el jugador selecciona **una celda por columna** (3 celdas en total, una de cada una) que cree que pertenecen al mismo verbo, en cualquier orden. Al completar la selección de las 3, el sistema valida:
    - **Correcto:** las 3 celdas se marcan como resueltas (ej. bloqueadas/atenuadas), se retiran del pool de "pendientes", y se registra un acierto.
    - **Incorrecto:** las 3 celdas se deseleccionan, se muestra feedback breve de error, y se registra un error/intento fallido.
- Seleccionar una nueva celda dentro de una columna que ya tiene una celda seleccionada **reemplaza** la selección anterior en esa columna (no permite 2 seleccionadas a la vez en la misma columna).
- **Reposición dinámica:** el tablero mantiene **siempre N tríadas visibles**. Al resolver una tríada, si aún quedan verbos sin usar en el pool del nivel, entra una tríada nueva ocupando las 3 celdas liberadas, con posición barajada dentro de cada columna. Cuando el pool se agota, los huecos quedan vacíos y el tablero se reduce hasta resolverse por completo. Esta regla unifica el Modo Objetivo y el Modo Precisión bajo una sola mecánica y elimina el tiempo muerto de regenerar tableros enteros (ver `PLAN.md`, Bitácora de Decisiones, P1).
- **Validación por identidad, no por texto:** la comprobación de una tríada compara el `id` del verbo de cada celda, nunca las cadenas mostradas. Esto evita ambigüedades si en el futuro dos verbos comparten una misma forma.

## 2. Modo: Contrarreloj por Objetivo

- Se define un **objetivo de X verbos** a emparejar dentro de un **tiempo límite T** (cuenta regresiva).
- Los errores **no terminan la ronda** — solo consumen tiempo (posible penalización opcional a definir: ej. -2s por error).
- **Condición de éxito:** completar X emparejamientos antes de que el tiempo llegue a 0.
- **Métrica de ranking:** tiempo empleado en alcanzar el objetivo (menor tiempo = mejor posición). Solo se registran intentos exitosos.

## 3. Modo: Contrarreloj de Precisión ("Todo o Nada")

- Cronómetro corre **hacia adelante** (no hay límite de tiempo fijo); el pool de verbos puede ser mayor al que un jugador logra completar en una sesión — el objetivo es emparejar **la mayor cantidad posible antes de fallar**, no necesariamente agotar el tablero completo.
- **Un solo error termina la ronda inmediatamente** (fail state). No hay margen de error.
- Como consecuencia directa de esta regla: **toda partida registrada en este modo tiene, por definición, cero errores.**
- **Métrica de ranking — ritmo (verbos por minuto):**

```
  ritmo = (aciertos / tiempo_en_segundos) * 60
```

Se ordena descendente por `ritmo`. Esta fórmula combina ambas variables en un solo número: premia tanto acertar más verbos como hacerlo rápido, sin permitir que un jugador "se lo tome con calma" solo para acumular aciertos — el tiempo pesa en cada instante, no solo como desempate.

- **Piso mínimo de aciertos para clasificar en el ranking** (parámetro de balance, ver sección 7): evita que una sesión con muy pocos aciertos en un tiempo casi nulo genere un ritmo artificialmente alto por inestabilidad matemática del ratio (ej. 1 acierto en 0.3s). Sin este piso, el ranking podría premiar sesiones triviales por sobre sesiones largas y hábiles.

## 4. Modo: Práctica / Aprendizaje

- No usa el tablero de 3 columnas. En su lugar, presenta preguntas de opción múltiple:
    - Se muestra un verbo + una forma solicitada (ej. "speak → participio").
    - 3 alternativas, 1 correcta + 2 distractores (formas de otros verbos del set).
- **Sin ranking global** — este modo alimenta el progreso individual del usuario (verbos dominados, % de aciertos por verbo), no una tabla de posiciones.
- **Resuelto:** el modo **no es cronometrado** (es el modo de aprendizaje relajado, sin presión de tiempo) y **sí tiene mecánica de racha (streak)** visible como refuerzo motivacional, además del tracking de dominio a largo plazo en `user_progress`.

## 5. Ranking (Supabase)

- **Ranking separado por modo** (Objetivo y Precisión tienen cada uno su propia tabla de posiciones). El modo Práctica no tiene ranking, solo progreso personal.
- Solo usuarios autenticados (login Google) generan entradas de ranking. En modo invitado, el resultado se muestra en pantalla pero no se persiste (ver `CLAUDE.md`, sección 8).

## 6. Modelo de Datos — Esbozo de Alto Nivel

_(sujeto a refinamiento cuando se diseñe el schema real en `PLAN.md`)_

- `verbs` — catálogo de verbos irregulares (presente, pasado, participio, nivel de dificultad). **Vive en el cliente** (`src/data/verbs.json`), no en Postgres: es estático, pequeño y no requiere consulta remota. `user_progress.verb_id` referencia el `id` de ese JSON. Se migrará a tabla sólo si el catálogo pasa a ser editable.
- `profiles` — `id` (→ `auth.users`), `display_name`, `avatar_url`. Necesaria porque `auth.users` no es legible entre usuarios en Supabase y el ranking debe mostrar nombre y avatar de otros jugadores. Se puebla por trigger al registrarse; lectura pública, escritura sólo del dueño (ver `PLAN.md`, Bitácora de Decisiones, P3).
- `game_sessions` — un registro por partida completada: `user_id` (**NOT NULL**), `mode`, `level`, `time_ms`, `errors`, `verbs_matched`, `completed_at`. El `ritmo` del Modo Precisión (sección 3) se calcula a partir de `verbs_matched` y `time_ms` al momento de consultar el ranking — no requiere una columna adicional.
    - `user_id` es obligatorio porque el modo invitado no persiste nada (sección 5 y `CLAUDE.md` §8): una fila con `user_id NULL` sería inalcanzable (ver `PLAN.md`, Bitácora de Decisiones, P2).
- `user_progress` — por usuario autenticado y verbo: aciertos, errores, última práctica (alimentado principalmente por el Modo Práctica).

## 7. Parámetros de Balance

Todos estos valores viven centralizados en `src/data/levels.ts` como constante tipada, para que ajustarlos tras jugar el prototipo sea un cambio de una línea. Valores iniciales:

| Nivel     | Pool de verbos                        | N (tríadas visibles) | Objetivo: X | Objetivo: T | Penalización por error |
| --------- | ------------------------------------- | -------------------- | ----------- | ----------- | ---------------------- |
| `easy`   | `beginner` (49)                       | 6                    | 8           | 90 s        | −2 s                   |
| `medium`   | `beginner` + `intermediate` (86)      | 8                    | 10          | 90 s        | −2 s                   |
| `hard` | pool completo (106)                   | 10                   | 12          | 100 s       | −3 s                   |

- **Modo Precisión:** usa la misma `N` por nivel; el pool es el nivel completo.
- **Piso mínimo de aciertos para clasificar** en el ranking de Precisión: `MIN_MATCHES_FOR_RANKING = 5`.
- `N` escalonada por nivel resuelve además la usabilidad táctil: 18 celdas caben en un viewport móvil sin scroll; 30 no.

Estos son parámetros de balance: se espera que cambien al jugar el prototipo y **no bloquean ni condicionan la arquitectura**.

---

_Este documento es de nivel "spec de gameplay": cambios aquí deben reflejarse en la Bitácora de Decisiones de `PLAN.md` si alteran una mecánica ya implementada._