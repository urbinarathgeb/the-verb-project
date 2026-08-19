# MECHANICS.md — Mecánicas de Juego, The Verb Project

> Este documento especifica _cómo se juega_ cada modo, a nivel suficiente para diseñar estado, componentes y modelo de datos. Para el _por qué_ del producto, ver `PRODUCT.md`. Para stack y protocolos, ver `CLAUDE.md`.

## 1. Mecánica Base: Tablero de Emparejamiento

- El tablero muestra un set de **N verbos** (ej. 10) en sus 3 formas: presente, pasado, participio → **3N celdas** en total.
- Las celdas se distribuyen en **3 columnas** (una por forma verbal). Dentro de cada columna, el orden de las filas está **desordenado** — la fila no indica correspondencia entre columnas.
- **Interacción:** el jugador selecciona **una celda por columna** (3 celdas en total, una de cada una) que cree que pertenecen al mismo verbo, en cualquier orden. Al completar la selección de las 3, el sistema valida:
    - **Correcto:** las 3 celdas se marcan como resueltas (ej. bloqueadas/atenuadas), se retiran del pool de "pendientes", y se registra un acierto.
    - **Incorrecto:** las 3 celdas se deseleccionan, se muestra feedback breve de error, y se registra un error/intento fallido.
- Seleccionar una nueva celda dentro de una columna que ya tiene una celda seleccionada **reemplaza** la selección anterior en esa columna (no permite 2 seleccionadas a la vez en la misma columna).
- **Reposición diferida:** al resolver una tríada, sus celdas **no se retiran**: se quedan en su sitio atenuadas y no pulsables, como huecos. Pasado `refillDelayMs`, si quedan verbos en el pool, entra una tríada nueva ocupando huecos disponibles. El retardo es la mecánica, no un adorno: durante esa espera el jugador puede seguir acertando y el tablero se va **vaciando visiblemente**, lo que premia las rachas. En consecuencia, el tablero ya **no** mantiene siempre N tríadas jugables (ver `PLAN.md`, Bitácora de Decisiones, P1 y D8).
- **La reposición espera a que haya huecos suficientes.** Con un solo hueco, las tres filas libres son exactamente las que dejó la tríada resuelta, así que la entrante caería siempre ahí: el jugador acaba de verlas atenuarse juntas y sabría al instante que las tres nuevas son un mismo verbo. Se midió y ocurría en **200 de 200** casos. Por eso, aunque venza el retardo, la reposición **queda en deuda** hasta que el tablero llega a `refillMinVacancies` huecos. Pero el mínimo es una **preferencia, no una condición absoluta**: pasado `refillGraceMs` se repone igual. Tiene que ser así, porque cada acierto genera una reposición y el tablero deja de pagarlas al bajar del mínimo — un mínimo de G huecos absoluto dejaría el tablero fijo en N−(G−1) para el resto de la partida.
- **Y se adelanta si el tablero se vacía demasiado.** Al alcanzar `refillForceVacancies` huecos se adelanta la reposición más antigua sin esperar su retardo. Las restantes **conservan su hora**: reprogramarlas haría que forzar una vez retrasara a todas las siguientes y el tablero se llenaría a tirones.
- **Ninguna celda ocupada se mueve.** La tríada entrante sólo ocupa huecos; el jugador nunca pierde de vista una celda que acababa de localizar. Es posible gracias al retardo: al acumularse huecos hay filas libres de sobra donde colocarla.
- **Ningún verbo comparte fila entre dos columnas.** Es un invariante de todo el tablero, garantizado desde el reparto inicial y heredado por las reposiciones. El motivo: si una tríada entrante quedara alineada en dos columnas, el jugador —que acaba de verla aparecer— sabría gratis que esas celdas son del mismo verbo. Con el reparto barajado libremente, el 45 % de los verbos nacía alineado y arrastraba el problema a las reposiciones. La elección de filas además mira una reposición por delante, para no dejar a la siguiente sin combinación válida. Con el mínimo de huecos en vigor, la garantía se cumple: sobre unas dos mil reposiciones simuladas no hubo **ninguna** alineación ni ninguna repetición de las tres casillas de la misma tríada (ver `PLAN.md`, Bitácora de Decisiones, P4 y D8).
- **Pool agotado:** no hay nada que reponer y las celdas resueltas se quedan atenuadas. El tablero se vacía a medida que se aciertan las que quedan; la partida se gana cuando no queda ninguna jugable **y** el pool está agotado.
- **Deselección:** pulsar la celda ya seleccionada de una columna retira esa selección. Es la contraparte del reemplazo dentro de columna y lo esperable en pantalla táctil (ver `PLAN.md`, Bitácora de Decisiones, P4).
- **Validación por identidad, no por texto:** la comprobación de una tríada compara el `id` del verbo de cada celda, nunca las cadenas mostradas. Esto evita ambigüedades si en el futuro dos verbos comparten una misma forma.

## 2. Modo: Contrarreloj por Objetivo

- Se define un **objetivo de X verbos** a emparejar dentro de un **tiempo límite T** (cuenta regresiva).
- Los errores **no terminan la ronda** — solo consumen tiempo (posible penalización opcional a definir: ej. -2s por error).
- **Condición de éxito:** completar X emparejamientos antes de que el tiempo llegue a 0.
- **Métrica de ranking:** tiempo empleado en alcanzar el objetivo (menor tiempo = mejor posición). Solo se registran intentos exitosos.

## 3. Modo: Contrarreloj de Precisión ("Todo o Nada")

- Cronómetro corre **hacia adelante** (no hay límite de tiempo fijo); el pool de verbos puede ser mayor al que un jugador logra completar en una sesión — el objetivo es emparejar **la mayor cantidad posible antes de fallar**, no necesariamente agotar el tablero completo.
- **Un solo error termina la ronda inmediatamente** (fail state). No hay margen de error.
- Como consecuencia directa de esta regla: **toda partida registrada en este modo tiene, por definición, cero errores.** El fallo que termina la ronda es el **terminador** de la partida, no una penalización acumulable, y por eso no se contabiliza (ver `PLAN.md`, Bitácora de Decisiones, P6).
- **Clasifican ambos desenlaces**, tanto terminar por fallo como agotar el pool del nivel, siempre que se supere el piso mínimo de aciertos. Lo normal en este modo es terminar fallando —el pool es mayor de lo que se completa en una sesión—, así que exigir victoria dejaría el ranking prácticamente vacío.
- **Victoria:** vaciar el tablero, es decir, emparejar todos los verbos del pool del nivel sin fallar.
- **Métrica de ranking — ritmo (verbos por minuto):**

```
  ritmo = (aciertos / tiempo_en_segundos) * 60
```

Se ordena descendente por `ritmo`. Esta fórmula combina ambas variables en un solo número: premia tanto acertar más verbos como hacerlo rápido, sin permitir que un jugador "se lo tome con calma" solo para acumular aciertos — el tiempo pesa en cada instante, no solo como desempate.

- **Piso mínimo de aciertos para clasificar en el ranking** (parámetro de balance, ver sección 7): evita que una sesión con muy pocos aciertos en un tiempo casi nulo genere un ritmo artificialmente alto por inestabilidad matemática del ratio (ej. 1 acierto en 0.3s). Sin este piso, el ranking podría premiar sesiones triviales por sobre sesiones largas y hábiles.

## 4. Modo: Práctica / Aprendizaje

- No usa el tablero de 3 columnas. En su lugar, presenta preguntas de opción múltiple:
    - Se muestra **una forma verbal cualquiera** y se pregunta por **otra cualquiera** de las dos restantes: presente → participio, participio → pasado, pasado → presente, etc. Las **seis combinaciones** son posibles. Restringir el enunciado al presente dejaría sin ejercitar los saltos que más cuestan, como reconocer un participio y recuperar su pasado.
    - **La forma del enunciado se etiqueta siempre** (ej. `spoke (pasado) → participio`). No es un adorno: hay verbos cuyo texto coincide entre formas —`read` en presente y pasado, `cut` en las tres—, y sin la etiqueta el jugador no sabría desde dónde se le pregunta.
    - 3 alternativas, 1 correcta + 2 distractores, tomados siempre de **la misma forma solicitada** en otros verbos del set. Si vinieran de otra forma, el jugador acertaría por descarte sin saber el verbo.
    - **Cuando dos formas de un verbo coinciden, la pregunta se genera igualmente.** Es frecuente —la mayoría de los irregulares ingleses comparten pasado y participio—, y produce preguntas como `felt (participio) → ¿cuál es el pasado?` cuya respuesta es `felt`. No se filtran: que ambas formas sean idénticas **es parte de lo que hay que aprender** de ese verbo, y verlo repetido lo enseña.
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

| Nivel     | Pool de verbos                        | N | Objetivo: X | Objetivo: T | Penalización | Retardo | Huecos mín. | Fuerza con |
| --------- | ------------------------------------- | - | ----------- | ----------- | ------------ | ------- | ----------- | ---------- |
| `easy`   | `beginner` (49)                       | 6 | 8           | 90 s        | −2 s         | 5 s     | 3           | 5          |
| `medium`   | `beginner` + `intermediate` (86)      | 8 | 10          | 90 s        | −2 s         | 5 s     | 3           | 7          |
| `hard` | pool completo (106)                   | 10 | 12          | 100 s       | −3 s         | 5 s     | 3           | 9          |

- **Modo Precisión:** usa la misma `N` por nivel; el pool es el nivel completo.
- **Piso mínimo de aciertos para clasificar** en el ranking de Precisión: `MIN_MATCHES_FOR_RANKING = 5`.
- `N` escalonada por nivel resuelve además la usabilidad táctil: 18 celdas caben en un viewport móvil sin scroll; 30 no.
- **Huecos mínimos = 3.** Cuantos más se exijan, más margen hay para colocar la tríada entrante sin repetir posición; a cambio, la primera reposición tarda más en llegar y el tablero arranca encogiéndose.
- **Se fuerza con N−1 huecos**, es decir cuando queda una sola tríada jugable.
- **`refillDelayMs` está sin ajustar.** Un tablero que se vacía durante una racha tiene menos distractores, así que la reposición diferida hace ambos modos más fáciles: `X`, `T` y `N` probablemente necesiten reajuste tras jugar.

Estos son parámetros de balance: se espera que cambien al jugar el prototipo y **no bloquean ni condicionan la arquitectura**.

---

_Este documento es de nivel "spec de gameplay": cambios aquí deben reflejarse en la Bitácora de Decisiones de `PLAN.md` si alteran una mecánica ya implementada._
