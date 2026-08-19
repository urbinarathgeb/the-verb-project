# PLAN.md — The Verb Project

> Este documento es el plan de ejecución vivo del proyecto. Para el _qué_ y el _por qué_ del producto, ver `PRODUCT.md`. Para la spec de gameplay, ver `MECHANICS.md`. Para stack y protocolos de trabajo, ver `CLAUDE.md`.
>
> **Estado:** plan aprobado. Fase 0 lista para ejecutar.
> **Convención de seguimiento:** cada tarea se marca `[x]` únicamente cuando cumple su Definition of Done (`CLAUDE.md` §1).

---

## Contexto

`PRODUCT.md` define el problema: memorizar verbos irregulares en tablas estáticas es friccionante y no genera evocación fluida al comunicarse. `MECHANICS.md` especifica la solución de gameplay: un tablero de emparejamiento de 3 columnas con tres modos de juego (Objetivo, Precisión, Práctica), ranking en Supabase y progreso por usuario.

El proyecto **ya tiene scaffold pero cero implementación**. Estado verificado al momento de escribir este plan:

| Elemento                                                          | Estado                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Vue 3.5.40 + Vite 8 + Tailwind 4.3.3 + Pinia 4                    | ✅ instalados y configurados (`vite.config.ts`, alias `@`)                          |
| `src/data/verbs.json`                                             | ✅ 106 verbos (49 beginner / 37 intermediate / 20 advanced), ids únicos, sin colisiones de forma entre columnas |
| TypeScript estricto + `noUncheckedIndexedAccess`                  | ✅ en `tsconfig.app.json`                                                            |
| **Repositorio git**                                               | ❌ **no inicializado** — `/autocommit` fallaría                                     |
| **Vitest**                                                        | ❌ no instalado, sin script `test` — el gate de calidad de `/autocommit` §4 fallaría |
| Vue Router                                                        | ❌ no instalado                                                                      |
| Supabase                                                          | ❌ no instalado                                                                      |
| `src/App.vue`, `README.md`, `src/stores/counter.ts`               | ⚠️ boilerplate del template, a reemplazar                                           |
| `src/composables/`, `src/screens/`, `src/lib/`, `src/types/`      | ❌ no existen (`CLAUDE.md` §7)                                                       |

**Resultado esperado al completar el plan:** una app jugable a pantalla completa con los tres modos, login con Google, ranking por modo y progreso persistido.

## Decisiones tomadas antes de planificar

1. **Secuencia:** prototipo 100% jugable en modo invitado primero (Fases 0–4); Supabase, auth y ranking después (Fase 5). Permite ajustar balance jugando antes de persistir nada.
2. **Navegación:** Vue Router, no máquina de estados en Pinia. Necesario para el callback OAuth de Supabase y para deep-links al ranking.
3. **Balance:** defaults propuestos y centralizados en un único archivo tipado `src/data/levels.ts`, para que cada ajuste sea de una línea.
4. **Modo Práctica:** sin cronómetro, con racha visible (resuelve el pendiente de `MECHANICS.md` §4).

---

## ⚠️ Pivotes respecto a `MECHANICS.md` (`CLAUDE.md` §2)

Estos tres puntos modifican o resuelven ambigüedades de la spec de gameplay. Se registran en la Bitácora de Decisiones y se reflejan en `MECHANICS.md` durante T0.1.

### P1 — Reposición dinámica de tríadas en el tablero

`MECHANICS.md` §1 dice «el tablero se completa cuando las N tríadas quedan resueltas», pero §3 dice que en Precisión «el pool de verbos puede ser mayor al que un jugador logra completar». Ambas reglas no conviven con un tablero estático.

**Resolución:** el tablero mantiene **siempre N tríadas visibles**. Al resolver una, si quedan verbos en el pool del nivel, entra una tríada nueva ocupando las 3 celdas liberadas (con posición barajada dentro de cada columna). Si el pool se agota, el hueco queda vacío y el tablero se reduce. Esto unifica ambos modos bajo una sola mecánica y elimina el tiempo muerto de regenerar tableros completos.

### P2 — `user_id NOT NULL` en `game_sessions`

`MECHANICS.md` §6 lo declara nullable, pero `CLAUDE.md` §8 y `MECHANICS.md` §5 establecen que en modo invitado **no se persiste nada**. Una fila con `user_id NULL` sería inalcanzable.

**Resolución:** `user_id NOT NULL`. El modo invitado muestra su resultado en pantalla y no escribe en Supabase.

### P3 — Tabla `profiles` (no contemplada en `MECHANICS.md` §6)

El ranking debe mostrar nombre y avatar de otros jugadores, pero `auth.users` no es legible entre usuarios en Supabase.

**Resolución:** se añade una tabla `profiles` con lectura pública, poblada por trigger al registrarse el usuario.

---

## Parámetros de balance

Todos viven en `src/data/levels.ts` como constante tipada y congelada. Valores iniciales, a validar jugando el prototipo (`MECHANICS.md` §7):

| Nivel                                              | N (tríadas visibles) | Objetivo: X | Objetivo: T | Penalización por error |
| -------------------------------------------------- | -------------------- | ----------- | ----------- | ---------------------- |
| `easy` — pool `beginner` (49 verbos)              | 6                    | 8           | 90 s        | −2 s                   |
| `medium` — pool `beginner` + `intermediate` (86)    | 8                    | 10          | 90 s        | −2 s                   |
| `hard` — pool completo (106)                    | 10                   | 12          | 100 s       | −3 s                   |

- **Modo Precisión:** usa la misma `N` por nivel; el pool es el nivel completo. `MIN_MATCHES_FOR_RANKING = 5`.
- **Ritmo:** `(aciertos / tiempo_ms) * 60000`, redondeado a 1 decimal para mostrar.
- `N` escalonada por nivel también resuelve la usabilidad táctil: 18 celdas caben en un viewport móvil sin scroll; 30 no.

---

## Arquitectura

Respeta la estructura de `CLAUDE.md` §7. El patrón obligatorio de §6 (los componentes **nunca** acceden a Pinia directamente, siempre vía composable) se aplica sin excepción.

```
src/
  router/index.ts          # / , /play/:mode/:difficulty , /practice , /result , /ranking , /auth/callback
  types/                   # verb.ts, game.ts, ranking.ts
  data/verbs.json          # (existente)
  data/levels.ts           # ⭐ único punto de balance
  lib/shuffle.ts           # Fisher-Yates con RNG inyectable (tests deterministas)
  lib/supabase.ts          # cliente (Fase 5)
  stores/                  # game.ts, practice.ts, auth.ts, progress.ts
  composables/             # useGameEngine, useBoard, useTimer, usePracticeEngine, useAuth, useRanking, useFocusTrap
  components/              # VerbCell, BoardColumn, GameBoard, HudBar, GameModal, ChoiceButton, RankingTable
  screens/                 # HomeScreen, GameScreen, PracticeScreen, ResultScreen, RankingScreen
```

**Regla de dependencias:** `lib/` y `data/` son puros (sin Vue). `stores/` sólo depende de ellos. `composables/` envuelve `stores/`. `components/` y `screens/` sólo consumen `composables/`.

---

## Fase 0 — Cimientos (sin lógica de juego)

- [x] **T0.1 — Inicializar git y registrar pivotes.** Repo en rama `main` con remoto `origin` → `https://github.com/urbinarathgeb/the-verb-project.git`. Sin ningún commit (`CLAUDE.md` §4). `.gitignore` ampliado con `.claude/settings.local.json` (el patrón `*.local` no lo cubría) y con `.env` / `.env.*`. P1, P2, P3, D1 y D2 reflejados en `MECHANICS.md` y en la Bitácora de Decisiones de este archivo.
- [x] **T0.2 — Limpiar el scaffold.** `src/stores/counter.ts` eliminado. `src/App.vue` reducido a un shell con contenedor `h-dvh w-full overflow-hidden` (el `<RouterView />` entra en T0.4, cuando exista el router; por ahora hay un placeholder). `index.html`: `lang="es"`, `<title>The Verb Project</title>`, `meta description` y `viewport-fit=cover` para notches en móvil. `pnpm type-check` limpio.
- [x] **T0.3 — Instalar Vitest.** `vitest@4.1.10` + `@vitest/coverage-v8`. `vitest.config.ts` hace `mergeConfig` sobre `vite.config.ts` (reutiliza el alias `@`), con `environment: 'node'` (no se testean componentes, `CLAUDE.md` §9), `include: src/**/__tests__/**/*.spec.ts` y cobertura acotada a `lib/`, `data/`, `stores/` y `composables/`. Añadido `tsconfig.vitest.json` (referenciado desde `tsconfig.json`) porque `tsconfig.app.json` excluye `__tests__` y sin él los tests no se type-chequearían. Scripts `test`, `test:watch` y `test:coverage`. Test smoke provisional en `src/lib/__tests__/smoke.spec.ts` que valida la resolución del alias y la carga del JSON — **lo reemplaza el test de integridad del dataset en T0.7**. `pnpm test` y `pnpm type-check` en verde. **Desbloquea el gate de calidad de `/autocommit` §4.**
- [x] **T0.4 — Vue Router.** `vue-router@5.2.0` instalado. `src/router/index.ts` con las 6 rutas más un catch-all que redirige al menú (no hay contenido navegable fuera del juego, así que un 404 no aporta). `HomeScreen` va en el bundle inicial; el resto se cargan de forma diferida para que el arranque sea inmediato. Las 6 pantallas creadas como placeholders en `src/screens/`. `App.vue` ahora renderiza `<RouterView />` y `main.ts` registra el router. `pnpm type-check`, `pnpm test` y `pnpm build-only` en verde, con un chunk separado por pantalla diferida.
- [x] **T0.5 — Design tokens (sistema Neo-Paper Brutalist).** `src/assets/main.css` con el bloque `@theme` completo: paleta (`ink`, `paper`, `paper-dim`, `card`, `electric`, `cyan`, `pink`), escala tipográfica del `design.md`, sombras duras `brutal-xs|sm|md|lg` sin desenfoque, radios a 0 y espaciados (`gutter`, márgenes, `touch` de 44px). Fuentes **auto-hospedadas** vía `@fontsource` (Montserrat 700/800/900 + JetBrains Mono 400/500, sólo subconjunto latino). Utilidades propias con `@utility`: `brutal-card`, `brutal-panel`, `brutal-press`, `paper-tilt-1…4` y los cuatro estados de celda (`cell-neutral`, `cell-selected`, `cell-resolved`, `cell-error`). Reset de viewport y foco visible en `@layer base`. Ruta `/styleguide` (sólo `DEV`) con `StyleguideScreen.vue` para verificar todo visualmente. Cero clases arbitrarias en `src/`. Ver Bitácora, D3 y D4.
- [x] **T0.6 — Tipos base.** `types/verb.ts` (`VERB_FORMS`/`VerbForm`, `VERB_LEVELS`/`VerbLevel`, `Verb`) y `types/game.ts` (`GAME_MODES`/`GameMode`, `DIFFICULTIES`/`Difficulty`, `CellId`, `Cell`, `CellStatus`, `Selection`, `Columns`, `BoardState`, `GameStatus`, `FinishedStatus`, `SessionResult`). Sin lógica en runtime, por lo que no requiere tests (`CLAUDE.md` §9). Tres decisiones de diseño:
    - `Verb` extiende `Record<VerbForm, string>` para garantizar una propiedad por forma verbal y permitir `verbo[forma]` tipado al construir el tablero.
    - **`Cell` no guarda su estado visual.** Aplicando la guía de `vue-best-practices` (estado fuente mínimo, derivar el resto), `CellStatus` se calcula desde `selection`, `resolvedVerbIds` y `errorCellIds`. Guardarlo en la celda crearía una segunda fuente de verdad a sincronizar a mano.
    - `CellId` con formato `${verbId}:${form}` en vez de índice de posición, porque la reposición de tríadas (P1) reordena las columnas y el índice dejaría de ser estable como `:key`.
    - ⚠️ **Pendiente para T0.7:** al importar `verbs.json`, TypeScript ensancha `level` a `string`, así que el JSON no es directamente asignable a `Verb[]`. Se resuelve con el cargador tipado y su test de integridad en T0.7 — no con una aserción `as`, que sólo silenciaría la comprobación.
- [x] **T0.7 — `data/levels.ts`, cargador tipado y tests de integridad.** **31 tests en verde.**
    - `data/levels.ts`: `LevelConfig`, `LEVELS` congelado con la tabla de balance, `MIN_MATCHES_FOR_RANKING = 5` y `getLevelConfig()`. Se usa `satisfies` en vez de anotación de tipo, para conservar los tipos literales sin perder la comprobación.
    - `data/verbs.ts`: cargador que **valida en runtime y estrecha el tipo** (`level` y formas no vacías), resolviendo el ensanchamiento del JSON detectado en T0.6 sin recurrir a un `as`. Expone `VERBS` y `getVerbsForDifficulty()`.
    - `data/__tests__/verbs.spec.ts`: ids únicos, formas no vacías, niveles válidos, **cero colisiones de cadena por columna** (invariante crítica: dos celdas idénticas en una columna harían indistinguible una jugada correcta de una incorrecta), pools acumulativos `easy ⊆ medium ⊆ hard` y pool suficiente para tablero y objetivo.
    - `data/__tests__/levels.spec.ts`: cobertura de las tres dificultades, coherencia de valores, config congelada, dificultad monótona creciente, y que la penalización por error no agote el tiempo límite (si lo hiciera, un solo fallo terminaría la ronda y el Modo Objetivo se convertiría en el Modo Precisión, contradiciendo `MECHANICS.md` §2).
    - Eliminado el test smoke provisional de T0.3.
    - **Los tests se verificaron por mutación**, no sólo viéndolos pasar: se inyectó una colisión de forma y un nivel inválido en `verbs.json` y se comprobó que ambos fallan con el mensaje correcto; después se restauró el archivo idéntico al original.

## Fase 1 — Núcleo de dominio (lógica pura, sin UI)

Todo aquí es testeable sin montar Vue. Es la parte con mayor densidad de tests.

- [x] **T1.1 — `lib/shuffle.ts`.** Fisher-Yates con RNG inyectable (seed) para tests deterministas. Tests: preserva elementos, no muta el original, misma seed → misma salida.
    - `createSeededRng(seed)` implementa mulberry32; `shuffle(items, rng = Math.random)` devuelve siempre una copia.
    - Se usó la formulación **por extracción** de Fisher-Yates en lugar de la variante in situ de Durstenfeld: misma distribución uniforme, y al no indexar el array por posición evita las aserciones de tipo que `noUncheckedIndexedAccess` obligaría en el intercambio. El coste O(n²) es irrelevante con un pool máximo de 106 verbos.
    - El índice se acota con `Math.min(..., length - 1)` para que un generador que incumpla el contrato devolviendo exactamente `1` no provoque un bucle infinito.
    - 16 tests. **Verificados por mutación:** se introdujo un sesgo que excluye la última posición (lo detecta el test de distribución), se hizo que mutara la entrada (7 tests en rojo) y se sustituyó el `rng` inyectado por `Math.random` (3 tests en rojo). El archivo se restauró idéntico al original.
    - Ninguna skill instalada cubre esta tarea (lógica pura de TypeScript, sin Vue, Pinia ni estilos); no hay skill de testing ni de algoritmos en el proyecto.
- [x] **T1.2 — Generación de tablero (`composables/useBoard.ts`).** Toma pool de verbos + `N` → 3 columnas de N celdas, cada columna barajada de forma independiente. Garantías testeadas: cada celda conoce su `verbId` y su `form`; ninguna columna queda en el orden original; existe exactamente una celda por (verbo, forma).
    - Se implementó en **dos piezas** en lugar de una: `lib/board.ts` con la lógica pura (`createBoard`, `createCell`, `createCellId`) y `composables/useBoard.ts` con el estado reactivo que la envuelve. Lo pide la skill `vue-best-practices` (`references/composables.md`, «Keep Utilities as Utilities»): la construcción del tablero no tiene estado ni efectos, así que es una utilidad. El beneficio práctico es que se testea sin tocar Vue y que T1.3 puede reutilizar `createCell` para la reposición de tríadas.
    - **La garantía «ninguna columna queda en el orden original» se reinterpretó.** Tal como estaba escrita no es verificable ni es la propiedad que importa: un barajado uniforme puede devolver el orden de partida, y el orden de partida ya es aleatorio porque el pool se baraja antes de repartir. La invariante que sí afecta a la jugabilidad es que **dos columnas no compartan el mismo orden de verbos**, porque entonces la fila delataría la correspondencia y el tablero se resolvería sin saber los verbos. Se garantiza por construcción con rechazo acotado (`MAX_ORDER_ATTEMPTS`), no por azar: con `N = 6` la coincidencia ocurriría en una partida de cada 250.
    - `useBoard` usa `shallowRef` (las celdas son inmutables y las columnas se reemplazan enteras) y expone el estado mediante `computed` en lugar de `readonly()`, para impedir la escritura externa sin arrastrar `DeepReadonly` a los consumidores. No es un store de Pinia porque el tablero pertenece a la partida en curso y muere con ella (`CLAUDE.md` §6).
    - Casos límite cubiertos: pool menor que `N`, pool vacío, `N` igual a 0, negativo y fraccionario, y tablero de un único verbo (donde el rechazo de órdenes es imposible y debe agotar reintentos sin colgarse).
    - 37 tests. **Verificados por mutación:** se eliminó el rechazo de órdenes repetidos, se hizo que las tres columnas compartieran orden, se dejó de excluir del pool los verbos visibles (8 tests en rojo), se fijó el texto de toda celda al de presente, se eliminó la forma del `CellId` y se congeló `visibleCount`. Las seis mutaciones se detectaron y los archivos se restauraron idénticos.
- [x] **T1.3 — Selección y validación.** Máximo una celda seleccionada por columna; seleccionar otra en la misma columna **reemplaza** la anterior (`MECHANICS.md` §1). Con 3 seleccionadas, validar **por `verbId`, nunca por texto**. Correcto → marcar resueltas + reponer tríada (P1). Incorrecto → deseleccionar las 3 + estado de error transitorio. Tests: reemplazo dentro de columna, acierto, error, orden de selección irrelevante, reposición correcta, agotamiento del pool.
    - Se amplió `useBoard` en vez de crear un composable aparte, porque la reposición necesita las columnas y el pool a la vez: separarlos habría obligado a compartir el mismo estado entre dos composables. `BoardState`, definido en T0.6, ya agrupaba las cinco piezas.
    - Nuevas funciones puras en `lib/board.ts`: `createEmptySelection`, `findCell`, `getSelectedCells` (devuelve una tupla de 3 o `null`, para validar sin comprobar longitudes), `isMatchingTriad`, `getCellStatus` y `replaceTriad`.
    - Nuevo tipo `SelectionOutcome` en `types/game.ts`: `select` devuelve `ignored`, `selected`, `deselected`, `match` o `mismatch`. El tablero **no** sabe de puntaje, tiempo ni fin de ronda; el motor de juego de Fase 2 decide las consecuencias, que difieren por modo (en Objetivo un fallo penaliza tiempo, en Precisión termina la partida).
    - El feedback de error se limpia con la siguiente interacción del jugador o con `clearError()`, sin temporizador: así no puede quedarse pegado en pantalla.
    - **Dos huecos de la especificación resueltos y anotados** en la Bitácora como P4 (filas distintas para la tríada repuesta, y deselección al volver a pulsar) y P5 (el estado `resolved` es de transición, no de tablero).
    - Se probaron las **seis permutaciones** del orden de selección, no sólo una, para que ninguna dependa del orden de las columnas. También el recorrido completo de un nivel: reponer hasta agotar el pool y luego reducir el tablero hasta vaciarlo.
    - 101 tests en total entre las dos suites. **Verificados por mutación:** validar por texto en vez de por id (4 en rojo), colocar la tríada entrante siempre en el hueco liberado, mutar las columnas recibidas, no registrar el error tras un fallo, no deseleccionar tras un fallo, no reemplazar la selección dentro de la columna, y no consumir el pool al acertar (4 en rojo). Las siete se detectaron y los archivos se restauraron idénticos.
- [x] **T1.4 — `composables/useTimer.ts`.** Cuenta regresiva y ascendente, `start` / `pause` / `reset`, penalización aplicable, callback al llegar a 0. Tests con `vi.useFakeTimers()`.
    - **El tiempo no se acumula sumando intervalos**, sino midiendo contra el reloj del sistema. Un `setInterval` no dispara con exactitud —se retrasa si la pestaña pierde el foco o el hilo se congestiona— y sumar sus disparos acumularía una deriva de segundos en una partida. El intervalo sólo marca cada cuánto se refresca el valor mostrado. Importa porque el tiempo es la métrica de ranking del Modo Objetivo, no un adorno del HUD.
    - Consecuencia asumida: entre ticks `elapsedMs` se queda en la última lectura, así que avanza a saltos de `tickMs` (100 ms por defecto). `pause` lo sincroniza, y por eso el resultado de una partida se lee siempre con el reloj ya detenido. Hacerlo exacto de forma continua exigiría leer el reloj dentro del `computed`, que quedaría impuro y no se invalidaría.
    - `remainingMs` y `progress` devuelven `null` sin límite, en vez de `Infinity` o `0`: obliga a la UI del Modo Precisión a tratar el caso en lugar de mostrar un valor sin sentido.
    - En cuenta regresiva `elapsedMs` se acota al límite, para que el tiempo registrado al expirar sea el límite exacto y no el instante del tick que lo detectó.
    - Las penalizaciones cuentan como tiempo consumido, así que empeoran también el tiempo del ranking. Si no contaran, fallar saldría gratis al jugador que igualmente llega al objetivo. Una penalización que agota el límite expira en el acto, sin esperar al siguiente tick.
    - El intervalo se limpia con `onScopeDispose`, condicionado a que haya un scope activo para poder usar el composable fuera de un componente (los tests lo hacen).
    - 39 tests. **Verificados por mutación:** de siete mutaciones, **tres sobrevivieron en el primer intento** y revelaron huecos reales. Acumular ticks en vez de medir el reloj sobrevivía porque `pause` duplicaba el cálculo del tramo — se extrajo `currentSegmentMs()` y ahora hay una sola forma de medirlo. No acotar el tiempo al expirar sobrevivía porque el límite del test caía justo en un múltiplo del tick; se añadió un caso con límite de 10 050 ms. Y disparar `onExpire` más de una vez sobrevivía porque sólo se probaba la vía del intervalo, que ya está detenido; se añadió el caso de penalizar después de expirar.

## Fase 2 — Motor de juego y modos contrarreloj

- [x] **T2.1 — `stores/game.ts`.** Estado de partida: modo, nivel, tablero, aciertos, errores, `elapsedMs`, `status` (`idle | playing | won | lost`). Acciones puras y testeables.
    - El store **compone** `useBoard` y `useTimer` dentro de su setup en lugar de reimplementar su estado. Consecuencia asumida: el estado interno del tablero y del reloj aparece en DevTools como getters y no dentro de `$state`. No afecta al proyecto (no hay SSR ni plugins de persistencia sobre este store), y evita duplicar lógica ya testeada en Fase 1. El estado **propio** de la partida sí se declara aquí y se devuelve completo, como exige la skill `vue-pinia-best-practices` (`pinia-setup-store-return-all-state`); hay un test que comprueba las claves de `$state` para que no se cuele estado invisible.
    - **`useTimer` tuvo que ampliarse:** `limitMs` pasó de `number | null` a `MaybeRefOrGetter<number | null>`. El reloj se crea en el setup del store, antes de que el jugador elija modo y nivel, así que el límite no se conoce hasta `startGame`. Los tests existentes siguen valiendo porque un valor plano sigue siendo aceptable; se añadieron 4 tests del caso reactivo.
    - Acciones: `startGame(mode, difficulty)`, `selectCell(cell)`, `finish(status)`, `clearError()` y `resetGame()`. `finish` detiene el reloj **antes** de leer el tiempo, para que el `timeMs` del resultado sea exacto y no el del último tick.
    - El getter `result` construye el `SessionResult` sólo desde un estado terminal; devuelve `null` en cualquier otro caso.
    - **Alcance deliberadamente incompleto:** aquí sólo se lleva la cuenta de errores y la transición genérica de estado (incluida la derrota al agotarse la cuenta regresiva, que es la única salida posible del reloj). La penalización de tiempo y la victoria por objetivo son T2.2; la muerte súbita del Modo Precisión es T2.3. Sin ellas, `won` sólo se alcanza llamando a `finish` directamente, que es lo que hacen los tests.
    - 34 tests. **Verificados por mutación:** no contar errores, aceptar jugadas fuera de la partida, no detener el reloj al terminar, permitir sobrescribir el desenlace, dar límite de tiempo al Modo Precisión, no perder al expirar, no reiniciar el reloj en `startGame`, y usar siempre el tablero de `easy`. Las ocho se detectaron.
- [x] **T2.2 — Modo Objetivo.** Cuenta regresiva desde `T`, penalización por error, éxito al alcanzar `X` aciertos, derrota al llegar a 0. Resultado: `time_ms` empleado. **Sólo los intentos exitosos son candidatos a ranking** (`MECHANICS.md` §2).
    - Las reglas de modo se aislaron en dos funciones dentro del store, `applyErrorRules` y `checkWinCondition`, en vez de repartir condicionales por `selectCell`. T2.3 añade su rama en el mismo sitio.
    - La penalización usa `errorPenaltyMs` del nivel y cuenta como tiempo consumido, así que además de acercar el final de la cuenta **empeora el tiempo que se registra en el ranking**. Si no contara, fallar saldría gratis al jugador que igualmente llega al objetivo. Una penalización que agota el límite pierde la partida en el acto, sin esperar al siguiente tick.
    - Nuevo getter `isRankingEligible`: en Modo Objetivo sólo clasifican las victorias, porque la métrica es el tiempo empleado en alcanzar el objetivo y una derrota no tiene tiempo que comparar. La rama del Modo Precisión (piso de aciertos) es T2.3; hasta entonces devuelve `false`. El filtro por usuario autenticado es aparte y vive en la capa de persistencia (Fase 5).
    - Getters nuevos para el HUD: `targetVerbs` y `remainingTargets`, ambos `null` fuera del Modo Objetivo.
    - Un test de T2.1 tuvo que actualizarse: comprobaba `timeMs` sin penalización porque ésta aún no existía. El valor nuevo es el correcto.
    - 19 tests nuevos (53 en la suite del store). **Verificados por mutación:** no penalizar al fallar (6 en rojo), penalizar también en Precisión, usar una penalización fija en vez de la del nivel, no comprobar nunca la victoria (5 en rojo), ganar un acierto antes de tiempo, dar objetivo al Modo Precisión, y admitir derrotas en el ranking. Las siete se detectaron.
- [x] **T2.3 — Modo Precisión.** Cronómetro ascendente; **el primer error termina la ronda** → por definición `errors = 0` en toda partida registrada. Cálculo de ritmo y aplicación del piso `MIN_MATCHES_FOR_RANKING`. Test explícito del caso degenerado: 1 acierto en 300 ms no clasifica.
    - Nuevo `lib/ranking.ts` con `calculatePace` e `isEligibleForRanking`, funciones puras fuera del store. La Fase 5 las necesita del otro lado: el ritmo no se guarda en `game_sessions`, se calcula al consultar el ranking desde `verbs_matched` y `time_ms` (`MECHANICS.md` §6). `isEligibleForRanking` se movió aquí desde el store, que ahora sólo lo envuelve en un getter.
    - **Se resolvió una contradicción aparente de `MECHANICS.md` §3**, que dice a la vez que un solo error termina la ronda y que toda partida registrada tiene cero errores. Se interpretó que el fallo es el **terminador** de la ronda y no una penalización acumulable, así que no se contabiliza: en Modo Precisión `errors` es siempre 0. La lectura alternativa —registrar sólo partidas sin fallo— dejaría el ranking casi vacío, porque §3 dice explícitamente que el pool es mayor de lo que un jugador completa en una sesión y que lo normal es terminar fallando.
    - En consecuencia, en Modo Precisión clasifican **ambos desenlaces** siempre que superen el piso de aciertos, no sólo las victorias.
    - Vaciar el tablero gana en cualquier modo: si no quedan celdas, no hay jugadas posibles. Es la victoria del Modo Precisión, que no tiene objetivo de aciertos.
    - `calculatePace` devuelve 0 con tiempo 0 o negativo en lugar de `Infinity`. Es imposible en una partida real, pero dejar explotar el ratio pondría esa sesión en lo alto del ranking.
    - 33 tests nuevos (19 en `ranking.spec.ts`, 14 en el store). El caso degenerado se prueba en los dos niveles: la función pura y el store completo, donde 1 acierto en 300 ms da un ritmo de 200 verbos por minuto y aun así no clasifica. **Verificados por mutación:** quitar la muerte súbita (8 en rojo), contabilizar el fallo de Precisión, no ganar al vaciar el tablero, ignorar el piso de aciertos (5 en rojo), no dividir por el tiempo al calcular el ritmo (5 en rojo), y no proteger de la división por cero. Las seis se detectaron.
- [x] **T2.4 — `composables/useGameEngine.ts`.** Interfaz pública única que envuelve `useGameStore()` con `storeToRefs`, siguiendo el ejemplo de `CLAUDE.md` §6. A partir de aquí ningún componente importa un store.
    - Estado y getters salen por `storeToRefs`; las acciones se desestructuran directamente del store. Desestructurar sin `storeToRefs` congela los valores en ese instante y la UI deja de actualizarse **en silencio**, que es el fallo más común con Pinia (skill `vue-pinia-best-practices`, `pinia-store-destructuring-breaks-reactivity`). Hay un test que comprueba con `isRef` que el estado sale como refs: la mutación correspondiente tumba 15 de los 16 tests.
    - Añade dos helpers que la UI necesitaría reconstruir por su cuenta: `cellStatus(cell)`, que combina selección, errores y verbos resueltos, e `isCellSelectable(cell)` para `disabled` y `aria-disabled`.
    - **La regla de §6 se volvió exigible por lint**, no sólo escrita: nueva sección `app/componentes-no-acceden-a-pinia` en `eslint.config.ts` que prohíbe importar `@/stores/*` o `pinia` desde `src/components/**` y `src/screens/**`, con un mensaje que apunta al composable correcto. Se verificó con un archivo sonda que la regla dispara con el import prohibido y calla con el permitido; la sonda se eliminó después.
    - 16 tests. **Verificados por mutación:** desestructurar sin `storeToRefs` (15 en rojo), ignorar los errores en `cellStatus`, ignorar la selección, y no comprobar en `isCellSelectable` si la partida está en curso. Las cuatro se detectaron.

## Fase 3 — UI del juego

- [x] **T3.1 — Componentes puros.** `VerbCell` (estados neutra / seleccionada / resuelta / error, sin lógica de negocio), `BoardColumn`, `GameBoard`, `HudBar` (tiempo, aciertos, errores, objetivo) y `GameModal` (base reutilizable).
    - Los componentes sólo mapean estado a clase: la semántica visual ya vivía en las utilidades `cell-*`, `brutal-*` y `paper-tilt-*` de T0.5, así que ninguno repite sopas de clases ni usa valores arbitrarios (`CLAUDE.md` §10).
    - `GameBoard` recibe `cellStatus` e `isCellSelectable` **como props de función** en vez de calcularlos. Es lo que ya expone `useGameEngine`, y mantiene el componente sin lógica de dominio (`CLAUDE.md` §7). `BoardColumn` no renderiza celdas: aporta cabecera y contenedor, y el padre las coloca por slot, de modo que la columna no necesita conocer `CellStatus`.
    - Nuevo `lib/format.ts` con `formatDuration`, `formatDurationPrecise` y `formatPace`, con 15 tests. `formatDuration` redondea **hacia arriba**: un reloj que marca `0:00` con tiempo aún jugable resulta desconcertante en cuenta regresiva.
    - `GameModal` usa `Teleport` a `body` porque el tablero vive en contenedores con `overflow` y contextos de apilamiento propios, donde un `position: fixed` quedaría recortado. El foco atrapado y el cierre con `Esc` son T3.4.
    - Los cinco componentes se montaron en `/styleguide` con datos fijos, para poder verlos antes de que exista la pantalla de juego (T3.2).
    - **Verificación visual real, con Chrome headless y capturas revisadas.** Encontró un defecto que el gate no detecta: las celdas no se encogían y el tablero **desbordaba su contenedor**, lo que en una pantalla baja lo sacaría del viewport y rompería el requisito de pantalla completa. Se corrigió con `flex: 1 1 0` en `VerbCell` y `min-height: 0` en la columna, conservando el suelo táctil de 44 px.
    - **Un falso positivo, corregido:** las primeras capturas parecían mostrar scroll horizontal en móvil y llegué a "arreglarlo" tocando el tamaño del HUD. Medido con CDP a 375 px reales, `document.scrollWidth` era exactamente 375 y ningún elemento se salía: el recorte era un artefacto de `--window-size` en headless, no un fallo del CSS. El cambio al HUD se revirtió por completo. Para lo sucesivo, las capturas móviles se toman fijando el viewport con `Emulation.setDeviceMetricsOverride` y `deviceScaleFactor: 1`.
    - Sin tests de componente: `CLAUDE.md` §9 los deja fuera de alcance en fase de prototipo. La verificación de estos cinco es visual.
- [x] **T3.2 — `HomeScreen` + `GameScreen`.** Home: elegir modo y nivel. GameScreen: HUD + tablero + modal de cuenta atrás inicial. Layout a pantalla completa, sin header ni footer.
    - Nuevo `ChoiceButton` como botón del sistema. La opción **elegida** se marca en cian y no en amarillo: fuera del tablero el amarillo es la acción primaria, y usarlo también para «seleccionado» haría leer «pulsa esto» donde sólo hay una marca de estado.
    - **Guard de ruta en `/play/:mode/:difficulty`**, que el router dejaba anotado para esta tarea. Los parámetros son texto libre, así que se validan con los nuevos type guards `isGameMode` e `isDifficulty` y se vuelve al menú si no cuadran. `GameScreen` los revalida para estrechar el tipo sin aserciones.
    - La cuenta atrás inicial **reutiliza `useTimer`** con `limitMs: 3000` en lugar de escribir otro contador: ya tiene probadas la expiración y la limpieza del intervalo.
    - `onBeforeUnmount` llama a `resetGame`: el store es global y, sin eso, volver al menú dejaría una partida a medias que reaparecería en la siguiente.
    - **Modal de fin de partida provisional** dentro de `GameScreen`. T3.2 no lo pedía, pero sin él la partida no tiene salida y la app se queda colgada al terminar. T3.3 lo sustituye por la navegación a `ResultScreen` con las métricas completas.
    - `README.md` reescrito: era todavía el del template de Vue. Ahora documenta cómo se juega, los dos modos, la tabla de niveles y las rutas disponibles (`CLAUDE.md` §3, primer cambio visible para el usuario del proyecto).
    - **Verificado jugando en el navegador con CDP**, no sólo con el gate: `/play/inventado/easy` redirige a `/`, la cuenta atrás aparece, el tablero monta 18 celdas (6 tríadas × 3), el HUD marca `1:30 / objetivo 8 / 0 errores` en nivel fácil, y pulsar una celda la deja seleccionada.
- [x] **T3.3 — `ResultScreen`.** Métricas según modo (tiempo en Objetivo; ritmo + aciertos en Precisión), botones de reintentar y volver. Para invitados, aviso de que el resultado no se guarda.
    - **Hubo que cambiar el ciclo de vida de `GameScreen`:** su `onBeforeUnmount` reseteaba la partida siempre, lo que habría borrado el resultado justo al navegar a `/result`. Ahora sólo descarta la partida si se abandona **a medias**; si terminó, el resultado sobrevive y lo consume `ResultScreen`, que a su vez resetea al salir.
    - El modal de fin provisional de T3.2 se sustituyó por un `watch` sobre `isFinished` que navega a `/result`.
    - Métricas por modo: Contrarreloj muestra tiempo, aciertos y errores; Precisión muestra ritmo (con su unidad), aciertos y tiempo. Entrar a `/result` por URL sin haber jugado redirige al menú.
    - **Se explica por qué una partida no clasifica**, en lugar de callarlo: el piso de `MIN_MATCHES_FOR_RANKING` es una regla que el jugador no puede deducir del tablero. El aviso de modo invitado aparece aquí, cuando hay un resultado que se perdería, y no antes de jugar.
    - La derrota se pinta en `paper-dim`, no en rosa: dentro del tablero el rosa significa «fallaste esta tríada» y repetirlo aquí sería redundante y castigador.
    - **Verificado jugando con CDP:** `/result` sin partida redirige a `/`; un fallo en Precisión lleva a `/result` mostrando `RITMO 0.0 / ACIERTOS 0 / TIEMPO 0:02` y la nota «Necesitas al menos 5 aciertos para entrar en la clasificación»; y «Jugar otra vez» vuelve a `/play/precision/easy` con tablero, HUD y cuenta atrás nuevos, sin errores en consola.
    - **No verificado visualmente:** el resultado del modo Contrarreloj, que exigiría 8 aciertos dirigidos o esperar los 90 s del límite. Es la otra rama del mismo `computed`.
- [x] **T3.4 — Accesibilidad y responsive** (`CLAUDE.md` §11). `composables/useFocusTrap.ts` para modales (foco atrapado, cierre con `Esc`), navegación por teclado del tablero (flechas + Enter), targets táctiles ≥ 44 px, `aria-live` para el feedback de acierto/error, y verificación de contraste sobre los tokens de T0.5.
    - `useFocusTrap` cicla el foco con Tab/Shift+Tab, lo restaura al cerrarse y llama a `onEscape` sólo si el modal es descartable. No se usó el `<dialog>` nativo —que traería el atrapado gratis— porque los modales del juego se abren de forma declarativa según el estado de la partida, no con `showModal()`.
    - **Navegación por flechas en el tablero.** Las celdas ya eran `<button>` nativos, así que Tab y Enter funcionaban; las flechas se añaden porque recorrer 30 celdas a base de Tab es agotador. El movimiento **no da la vuelta** en los bordes, para que el jugador no pierda la referencia de dónde está.
    - **Región viva** (`role="status"`, `aria-live="polite"`) que traduce a texto lo que hoy sólo se comunica por color y movimiento: acierto, error y selección. Se limpia antes de cada anuncio para que dos aciertos seguidos no pasen desapercibidos, y es `polite` y no `assertive` porque interrumpir en cada celda pulsada sería insoportable. Nueva utilidad `visually-hidden` en `main.css`.
    - **Contraste verificado por cálculo, no a ojo.** Tinta sobre cada fondo del sistema: papel 17.45:1, papel apagado 14.45:1, tarjeta 20.62:1, amarillo 19.56:1, cian 16.75:1 y rosa 7.93:1 — **todos AAA**. La celda resuelta, con opacidad 0.55, queda en 5.23:1, que cumple AA y es un estado deshabilitado.
    - Sin tests unitarios: un focus trap es lógica de DOM, no de negocio, y `CLAUDE.md` §9 deja fuera los tests de UI en fase de prototipo. Se verificó funcionalmente con teclado real vía CDP, que además es más fiel para foco.
    - **Verificado con teclado real:** el foco entra en el modal al abrirse; `Esc` **no** cierra la cuenta atrás (no es descartable); tras cuatro Tab el foco sigue dentro del modal; las flechas recorren filas y columnas y se detienen en los bordes; Enter y Espacio seleccionan; y la región viva anuncia «cut seleccionado.».
    - Un falso positivo durante la verificación: Enter parecía no activar la celda. Era que `Input.dispatchKeyEvent` sin `text` no genera el click sintético de un botón nativo. No se tocó código por ello.

> **Hito:** al cerrar la Fase 3 los dos modos competitivos son jugables de punta a punta en modo invitado. Punto natural para jugar y ajustar `data/levels.ts` antes de continuar.

## Fase 4 — Modo Práctica

- [x] **T4.1 — Lógica de práctica.** Genera pregunta (verbo + forma solicitada) con 1 respuesta correcta y **2 distractores tomados de la misma forma en otros verbos del pool** (`MECHANICS.md` §4). Racha que incrementa con acierto y se resetea con error. Sin cronómetro. Tests: los distractores nunca coinciden con la respuesta correcta, distribución de formas solicitadas, reglas de racha.
    - Nuevo `lib/practice.ts`, puro y sin Vue: `createQuestion`, `isCorrectAnswer`, `nextStreak` y `formatPrompt`.
    - **Las seis combinaciones de formas son posibles** (`FORM_PAIRS`): cualquiera de las tres puede aparecer en el enunciado y cualquiera de las otras dos como pregunta. En una primera versión restringí el enunciado al presente, apoyándome en el ejemplo de `MECHANICS.md` §4 («speak → participio»); **el usuario lo corrigió**, y con razón: eso dejaba fuera cuatro de las seis combinaciones y, con ellas, los saltos que más cuestan, como reconocer un participio y recuperar su pasado. Un ejemplo de la especificación es una ilustración, no el alcance.
    - En consecuencia, **el enunciado etiqueta siempre de qué forma parte** (`spoke (pasado) → participio`). Es obligatorio, no decorativo: `read` se escribe igual en presente y pasado, y `cut` en las tres, así que sin la etiqueta la pregunta sería irresoluble.
    - Los distractores se filtran **por texto y no sólo por id**. El catálogo ya garantiza que no hay formas repetidas dentro de una columna, pero apoyarse en eso convertiría un detalle del catálogo en un requisito del motor: dos opciones idénticas harían la pregunta irresoluble, porque el jugador podría elegir la «correcta» y ser marcado como error.
    - `createQuestion` devuelve `null` en vez de inventar una pregunta degenerada cuando el pool no da para tres opciones distintas. Acepta además el verbo anterior para no repetir pregunta seguida, salvo que el pool esté en el mínimo, donde repetir es mejor que no preguntar.
    - `nextStreak` **reinicia a cero** con un error en lugar de decrementar: el valor de la racha está en sostenerla, y decrementar la convertiría en un contador de puntos.
    - 29 tests, incluida la generación de 100 preguntas con el catálogo real. **Verificados por mutación:** no filtrar distractores por texto, tomarlos de otra forma, omitir la respuesta correcta (5 en rojo), pedir siempre el pasado, decrementar la racha en vez de reiniciarla, no excluir el verbo anterior, y aceptar pools insuficientes. Las siete se detectaron.
    - Ninguna skill instalada cubre esta tarea: es lógica pura de TypeScript, sin Vue, Pinia ni estilos.
- [x] **T4.2 — `stores/progress.ts` (en memoria) + `usePracticeEngine`.** Aciertos y errores por verbo. En esta fase vive sólo en Pinia; la Fase 5 lo sincroniza.
    - El progreso se indexa por `verbId` en un `Record`, no en un `Map`, porque es la forma que se serializa directamente hacia `user_progress` en la Fase 5. La sincronización no debería obligar a rediseñar el store.
    - **Reparto de estado según `CLAUDE.md` §6:** la *sesión* de práctica (pregunta actual, racha, contadores) es estado local de `usePracticeEngine`, porque muere al salir de la pantalla y ningún componente desconectado la necesita. El *progreso por verbo* sí es global y vive en Pinia, envuelto por el mismo composable para que la UI no toque el store.
    - **Definición de «verbo dominado»**, que `MECHANICS.md` §4 menciona sin concretar: al menos `MASTERY_MIN_CORRECT` aciertos **y** `MASTERY_MIN_ACCURACY` de porcentaje. Hacen falta las dos condiciones: con tres opciones se acierta al azar una de cada tres veces, así que sólo el porcentaje sería frágil, y sólo el número de aciertos premiaría insistir hasta acertar. Van a `data/levels.ts`, que es el único punto de balance.
    - Un verbo puede **dejar de estar dominado** si se vuelve a fallar: el dominio se deriva del progreso actual, no se almacena como una marca ganada para siempre.
    - `answer` ignora una segunda respuesta a la misma pregunta —falsearía racha y progreso— y `next` no avanza sin responder, porque saltar preguntas dejaría escapar justo los verbos que el jugador no sabe.
    - 41 tests. **Verificados por mutación:** dominio sin exigir porcentaje, dominio sin exigir aciertos mínimos, no registrar los fallos (6 en rojo), permitir responder dos veces, avanzar sin responder, y no reiniciar la racha al fallar.
    - **Una séptima mutación sobrevivió y destapó un test flojo:** «no excluir el verbo anterior» pasaba desapercibida porque el test sólo miraba 10 preguntas sobre un pool de 49, donde el azar casi nunca repite. Se reescribió para recorrer 200 preguntas con semilla fija y exigir cero repeticiones; así sí detecta la mutación y sigue siendo reproducible.
- [x] **T4.3 — `PracticeScreen` + `ChoiceButton`.** Feedback inmediato y racha visible en el HUD.
    - `ChoiceButton` ya existía de T3.2, así que la tarea fue la pantalla. La ruta pasó a `/practice/:difficulty` con su guard, igual que la de partida: el pool de preguntas sale del nivel. El menú gana el acceso «Practicar sin reloj», que reutiliza el nivel elegido e ignora el modo.
    - **Al fallar se resalta también la respuesta correcta**, no sólo el error. Ver la buena es lo que convierte un fallo en aprendizaje; limitarse a marcar el fallo dejaría al jugador sin saber qué era.
    - **Defecto de accesibilidad detectado en la verificación visual y corregido.** Las opciones ya respondidas quedan deshabilitadas, y `ChoiceButton` atenúa los botones deshabilitados al 45 % de opacidad. Medido, el texto sobre rosa caía a **2,73:1**, por debajo del mínimo incluso para texto grande, y además apagaba justo la respuesta correcta. Se restaura la opacidad en las opciones respondidas: aquí el deshabilitado es informativo, no «no disponible». Vuelven a 19,56:1 sobre amarillo y 7,93:1 sobre rosa, ambos AAA.
    - Región viva que traduce el feedback a texto («Incorrecto. La respuesta era brought.»), porque el resultado se comunica por color.
    - El hueco del feedback se reserva con `min-height` para que las opciones no salten al aparecer el veredicto.
    - **Verificado jugando con CDP:** `/practice/inventado` redirige a `/`; el enunciado muestra la forma etiquetada («PARTICIPIO / felt / ¿Cuál es el pasado?»); hay tres opciones; el veredicto y el HUD se actualizan; y la región viva anuncia la respuesta correcta al fallar.
    - Esa misma verificación destapó las preguntas en las que dos formas del verbo coinciden y la respuesta queda a la vista. Se planteó como decisión de producto y **el usuario decidió mantenerlas**: que pasado y participio sean idénticos es parte del aprendizaje de ese verbo. No se filtran (`MECHANICS.md` §4).

## Fase 5 — Supabase: auth, ranking y progreso

> Antes de escribir cualquier SQL, cargar la skill `supabase-postgres-best-practices`.

- [x] **T5.1 — Cliente.** `@supabase/supabase-js`, `lib/supabase.ts`, `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ya cubierto por el patrón `*.local` del `.gitignore`), tipado en `env.d.ts`.
    - **`supabase` puede ser `null`.** Sin credenciales la app arranca igual, en modo invitado y sin persistencia (`CLAUDE.md` §8). Devolver `null` en vez de lanzar obliga a quien lo consuma a contemplar el caso «sin backend», que es un estado legítimo y no un error. Las variables se tipan como opcionales en `env.d.ts` por el mismo motivo.
    - `.env.example` documenta las dos variables y advierte de que la `service_role` key **nunca** debe entrar en el proyecto: salta RLS por completo.
    - `src/types/database.ts` se generó con `pnpm supabase gen types typescript --linked` contra el proyecto enlazado, sustituyendo la versión provisional escrita a mano (que además fijaba `PostgrestVersion: '12'` a ojo, cuando el real es `14.15`). **El comando necesita `| sed '/^\[WARN\]/d'`**: pnpm escribe su aviso de versión de Node en la salida estándar y sin filtrarlo acaba dentro del archivo TypeScript. El propio archivo lleva el comando correcto en su cabecera.
    - Se descartó **Drizzle** tras evaluarlo: su query builder abre conexión directa a Postgres, así que en una app sin backend la cadena de conexión acabaría en el bundle y, peor, las peticiones no llevarían el JWT del usuario — RLS dejaría de aplicarse. `drizzle-kit` sólo para migraciones tampoco compensa: RLS, triggers e índices se escriben en SQL igual, y el tipado ya lo cubre el generador de Supabase.
- [x] **T5.2 — Schema + RLS.** Migraciones en `supabase/migrations/`:
    - `profiles(id → auth.users, display_name, avatar_url)`, poblada por trigger al registrarse (P3). RLS: lectura pública, escritura sólo del dueño.
    - `game_sessions(id, user_id NOT NULL, mode, level, time_ms, errors, verbs_matched, completed_at)` con `check` en `mode` y `time_ms > 0` (P2). RLS: insert sólo con `auth.uid() = user_id`; lectura pública para alimentar el ranking.
    - `user_progress(user_id, verb_id, hits, misses, last_practiced_at)` con PK compuesta. RLS: sólo el dueño lee y escribe.
    - Índices para las consultas de ranking: `(mode, level, time_ms)` y `(mode, level, verbs_matched, time_ms)`.
    - **Nota:** el catálogo de verbos se mantiene **en el cliente** (`verbs.json`), no en la base. Es estático, pequeño y no requiere consulta remota; `user_progress.verb_id` referencia el id del JSON. Se migrará a tabla sólo si el catálogo pasa a ser editable.
    - Todas las políticas usan **`(select auth.uid())`** y no `auth.uid()` a secas. La skill `supabase-postgres-best-practices` lo marca como impacto alto: la forma envuelta se evalúa una vez por consulta en lugar de una vez por fila.
    - **Las partidas son inmutables:** no hay políticas de `update` ni `delete` sobre `game_sessions`, así que un resultado no se puede retocar a posteriori para escalar en el ranking.
    - El trigger de alta de perfil es `security definer` con `set search_path = ''` —escribe en nombre de un usuario que aún no tiene sesión— y es idempotente (`on conflict do nothing`). Poblar el perfil por trigger y no desde el cliente elimina el hueco en el que un usuario recién registrado no tiene perfil y el ranking no puede nombrarlo.
    - **La migración se validó contra un Postgres real**, no sólo se escribió: se levantó una base temporal con stubs de `auth.users` y `auth.uid()`, se aplicó la migración completa, y se comprobó que RLS queda activo en las tres tablas, que las cinco políticas existen con el `cmd` correcto, que ninguna usa `auth.uid()` sin envolver, que los índices se crean, que los `check` rechazan modo inválido, nivel inválido, `time_ms = 0` y errores negativos, y que el trigger crea el perfil con el nombre y el avatar de los metadatos. La base temporal se eliminó después.
    - **Aplicada en Supabase.** `supabase link` + `db push`; `supabase migration list` confirma la misma versión en local y en remoto. La skill `supabase-postgres-best-practices` no estaba instalada pese a figurar en `CLAUDE.md` §12; se instaló (`supabase/agent-skills`, 152 kB, sólo markdown, sin ejecutables) antes de escribir una línea de SQL.
    - **Esta migración ya no se edita.** Su versión está registrada en la base, así que un cambio aquí no se aplicaría en remoto y los dos schemas divergirían en silencio. Todo cambio posterior va en un archivo nuevo creado con `supabase migration new`, que además pone la hora real en el timestamp en lugar de un valor escrito a mano.
- [x] **T5.3 — Auth con Google.** `stores/auth.ts` + `composables/useAuth.ts`, ruta `/auth/callback`, restauración de sesión al cargar, y **modo invitado plenamente funcional** (nada bloquea el juego sin login).
    - **Cero guardas de ruta.** No se añadió ninguna: el modo invitado es completo, así que no hay nada que proteger. Una guarda habría sido la forma más fácil de romper el requisito de la propia tarea.
    - La lógica con reglas de verdad se aisló en `src/lib/auth.ts`, pura y testeable sin simular Supabase: `identityFromUser` (cadena de respaldos para el nombre y el avatar), `describeAuthError` y `readCallbackError`.
    - **Los respaldos del nombre no son defensivos por si acaso:** Google entrega el nombre en `full_name` o en `name` y el avatar en `avatar_url` o en `picture` según el flujo del token. La cadena acaba en la parte local del correo y, en último término, en `'Jugador'`, porque el ranking de T5.4 no puede tener una fila sin nombre.
    - **La carrera del callback, que es el punto delicado.** `detectSessionInUrl` canjea el código de forma asíncrona, así que una sola llamada a `getSession()` puede resolverse *antes* de que la sesión exista y devolver `null`. Por eso el listener de `onAuthStateChange` se registra **antes** de la primera lectura y su valor tiene prioridad: `getSession()` queda sólo como red de seguridad para que la app no se quede cargando si no llega ningún evento. Hay un test dedicado a este orden.
    - `initialize()` **comparte la promesa** en vez de sólo protegerse con un booleano. La arranca `main.ts` y la vuelve a esperar `AuthCallbackScreen`; con un booleano, la segunda llamada volvería de inmediato y leería una sesión todavía inexistente, mandando al usuario al menú como invitado justo después de haber entrado.
    - **Errores traducidos por código, no por mensaje.** `access_denied` recibe mención propia porque es ambiguo —cancelar la pantalla de permisos y no estar en la lista de usuarios de prueba de Google dan el mismo código— y sin explicarlo parece un fallo de la aplicación.
    - Los dos sitios donde puede venir el error se miran los dos: el flujo PKCE responde en la query (`?error=`), el implícito y algunos fallos de Supabase en el fragmento (`#error=`). Mirar sólo uno dejaría el fallo invisible, y un fallo invisible en el callback se ve como un acceso que no hace nada.
    - **Al cerrar sesión se borra el progreso en memoria.** No es limpieza cosmética: es de quien estaba conectado, y dejarlo puesto lo atribuiría al invitado que siguiera jugando en el mismo navegador —y, en cuanto T5.5 sincronice, al siguiente usuario que entrara.
    - Sin credenciales de Supabase el acceso **no se muestra**, en lugar de mostrar un botón que falla al pulsarlo. `canSignIn` lo decide y `HomeScreen` lo respeta.
    - `main.ts` lanza la restauración **después de montar y sin bloquear**: la app es jugable como invitado, así que esperar a la red antes de pintar retrasaría el arranque sin ganar nada.
    - Tests: 24 de la lógica pura y 17 del store; el total del proyecto pasa de 371 a 412. El store se prueba con un doble del cliente y `vi.resetModules()` + `vi.doMock()` con reimportación dinámica de Pinia, porque `@/lib/supabase` expone constantes evaluadas al importar el módulo y reutilizar la Pinia estática dejaría al store con otra instancia activa.
    - **`vue-tsc` cazó una comparación que el análisis de flujo cree imposible:** tras `status.value = 'loading'`, TypeScript no ve la escritura del listener y declara que comparar con `'ready'` no tiene sentido. Se resolvió preguntando por el `computed` `isReady` —de tipo `boolean`, sin ese estrechamiento— en lugar de silenciar el error con una aserción.
    - **Verificado en el navegador por CDP, no sólo por tests.** Se comprobó: que el menú arranca en invitado con «Jugar» activo y sin errores de consola; que el botón de acceso llega de verdad a `accounts.google.com` con el `client_id` correcto, `redirect_uri` apuntando a `…supabase.co/auth/v1/callback` y scope `email profile` —lo único que confirma que el proveedor está bien configurado en el panel—; que `/auth/callback?error=access_denied` muestra el mensaje traducido en un `role="alert"`; que un callback sin sesión ni error no deja al usuario colgado; y que la rama autenticada se pinta con avatar, nombre y «Salir», recortando el nombre largo sin desbordar a 375 px. Para ver esa rama sin credenciales de nadie se inyectó una sesión falsa en el almacenamiento de `supabase-js`.
    - **Defecto encontrado sólo por mirarlo, que ningún test podía dar:** cuando la URL del avatar falla, el navegador dibuja su icono de imagen rota, que parece un fallo de la aplicación. Y las URLs de `lh3.googleusercontent.com` fallan en la práctica: caducan, tienen límites de tasa, y el usuario puede haber quitado la foto. Se añadió un manejador de `error` que oculta la imagen; guarda **la URL que falló** y no un booleano, para que otra distinta tenga su propia oportunidad. Verificado en los dos sentidos: con una URL válida el avatar aparece, con una inválida no queda ni el nodo.
- [x] **T5.4 — Persistencia de partidas y ranking.** Al terminar una partida, si hay usuario autenticado se inserta en `game_sessions` (en Objetivo, sólo si alcanzó el objetivo). Vista o RPC por modo que devuelve el **mejor resultado por usuario**: Objetivo → `time_ms` ascendente; Precisión → ritmo descendente filtrando `verbs_matched >= 5`. `RankingScreen` + `RankingTable`, con pestañas por modo y nivel.
    - **Faltaba una columna en el schema.** El plan pedía que en Objetivo sólo entraran las partidas ganadas, pero `game_sessions` no guardaba el desenlace: la base no podía distinguir victoria de derrota, así que el filtro habría vivido sólo en el cliente — y cualquiera puede insertar con la clave anónima una partida perdida con un tiempo ridículo. La migración `20260818184852_ranking_views` añade `status text not null check (status in ('won','lost'))`.
    - **Dos vistas en lugar de una consulta del cliente**, `target_ranking` y `precision_ranking`, con `distinct on (user_id, level)` para quedarse con el mejor resultado **por usuario**. Sin eso, quien más jugara coparía la tabla con sus propios intentos y el ranking dejaría de comparar personas.
    - Ambas llevan **`security_invoker = on`**. Sin esa opción una vista de Postgres se ejecuta con los permisos de quien la creó y **salta el RLS de las tablas que lee**: sería un agujero silencioso, porque daría igual lo que dijeran las políticas de `game_sessions`. Requiere PG15+; el proyecto corre PG **17.6**.
    - El ritmo de Precisión **se calcula en la vista, no se almacena** (`MECHANICS.md` §6): un valor derivado guardado puede quedar inconsistente con sus operandos. La división es segura por el `check (time_ms > 0)` del schema inicial.
    - **Los índices del schema inicial se sustituyeron.** Estaban pensados para un ranking plano —«los mejores tiempos»— pero la consulta real es «el mejor tiempo *de cada usuario*», que necesita otro orden de columnas. Se cambiaron en vez de acumularlos: un índice que ninguna consulta usa sólo encarece las escrituras.
    - **Guardarse y clasificar no son lo mismo**, y la distinción es deliberada: una partida de Precisión por debajo del piso **sí se guarda** (es historial del jugador) pero la vista la deja fuera del ranking; una derrota en Objetivo ni se guarda, porque no tiene tiempo que comparar. Lo decide `isPersistable`, separada de `isEligibleForRanking`.
    - `SaveOutcome` es una unión explícita (`saved` / `guest` / `offline` / `not-persisted` / `error`) y no un booleano: la pantalla de resultado dice cosas distintas en cada caso, y «no se guardó por ser invitado» no es un error del que disculparse, es el modo invitado funcionando.
    - Los empates **comparten posición** en la tabla. Con dos tiempos idénticos, numerarlos 1 y 2 sugeriría una diferencia que no existe: la base desempata por `completed_at` sólo para que el orden sea estable.
    - **Migración validada contra un Postgres real** antes de tocar la base del proyecto, con dos usuarios y varias partidas: se comprobó que sale una fila por usuario, que elige el mejor resultado, que descarta las derrotas, que los niveles no se mezclan, que el piso de aciertos filtra en Precisión, que el `check` de `status` rechaza valores inválidos, y que los `grant` quedan puestos. El local es PG14, así que se validó con la cláusula `security_invoker` retirada; esa parte la validó el propio `db push` contra PG17.
    - **Verificado en el navegador por CDP:** las dos vistas responden 200 con la clave anónima —lo que confirma `grant` y `security_invoker` de punta a punta—, cambiar de pestaña dispara la consulta de la otra vista con el orden correcto (`time_ms.asc` / `pace.desc`), y la tabla pinta posiciones, empates, fila propia destacada, nombre de respaldo y avatares rotos ocultos. Para no ensuciar la base con usuarios falsos se interceptó `fetch` en el navegador en vez de insertar filas reales.
    - **Falso positivo descartado:** parecía que cada consulta se emitía dos veces, pero era Vite reoptimizando dependencias y recargando la página. En caliente sale un solo `GET`. Se comprobó el método antes de tocar nada.
    - **Dos defectos de CSS encontrados sólo mirándolo.** Uno: las columnas numéricas no se alineaban a la derecha, porque `.ranking-numeric` (0,1,0) pierde en especificidad contra `.ranking-table th, td` (0,1,1) — era CSS muerto. Dos: en móvil un nombre largo estiraba su columna y empujaba «Tiempo» fuera de la pantalla, justo la métrica que ordena la tabla; se resolvió con `table-layout: fixed` y anchuras declaradas, y ahora la tabla cabe en 375 px sin desplazamiento alguno.
    - Se añadió el acceso al ranking desde el menú y desde la pantalla de resultado: la ruta existía desde T0.4 pero **no había forma de llegar a ella** navegando.
    - Tests: 13 de la lógica pura y 13 del store; el total pasa de 412 a 438. El test de la carrera entre pestañas se endureció tras comprobar por mutación que **pasaba igual sin la guarda**: hacía falta que la respuesta abandonada fuera la lenta, y filas distintas por vista para ver cuál ganaba.
    - **Sin verificar todavía:** un guardado real de punta a punta, que requiere iniciar sesión con una cuenta de Google.
- [x] **T5.5 — Sincronizar `user_progress`.** El Modo Práctica hace upsert incremental por verbo para usuarios autenticados.
    - **Una función de Postgres en vez del upsert de PostgREST**, `record_practice_progress(entries jsonb)` (migración `20260818191730`). El upsert normal **sustituye** la fila, así que el cliente tendría que mandar totales absolutos calculados desde su copia local: si la misma persona practica en el móvil y luego en el portátil sin recargar, la segunda pestaña escribiría totales viejos y borraría lo aprendido en la primera. Sumando del lado del servidor, el orden de llegada deja de importar.
    - `security invoker` a propósito, para que RLS siga aplicándose sobre `user_progress`. Es la segunda barrera; la primera es que **el `user_id` no se acepta del cliente**: se toma de `auth.uid()` dentro de la función, así que nadie puede escribir progreso ajeno.
    - `greatest(…, 0)` descarta incrementos negativos. Sin eso, una llamada manipulada podría **restar fallos** y fabricarse un verbo «dominado».
    - Ejecución revocada de `public` y `anon`, concedida sólo a `authenticated`: un invitado no tiene progreso que guardar.
    - **Envío agrupado con retardo de 2 s.** Una petición por respuesta sería innecesariamente charlatana; en una sesión de veinte preguntas la diferencia es de veinte peticiones a unas pocas. El retardo es inyectable para que los tests no dependan del reloj real.
    - **Se vacía la cola ANTES de enviar y se restituye si falla**, sumándola a lo que haya llegado entretanto. Así las respuestas dadas mientras la petición está en vuelo ni se pierden al volver ni se envían dos veces. Hay dos tests dedicados a ese entrelazado.
    - **Se descarga al empezar la sesión** (`loadProgress`): sin eso, un usuario que vuelve vería su recuento de verbos dominados a cero pese a tenerlos. La carga **descarta** lo practicado como invitado, porque no se pidió atribuírselo a esa cuenta y subirlo falsearía sus estadísticas.
    - `resetProgress` vacía también la cola. Es imprescindible: si no, el progreso de quien acaba de cerrar sesión se subiría a la cuenta del siguiente que entre.
    - Se escucha **`visibilitychange`** y no `beforeunload`: en móvil el navegador puede matar la pestaña sin disparar nunca `beforeunload`, y las últimas respuestas se perderían. Además se envía lo pendiente al salir de la pantalla.
    - **Función validada contra un Postgres real** antes de tocar la base: suma incremental sobre el mismo verbo (2+3 → 5), lote con varios verbos, incrementos negativos descartados sin restar, aislamiento entre usuarios, rechazo sin sesión, rechazo de una entrada que no es array, y los `grant` correctos.
    - **Verificado en el navegador por CDP:** autenticado sale **una** carga inicial y **un solo** envío agrupando las cinco respuestas con sus incrementos por verbo; como invitado no sale **ninguna** petición; y llamar a la función con la clave anónima contra el servidor real devuelve `401 permission denied for function record_practice_progress`, que confirma el `revoke` de punta a punta.
    - El test de `$state` de `progress` se actualizó al añadir estado nuevo. Se compara la lista exacta a propósito: la skill de Pinia exige devolver **todo** el estado de un setup store, y una comparación laxa dejaría de vigilarlo.
    - Tests: 24 nuevos (15 del store, 9 del ciclo de envío); el total pasa de 438 a 462. El ciclo se prueba con un `document` mínimo propio en lugar de instalar jsdom, que este proyecto evita porque no testea componentes.

## Fase 7 — Jugabilidad

Surge de jugar la Fase 5 completa. Se ejecuta **antes** de la Fase 6: cambia mecánicas y comportamiento visible, así que cerrar antes obligaría a repetir el cierre. Ver bitácora **D8**, **D9** y **D10**.

- [x] **T7.1 — Cierre de partida con feedback.** Modal de desenlace en `GameScreen` sobre el tablero congelado (victoria, tiempo agotado o fallo), navegación a `/result` por acción del usuario en lugar de automática, arreglo de la redirección muda de `ResultScreen`, y en la pantalla de resultado la posición en la clasificación y el aviso de récord personal.
    - **El camino de la derrota por tiempo era correcto.** `checkExpiry` → `finish('lost')` → `router.push('/result')` funcionaba, y el `onBeforeUnmount` de `GameScreen` estaba bien guardado por `isFinished`. El fallo estaba en `ResultScreen`: se borraba el resultado a sí misma al desmontarse y, sin resultado, redirigía a `home` con `replace` **en silencio**. Cualquier remontaje —una recarga, entrar por URL, volver atrás— expulsaba al jugador al menú sin decir nada y sin dejar rastro en el historial.
    - **Se arregla por arquitectura, no por parche.** El desenlace se anuncia con un modal **sobre el tablero congelado** y a `/result` se navega por acción del usuario. Así el feedback deja de depender de una navegación asíncrona y de que un estado en memoria sobreviva al desmontaje. Se elimina el `watch` que navegaba solo, y `router.push` pasa a llevar `.catch()`: antes, un fallo al cargar el chunk abortaba la navegación en silencio y dejaba al jugador ante un tablero muerto a 0:00.
    - Ventaja añadida: el tablero congelado es información real —se ve qué tríadas faltaban— que antes se perdía al saltar de pantalla.
    - `ResultScreen` sin resultado muestra ahora un estado vacío con salida al menú, y sólo descarta la partida cuando el jugador se va por su propio pie (`isLeaving`).
    - **La posición se resuelve con un `count` de cabecera** —cuántos te superan, más uno— y no cargando la tabla: `loadRanking` está limitada a 20 filas, así que quien esté en el puesto 45 no aparecería. Sin migración nueva.
    - **El orden de `submitResult` es lo que lo hace correcto:** la marca previa se lee **antes** de insertar. Al revés, la vista ya incluiría la partida recién guardada y se compararía consigo misma, de modo que nunca habría un récord. Por eso es una sola acción del store y no tres llamadas desde la pantalla.
    - `RecordVerdict` es una unión y no un booleano porque **la primera marca no es un récord**: no había nada que batir, y celebrarlo sonaría a premio vacío; pero tampoco merece silencio.
    - Tests: 21 nuevos; el total pasa de 462 a 483. El test del orden **se endureció tras comprobar por mutación que pasaba igual con las llamadas invertidas**: el doble del cliente devolvía siempre la misma marca previa, insertara o no. Ahora simula la vista de verdad, incluyendo la partida ya insertada, y el orden invertido rompe dos tests.
    - **Verificado en el navegador por CDP** con el límite de tiempo bajado a 6 s: al expirar aparece el modal «¡Se acabó el tiempo!» con el tablero visible detrás y el anuncio en la región viva; «Ver resultado» lleva a `/result` con los datos correctos; y **recargar en `/result` muestra el estado vacío en lugar de expulsar al menú**. Con sesión simulada, la secuencia observada es `personal-best` → `insert` → `count`, la consulta de posición usa `pace=gt.` en Precisión, y la tarjeta muestra «7º». Cero errores de consola.
- [x] **T7.2 — Reposición diferida.** La tríada acertada pasa a estado `resolved` y se atenúa; una reposición agendada por tríada la sustituye tras `refillDelayMs`, colocando la entrante **sólo en filas libres** y sin mover ninguna celda ajena. Incluye `TransitionGroup` para las entradas y salidas.
    - **No hizo falta modelar la «casilla vacía».** Ya existía todo: `resolvedVerbIds` en `useBoard`, `getCellStatus` devolviendo `'resolved'`, `isCellSelectable` excluyéndolos y la utilidad `cell-resolved` con `pointer-events: none`. Bastó con **dejar de retirar las celdas al acertar**. De paso, ese estilo pasa de ser **CSS muerto** —la celda desaparecía antes de poder mostrarse así— a ser el hueco visible del tablero.
    - `visibleCount` deja de ser la altura de la columna y pasa a contar las celdas **no resueltas**. Es válido leerlo sólo de `present` porque un verbo sin resolver está siempre en las tres columnas: sólo entra de tríada en tríada y sólo se sobrescribe una vez resuelto. Lo que sí difiere entre columnas es qué celdas resueltas quedan sin reponer, y eso no afecta al recuento de lo jugable.
    - **La condición de victoria tenía un agujero.** Vaciar el tablero ganaba la partida, pero con reposición diferida un jugador rápido puede emparejar todas las tríadas visibles antes de que llegue ninguna reposición: habría ganado a los pocos segundos con el pool casi intacto. Ahora se exige además `isPoolExhausted`.
    - Las reposiciones pendientes **se cancelan** en `finish`, `resetGame` y `startGame`, con una segunda comprobación de estado dentro del propio temporizador. Sin eso, una partida terminada seguiría repoblando el tablero bajo el modal de desenlace, y los temporizadores viejos repondrían sobre el tablero de la partida siguiente.
    - La inclinación de cada celda pasa a derivarse del **verbo** y no de la fila: con reposición en fila arbitraria, atarla a la posición hacía que dos celdas distintas heredaran el ángulo del hueco y el tablero pareciera temblar.
    - `TransitionGroup` se declara con `tag="div"` **renderizando el propio `.column-cells`**, sin envoltorio: `GameBoard` navega con las flechas leyendo los hijos directos de ese contenedor y cualquier elemento intermedio habría roto el teclado. Verificado: las tres columnas siguen teniendo las celdas como hijos directos y las flechas se mueven bien. La salida es instantánea porque una celda desvaneciéndose seguiría ocupando su fila y la columna daría un salto; el desvanecido que ve el jugador ocurre antes, al pasar la tríada a resuelta.
    - **La verificación en el navegador destapó un fallo que los tests no daban.** La última reposición de una tanda deja un solo hueco por columna, y si las anteriores consumieron las filas equivocadas la tríada entrante queda **alineada en dos columnas** — exactamente la pista que la regla anti-pista existe para evitar, y a una frecuencia del orden del 44 %, la misma que el problema original.
    - Se corrigió en dos frentes, midiendo en lugar de suponer: **elegir filas mirando una reposición por delante** (descartando asignaciones que dejarían a la siguiente sin salida) bajó la colisión al 5,15 %; y **garantizar desde el reparto que ningún verbo comparte fila entre columnas** —el 45 % nacía alineado— la bajó al **1,62 %**. `shuffleIntoNewOrder` pasa a ser `shuffleIntoDiscordantOrder` y subsume la regla anterior, porque dos columnas con el mismo orden coincidirían en todas las filas.
    - **El test no finge que la garantía sea total:** afirma que el reparto no alinea ningún verbo y que las reposiciones alineadas se quedan por debajo del 3 %. El umbral detecta regresiones sin declarar una garantía que no se cumple.
    - Tests: `replaceTriad` y `replaceInColumn` se eliminan con sus invariantes —la mecánica que codificaban ya no existe— y se sustituyen por los de `refillSlots`. Los bucles `while (!isCleared)` de `useBoard` y los helpers de `game` y `useGameEngine` se reescribieron para esperar la reposición; el total pasa de 483 a 488.
    - **Verificado en el navegador por CDP:** encadenando tres aciertos el tablero baja a 3 tríadas jugables por columna con los huecos atenuados y **ninguna celda ocupada cambia de sitio**; tras el retardo vuelve a 6. Sin errores de consola y sin desbordes horizontales.
    - **Ampliación tras jugarlo: control del ritmo de reposición (idea del usuario).** Al probarlo apareció un agujero que la métrica anterior no veía. Con **un solo hueco**, las tres filas libres son exactamente las que dejó la tríada resuelta, así que la entrante cae siempre en esas mismas casillas: se midió y ocurría en **200 de 200**. Como el jugador acaba de ver esas tres celdas atenuarse juntas, ver tres celdas nuevas justo ahí le identifica el verbo entero. Es un regalo total, peor que la alineación de filas que sí se estaba midiendo, y era el caso **normal** de juego.
        - **Regla 1 — mínimo de huecos (`refillMinVacancies = 3`):** aunque venza el retardo, la reposición **queda en deuda** hasta que el tablero llega a tres huecos. Con varios huecos se pueden mezclar casillas de tríadas distintas y el regalo desaparece. Requiere un contador de deuda: sin él la reposición bloqueada se perdería y el tablero encogería para siempre.
        - **Regla 2 — adelanto (`refillForceVacancies = N − 1`):** al quedar una sola tríada jugable se adelanta la reposición más antigua. Las demás **conservan su hora**; reprogramarlas haría que forzar una vez retrasara a todas las siguientes y el tablero se llenaría a tirones.
        - **Prioridad de la colocación, reordenada:** repetir las tres casillas de la misma tríada pasa a penalizarse más que alinear dos filas, porque identifica el verbo entero en lugar de sugerir que dos celdas van juntas. Eso subió la alineación medida del 1,6 % al 5,5 % **en la simulación sin la regla de huecos mínimos** — pero con la regla en vigor, sobre 2040 reposiciones simuladas salen **cero repeticiones y cero alineaciones**.
        - El test pasa a afirmar el **cero exacto** en lugar de un umbral: si alguien baja `refillMinVacancies`, el regalo vuelve y el test tiene que decirlo.
        - **Consecuencia asumida:** el tablero ya no vuelve siempre a N. Puede estabilizarse un hueco por debajo del mínimo hasta que el jugador vuelva a acertar. No es un bloqueo —acertar siempre lo desatasca— y la victoria por vaciado sigue siendo alcanzable, porque vaciar el tablero deja N huecos, muy por encima del mínimo.
        - **Verificado en el navegador:** con 1 y con 2 huecos no repone aunque pasen 6,5 s; al tercer acierto paga la deuda vencida. Acertando sin esperar, los huecos suben 1→2→3→4 y al quinto se adelanta la reposición y vuelve a 4.
    - **Corrección posterior: el mínimo de huecos no podía ser absoluto.** Al jugarlo apareció un defecto estructural que ningún test cazó, porque todos miraban pasos aislados y no una partida sostenida. Cada acierto genera una reposición y el tablero deja de pagarlas al bajar del mínimo, así que **un mínimo de G huecos dejaba el tablero fijo en N−(G−1)** para el resto de la partida: con G = 3 se perdían 2 tríadas permanentemente y los huecos oscilaban entre 2 y 3 sin volver a llenarse nunca. Además, la deuda vencida se cobraba en el mismo instante del tercer acierto, lo que se percibía como un pestañeo del tablero.
        - **El mínimo pasa a ser una preferencia con caducidad** (`refillGraceMs`): si tras el margen el tablero sigue por debajo, se repone igual, aceptando la colocación forzada. Quedarse corto para siempre es peor que el riesgo puntual. Se repone **una por margen**, de modo que el tablero se recupera a ritmo visible en lugar de llenarse de golpe.
        - **La reposición nunca se aplica en el fotograma del acierto** (`REFILL_APPEAR_MS`), lo que elimina el pestañeo.
        - **Test nuevo del caso sostenido:** una racha larga seguida de reposo debe devolver el tablero a N. Se juega en Precisión a propósito, porque Contrarreloj ganaría al alcanzar el objetivo y cancelaría las reposiciones pendientes antes de poder comprobarlo.
        - **Verificado en el navegador:** los huecos ya suben más allá del mínimo durante la racha (1→2→3→4) y, al dejar de jugar, el tablero vuelve a llenarse por completo (3→2→1→0). El total de tests pasa de 490 a 492.
    - **Tres defectos más, encontrados jugando y corregidos:**
        - **El tablero saltaba en cada reposición.** La causa era el `TransitionGroup`: al cambiar la clave, la celda saliente y la entrante **coexisten un fotograma** antes de que Vue aplique las clases de salida. Se midió instrumentando el DOM: la columna llegaba a **siete hijos** y las celdas pasaban por alturas de 92, 85, 79 y 72 px — es decir, todo el tablero encogía y volvía. Se eliminó el `TransitionGroup`: como ninguna celda cambia de fila, la clave pasa a ser la **fila** y Vue parchea la celda en su sitio. El fundido de entrada se anima ahora dentro de `VerbCell` con un `@keyframes` de opacidad, que no participa en el layout. Medido después: **seis hijos siempre y una sola altura** a lo largo de cuatro reposiciones.
        - **Terminar la partida y volver al menú dejaba el juego bloqueado.** El desenlace sobrevive a propósito para que `ResultScreen` lo lea, así que al salir sin pasar por el resultado el estado seguía en `won`/`lost` y, al entrar de nuevo a jugar, el modal de desenlace aparecía sobre la cuenta atrás: había que pulsar «Ver resultado» para poder seguir. Ahora `GameScreen` descarta cualquier partida terminada al montarse, y «Volver al menú» la descarta al salir.
        - **La posición contaba al propio jugador:** salía «2.º» estando solo en la tabla. La vista calcula el ritmo con `numeric` de Postgres y el cliente con coma flotante, así que la propia fila salía mínimamente mayor y cumplía el «me superan». Se excluye la fila propia con `neq`, que además es lo correcto por definición.
    - **Mejora de la pantalla de resultado (idea del usuario):** el puesto sólo se anuncia cuando hay algo que celebrar —récord o primera marca—; en el resto de partidas se muestra **«Tu mejor marca»** en ese modo y nivel. Decirle «quedaste 7.º» a quien acaba de hacer una partida floja no aporta nada y suena a reproche; su propia marca sí le dice cuánto le faltó.
- [x] **T7.3 — Onboarding «¿Cómo se juega?».** Modal desde el menú con qué es el juego, cómo se juega y los tres modos. Resuelve de paso el pendiente de **D7** sobre el resumen de nivel del menú.
    - `GameModal` sirvió tal cual con `dismissible`: ya aportaba `Teleport`, trampa de foco, cierre con `Esc` y fondo pulsable, `role="dialog"` y `aria-labelledby`.
    - El texto vive en `src/data/onboarding.ts` como constante tipada, no incrustado en el template: es contenido de producto y cambiará más a menudo que el marcado. Está redactado para el público de `PRODUCT.md` §4 —estudiantes de nivel básico y autodidactas— así que evita el vocabulario del proyecto: no se habla de «tríadas» ni de «pool». Los títulos son `h3` porque el del modal es un `h2`, para que la jerarquía no salte.
    - **Defecto encontrado al verificarlo en móvil: el modal se abría desplazado**, con el título fuera de pantalla. La causa era la trampa de foco, que enfoca el primer control —el botón del final— y eso arrastra el scroll. Se añadió la opción `focusContainer` a `useFocusTrap`, expuesta como `focusPanel` en `GameModal`: para un diálogo que es sobre todo texto, enfocar el contenedor es además el patrón correcto, porque el lector de pantalla lo anuncia igual y el contenido se lee desde el principio.
    - **D7 resuelto:** el resumen de nivel empieza ahora por el tamaño del repertorio (`49 verbos · 6 en pantalla · …`), que es lo único que significa algo en los tres modos. Antes hablaba sólo de partida —«objetivo de 8 · 90 s»— que no aplica al Modo Práctica, pese a que el nivel también decide de qué verbos pregunta.
    - **Verificado en el navegador:** abre con el scroll arriba y el título visible, el foco queda atrapado en el diálogo, `Esc` lo cierra, y a 375 px no desborda ni deja errores de consola.

### D11 — Se dobla el objetivo de Contrarreloj

- **Qué:** `targetVerbs` pasa de 8/10/12 a **16/20/24**, con los mismos tiempos.
- **Porqué:** la reposición diferida (D8) hizo el modo bastante más fácil —el tablero se vacía durante las rachas y hay menos distractores— y el objetivo anterior se alcanzaba sin apretar.
- **Se comprobó que la mecánica no lo limita:** un bot que resuelve a la velocidad del DOM, con cero tiempo de reconocimiento, gana los tres niveles en 3-4 segundos. La reposición forzada mantiene el suministro de verbos, así que el único límite es la velocidad humana — y eso ningún test lo mide. Quedan 5,6 s por acierto en `easy` y 4,2 s en `hard`.
- **Impacto:** `MECHANICS.md` §7 y `README.md`. Los ayudantes de los tests pasan a modelar a un jugador rápido —encadenan mientras haya tríadas y sólo esperan reposición cuando el tablero se agota—; esperar entre cada acierto consumía el límite y las partidas se perdían por reloj.

- [x] **T7.4 — Repaso de errores.** Botón en la pantalla de resultado que abre un modal con los fallos de la partida: qué se eligió y las tríadas completas de los verbos implicados.
    - **Modal y no ruta propia.** El resultado sólo vive en memoria, así que una ruta `/result/errors` se quedaría vacía al recargar — exactamente el defecto que se arregló en T7.1. El modal no tiene ese problema y reutiliza `GameModal` con `focus-panel`, la opción añadida en T7.3 para diálogos de texto largo.
    - **No existe «la» tríada correcta.** Al fallar se eligen celdas de hasta tres verbos distintos, así que se muestran las tríadas de **todos** los implicados, sin repetir. Es lo que revela dónde estaba la confusión: en la prueba real, elegir `cut` + `broke` + `cut` enseña `cut · cut · cut` junto a `break · broke · broken`.
    - **El registro es independiente del contador `errors`**, y tiene que serlo: en Modo Precisión `errors` es siempre 0 por especificación (`MECHANICS.md` §3, el fallo es el terminador de la ronda y no una penalización acumulable), pero el fallo ocurrió y es justo el más valioso de explicar.
    - Un intento incompleto se descarta en lugar de pintarse a medias: media explicación confunde más que ninguna.
    - **No se persiste.** Los fallos viven en memoria y mueren con la partida, coherente con el modo invitado. Repasar los de partidas anteriores exigiría otra tabla y otra migración; queda fuera de alcance.
    - Tests: 14 nuevos (11 de la lógica pura, 6 del registro en el store); el total pasa de 493 a 507. El test de `$state` volvió a saltar al añadir estado nuevo, que es para lo que existe.
    - **Verificado en el navegador:** el botón sólo aparece si hubo fallos, el modal abre con el scroll arriba, y a 375 px no desborda ni deja errores de consola.

### D12 — Renombrado de modos y el Dojo como modo de pleno derecho

- **Qué:** «Precisión» pasa a llamarse **Supervivencia** y «Practicar sin reloj» pasa a ser el **Dojo**. Además el Dojo deja de ser un botón aparte y se elige desde el mismo selector que los otros dos.
- **Cómo:** sólo cambian los textos visibles y los comentarios. **El identificador `precision` no se toca**, ni en el código, ni en las rutas, ni en la columna `mode` de `game_sessions`, ni en el `check` de la base, ni en las vistas de ranking (`CLAUDE.md` §5: el código en inglés, lo visible en español). Renombrarlo habría exigido una migración de datos para un cambio puramente de nombre.
- **El Dojo NO es un `GameMode`.** Se añadió `MENU_MODES` y el tipo `MenuMode` para lo que se elige en el menú, dejando `GAME_MODES` como los modos con ranking. La distinción no es cosmética: `GameMode` alimenta la columna `mode`, su `check` y las dos vistas; meter ahí el Dojo obligaría a relajar el schema para representar un modo que nunca se guarda. `HomeScreen` despacha a `/practice/:difficulty` o a `/play/:mode/:difficulty` según lo elegido, y la pantalla de ranking sigue recorriendo sólo `GAME_MODES`.
- **Porqué:** «Precisión» describía la regla, no la sensación; «Supervivencia» dice lo que se siente al jugar con un solo fallo disponible. Y presentar el Dojo como un botón secundario lo hacía parecer un extra, cuando `PRODUCT.md` §5 lo sitúa en el centro de la propuesta: es donde se aprende sin prisa.
- **Impacto:** `MECHANICS.md` y `README.md` actualizados. Las entradas anteriores de esta bitácora **conservan el nombre viejo a propósito**: son un registro de lo que se decidió cuando se decidió, no una especificación viva.
- **Verificado en el navegador:** los tres modos aparecen en el mismo selector, la descripción y el resumen de nivel se adaptan al elegido —el Dojo no habla de celdas ni de objetivo—, y el botón principal cambia a «Entrar al Dojo» y lleva a `/practice/easy`.

## Fase 6 — Cierre

- [ ] **T6.1 — Reescribir `README.md`** (hoy es el template genérico de Vue): qué es el proyecto, cómo correrlo, variables de entorno y modos de juego.
      _Nota: `CLAUDE.md` §3 exige actualizar el README dentro de cada tarea que cambie comportamiento visible. Esta tarea sólo consolida la estructura general; no sustituye esas actualizaciones incrementales._
- [ ] **T6.2 — Repaso final:** `pnpm type-check` y `pnpm build` limpios, `pnpm test` en verde, y revisión de accesibilidad en un móvil real.

---

## Verificación

**Por tarea** (Definition of Done, `CLAUDE.md` §1):

```sh
pnpm test          # tests de lógica de negocio en verde
pnpm type-check    # vue-tsc --build sin errores
```

**Por fase (end-to-end):**

- **Fases 1–2:** `pnpm test` cubre generación de tablero, reemplazo de selección por columna, validación por `verbId`, reposición de tríadas, penalización de tiempo, fin por primer error en Precisión y cálculo de ritmo con el piso mínimo.
- **Fase 3:** `pnpm dev` → jugar una ronda completa de cada modo. Verificar en móvil (o en el modo responsive de DevTools) que el tablero cabe sin scroll, que el modal se cierra con `Esc` y que el foco no escapa de él.
- **Fase 5:** jugar autenticado y confirmar la fila en `game_sessions`; jugar como invitado y confirmar que **no** se escribe nada; abrir el ranking con una segunda cuenta y verificar que se ven ambos jugadores (valida las políticas RLS y la tabla `profiles`).
- **Final:** `pnpm build` sin errores.

**Commits:** ningún paso de este plan ejecuta `git commit` ni `git push`. Se realizan únicamente al invocar `/autocommit` (`CLAUDE.md` §4).

---

## Bitácora de Decisiones

Todo cambio respecto al plan original se documenta aquí con el qué, el cómo y el porqué, preservando la trazabilidad.

### P1 — Reposición dinámica de tríadas en el tablero

- **Qué:** el tablero deja de ser un set estático de N tríadas que se agota; ahora mantiene siempre N tríadas visibles y repone con verbos nuevos del pool a medida que se resuelven.
- **Cómo:** al validar una tríada correcta, las 3 celdas liberadas se ocupan con un verbo aún no usado del pool del nivel, barajando su posición dentro de cada columna. Si el pool se agota, los huecos quedan vacíos y el tablero se reduce hasta resolverse.
- **Porqué:** `MECHANICS.md` §1 afirmaba que «el tablero se completa cuando las N tríadas quedan resueltas», pero §3 exige que en Modo Precisión el pool pueda ser mayor a lo que un jugador alcanza a completar. Ambas reglas son incompatibles con un tablero estático. La reposición unifica los dos modos bajo una sola mecánica y elimina el tiempo muerto de regenerar tableros enteros.
- **Impacto:** `MECHANICS.md` §1 actualizado. Afecta a T1.2 y T1.3.

### P2 — `user_id NOT NULL` en `game_sessions`

- **Qué:** la columna `user_id` de `game_sessions` pasa de nullable a obligatoria.
- **Cómo:** `user_id uuid not null references auth.users(id) on delete cascade`, con política RLS de insert restringida a `auth.uid() = user_id`.
- **Porqué:** `MECHANICS.md` §6 la declaraba nullable, pero §5 y `CLAUDE.md` §8 establecen que en modo invitado no se persiste nada. Una fila con `user_id NULL` sería, por definición, inalcanzable: nadie podría crearla ni reclamarla.
- **Impacto:** `MECHANICS.md` §6 actualizado. Afecta a T5.2 y T5.4.

### P3 — Nueva tabla `profiles`

- **Qué:** se añade al modelo de datos una tabla `profiles` que no estaba contemplada en `MECHANICS.md` §6.
- **Cómo:** `profiles(id → auth.users, display_name, avatar_url)`, poblada por un trigger `on auth.user created` a partir de los metadatos de Google. RLS: lectura pública, escritura sólo del dueño.
- **Porqué:** el ranking debe mostrar el nombre y avatar de otros jugadores, pero en Supabase el esquema `auth.users` no es legible entre usuarios. Sin una tabla propia de perfiles públicos, el ranking sólo podría mostrar UUIDs.
- **Impacto:** `MECHANICS.md` §6 actualizado. Afecta a T5.2, T5.3 y T5.4.

### D1 — Cierre de parámetros abiertos de `MECHANICS.md` §7

- **Qué:** se fijan valores iniciales para N, X, T, penalización por error y piso de ranking; y se resuelve el pendiente del Modo Práctica (sin cronómetro, con racha).
- **Cómo:** todos centralizados en `src/data/levels.ts` como constante tipada y congelada; `MECHANICS.md` §7 pasa de «Parámetros Abiertos» a «Parámetros de Balance» con la tabla de valores.
- **Porqué:** son parámetros de balance, no decisiones de arquitectura. Centralizarlos permite ajustarlos tras jugar el prototipo con un cambio de una línea, sin tocar la lógica.
- **Impacto:** `MECHANICS.md` §4 y §7 actualizados. Afecta a T0.7 y T4.1.

### D2 — Catálogo de verbos en el cliente, no en Postgres

- **Qué:** `verbs` no será una tabla de Supabase; permanece como `src/data/verbs.json`.
- **Cómo:** `user_progress.verb_id` referencia el `id` del JSON, sin foreign key a una tabla de verbos.
- **Porqué:** el catálogo es estático, de 106 filas, y se necesita completo en cada partida. Consultarlo remotamente añadiría latencia y una dependencia de red al inicio del juego sin ningún beneficio. Se migrará a tabla sólo si el catálogo pasa a ser editable desde la app.
- **Impacto:** `MECHANICS.md` §6 actualizado. Afecta a T5.2.

### D3 — Adopción del sistema de diseño "Neo-Paper Brutalist"

- **Qué:** el proyecto adopta la dirección visual del proyecto de Stitch «Irregular Verb Mastery» (`572532549164195270`): neobrutalismo con Paper UI.
- **Cómo:** se traduce su `design.md` a tokens de Tailwind 4 en `@theme` y a utilidades `@utility`, no se copia el marcado de las pantallas. Se toma como canónica la paleta **de la prosa** (papel `#F0EAD6`, amarillo `#FFFF00`, cyan `#00FFFF`, rosa `#FF69B4`, tinta `#000000`), no la del frontmatter YAML, porque el `design.md` se contradice entre ambas y los `override*Color` del propio proyecto coinciden con la prosa.
- **Porqué:** el estilo es la antítesis visual de la tabla de gramática estática que `PRODUCT.md` §1 identifica como el problema, así que refuerza la propuesta de valor en vez de sólo decorarla.
- **Exclusiones deliberadas:**
    - **Posicionamiento absoluto del tablero.** El mockup fija las celdas con `top-*` sobre una altura fija; nuestro tablero es dinámico (N variable + reposición, P1). Se rehace con flex/grid. El mockup además usa clases inexistentes (`top-88`, `top-104`, `top-112`).
    - **El `<header>` fijo** se reinterpreta como HUD de juego, ya que `CLAUDE.md` prohíbe cabeceras de sitio.
    - **El rojo como estado "seleccionado".** Colisiona con el rojo de error. Se reasignan los cuatro estados: seleccionada = amarillo, error = rosa. Dentro del tablero, amarillo y rosa quedan **reservados** a esos estados y no se usan decorativamente.
- **Impacto:** T0.5 completada; condiciona T3.1 y T3.2.

### D4 — Sistema de XP, niveles y puntos: aparcado

- **Qué:** las pantallas de Stitch muestran un sistema de progresión (Ranking por "PUNTOS", "Level 12 · 4.200 XP", "NIVEL SUBIDO", "+155 BONUS", "RANGO B", "Score" en Práctica) que no se implementa.
- **Cómo:** se ignora en la implementación. El ranking sigue siendo por tiempo (Objetivo) y ritmo (Precisión) según `MECHANICS.md` §2, §3 y §5, y Práctica sigue sin ranking.
- **Porqué:** contradice las métricas ya especificadas y es un sistema de progresión paralelo. Construirlo antes de validar que el juego base es divertido añade modelo de datos y pantallas sobre mecánicas no probadas.
- **Backlog:** evaluar tras el prototipo. Preguntas abiertas: ¿cuánto XP otorga cada partida y según qué? ¿los rangos se derivan de una métrica existente o de una nueva? ¿el XP convive con los dos rankings actuales o los sustituye?
- **Impacto:** ninguno en el plan actual; se revisa al cerrar la Fase 3.

### D5 — Idioma del código en inglés, documentación en español

- **Qué:** se fija la regla de dos planos en `CLAUDE.md` §5 y se refactoriza el código ya escrito, que mezclaba ambos.
- **Cómo:** identificadores, tipos, rutas y **valores de uniones de literales** pasan a inglés: `Difficulty = 'easy' | 'medium' | 'hard'`, `GameMode = 'target' | 'precision'`, rutas `/play/:mode/:difficulty`, `/practice`, `/result`. Se renombraron los identificadores en español de `StyleguideScreen.vue`, ambas suites de tests, `verbs.ts` y `levels.ts`. Siguen en español los comentarios, las descripciones de `describe`/`it`, la documentación y los textos de interfaz (`label: 'Fácil'`).
- **Porqué:** el código en inglés se mantiene coherente con el lenguaje y las bibliotecas sobre las que está escrito; mezclar planos produce construcciones como `getVerbsForDificultad`. Las URLs quedan en inglés por decisión explícita: un valor como `'easy'` es un identificador del dominio aunque sea visible en la barra de direcciones.
- **Impacto:** `CLAUDE.md` §5, `MECHANICS.md` §7, tablas de balance de este archivo, y los archivos de `src/`. Sin cambios de comportamiento.

### D6 — Linting y formato con gate previo al commit

- **Qué:** se añade ESLint 10 (flat config) con `eslint-plugin-vue` y `typescript-eslint`, más Prettier, y se convierte `pnpm check` en el gate de `/autocommit`.
- **Cómo:** Prettier se configuró para respetar el estilo ya existente (tabs, sin punto y coma, comillas simples, `bracketSpacing: false`), con overrides a 2 espacios para JSON y YAML porque `useTabs` aplica a todos los lenguajes. La documentación `*.md` se excluye de Prettier a propósito. El gate pasó a ejecutarse **antes** de crear los commits, no antes del push.
- **Porqué:** el gate original corría los tests después de commitear y sólo bloqueaba el push, así que el código roto igual quedaba en el historial local. Además `no-explicit-any` como regla de ESLint hace exigible el §5 de `CLAUDE.md`, que hasta entonces era sólo una intención escrita.
- **Impacto:** `CLAUDE.md` §1 y §13 (nueva), `.claude/commands/autocommit.md` §4 y §5, `eslint.config.ts`, `.prettierrc.json`, `.prettierignore`, `.editorconfig` y los scripts de `package.json`.

### P4 — Dos huecos de `MECHANICS.md` §1 resueltos al implementar T1.3

- **Qué:** se cierran dos puntos que la especificación no cubría: dónde se coloca exactamente la tríada repuesta, y qué pasa al pulsar una celda que ya está seleccionada.
- **Cómo:** (1) la tríada entrante ocupa **filas distintas en las tres columnas**, elegidas al azar; la celda que estuviera en la fila de destino baja al hueco liberado, de modo que sólo se mueve una celda extra por columna. (2) Pulsar la celda ya seleccionada de una columna la **deselecciona**.
- **Porqué:** P1 dice que la tríada nueva ocupa «las 3 celdas liberadas, con posición barajada dentro de cada columna», lo que admitía la lectura literal de rellenar el hueco sin más. Esa lectura filtra información: el jugador acaba de ver cambiar tres celdas, así que dos alineadas en la misma fila le dicen gratis que son del mismo verbo, y con `N = 6` eso ocurriría en torno al 44 % de las reposiciones. Desplazar toda la columna lo evitaría también, pero le movería el tablero bajo los dedos a media partida; el intercambio de dos posiciones consigue lo mismo con la mínima disrupción. Lo segundo es un hueco puro: §1 sólo describe el reemplazo entre celdas distintas de una columna, y en pantalla táctil poder deshacer una selección es lo que el jugador espera.
- **Impacto:** `MECHANICS.md` §1 (dos viñetas nuevas), `lib/board.ts` (`replaceTriad`) y `composables/useBoard.ts` (`select`). Ambas decisiones son reversibles en una línea si al jugar el prototipo resultan molestas.

### P5 — El estado visual `resolved` es de transición, no de tablero

- **Qué:** las celdas de una tríada acertada salen del modelo de inmediato; el estado `resolved` de `CellStatus` no describe una celda que permanezca en el tablero.
- **Cómo:** al acertar, `useBoard` reemplaza o retira las tres celdas en el mismo instante. El `SelectionOutcome` de tipo `match` devuelve los `cellIds` que salen, para que la UI (T3) los anime con `<TransitionGroup>` usando el `CellId` como clave: la celda saliente se atenúa mientras la entrante aparece, sin que el dominio tenga que retener estado muerto ni esperar a un temporizador. `getCellStatus` sigue contemplando `resolved` por si una celda de un verbo resuelto llega a consultarse durante esa transición.
- **Porqué:** `MECHANICS.md` §1 dice que las celdas acertadas «se marcan como resueltas (ej. bloqueadas/atenuadas)» y P1 dice que se reemplazan por una tríada nueva. Con reposición dinámica ambas cosas no pueden coexistir en el modelo: o la celda sigue ahí atenuada, o entra otra en su lugar. Resolverlo en la capa de animación en vez de en el dominio evita que el motor de juego arrastre un estado intermedio que sólo existe para la vista.
- **Impacto:** `types/game.ts` (`SelectionOutcome`), `composables/useBoard.ts`. Condiciona T3.3: la cuadrícula del tablero debe animar salidas y entradas por `CellId`, no por índice de fila.

### D7 — Práctica dirigida: aparcada como feature futura

- **Qué:** un modo de práctica que no sortee del pool completo del nivel, sino que **priorice los verbos que el jugador falla o aún no domina**. Hoy el Modo Práctica sortea uniformemente de todo el pool del nivel elegido, así que un verbo ya dominado sale con la misma probabilidad que uno que se falla siempre.
- **Cómo (cuando se implemente):** el store `progress` ya guarda aciertos, errores y `masteredVerbIds` por verbo, así que la pieza que falta es sólo el filtro o el sesgo del sorteo en `createQuestion`. Opciones a evaluar: pool restringido a los no dominados, sorteo ponderado por tasa de error, o un modo «repaso de fallos» aparte.
- **Porqué se aparca:** no estaba en el plan de la Fase 4 y añade una decisión de diseño real —si se excluyen los dominados, el jugador deja de repasarlos y los olvida; la repetición espaciada existe precisamente por eso—. Merece decidirse con datos de uso, no antes.
- **Preguntas abiertas:** ¿es un modo aparte o una opción del actual? ¿los verbos dominados desaparecen del todo o sólo bajan de frecuencia? ¿debería reaparecer un verbo dominado pasado un tiempo sin practicarlo (`lastPracticedAt` ya se registra para esto)?
- **Impacto:** ninguno en el plan actual. También queda pendiente que el resumen de nivel del menú, hoy redactado en términos de partida («objetivo de 8 · 90 s»), diga algo útil cuando la intención es practicar.

### P6 — Cómo se registran los errores y qué clasifica en el Modo Precisión

- **Qué:** `MECHANICS.md` §3 decía a la vez que un solo error termina la ronda y que toda partida registrada en ese modo tiene cero errores. Se cierra la contradicción: el fallo es el **terminador** de la ronda, no una penalización acumulable, y por tanto no se contabiliza. En Modo Precisión `errors` es siempre 0.
- **Cómo:** `applyErrorRules` en `stores/game.ts` llama a `finish('lost')` sin tocar el contador. Además, `isEligibleForRanking` admite **ambos desenlaces** en este modo —terminar por fallo o vaciar el tablero— siempre que se supere `MIN_MATCHES_FOR_RANKING`.
- **Porqué:** la lectura alternativa, registrar sólo las partidas terminadas sin fallo, dejaría el ranking prácticamente vacío. El propio §3 dice que el pool puede ser mayor que lo que un jugador completa en una sesión y que el objetivo es emparejar la mayor cantidad posible **antes de fallar**: terminar fallando es el caso normal, no la excepción. Contar ese fallo como error de la sesión contradiría además la frase de la propia especificación.
- **Impacto:** `MECHANICS.md` §3 (tres viñetas nuevas), `stores/game.ts` y `lib/ranking.ts`. Condiciona el schema de Fase 5: `game_sessions.errors` será siempre 0 en las filas del Modo Precisión, así que no sirve para distinguir desenlaces en ese modo.

### D8 — Reposición diferida y sin desordenar el tablero

- **Qué:** al acertar una tríada, sus celdas dejan de retirarse al instante. Pasan a estado `resolved` —atenuadas y no pulsables— y una reposición agendada por tríada las sustituye tras `refillDelayMs`. La tríada entrante ocupa **sólo filas libres**, sin mover ninguna celda ajena. Deja de ser cierto que siempre haya N tríadas visibles.
- **Cómo:** `refillSlots` sustituye a `replaceTriad` y `replaceInColumn`, que se eliminan. `useBoard.resolveTriad` deja de reponer y `visibleCount` pasa a contar las celdas no resueltas. `stores/game.ts` agenda la reposición y **la cancela en `finish` y `resetGame`**, para que una partida terminada no siga repoblando el tablero.
- **Porqué:** la reposición inmediata movía una celda ajena por columna, y el jugador que acababa de localizarla la perdía de vista. Eso se percibe como injusto. Y no era un descuido: `MECHANICS.md` §1 y **P1** prohíben que la tríada entrante quede alineada en la misma fila en dos columnas, porque delataría que son del mismo verbo; con sólo tres huecos forzados, la única forma de cumplirlo era mover una celda. **El retardo es lo que hace viable la regla sin desorden:** al acumular huecos, hay filas libres de sobra donde colocar la entrante en filas distintas.
- **Efecto secundario asumido:** un tablero que se vacía durante una racha tiene menos distractores, así que ambos modos se vuelven más fáciles. Los parámetros de `LEVELS` quedan pendientes de reajuste tras jugar.
- **Impacto:** `MECHANICS.md` §1 y §7. Elimina los invariantes de `replaceTriad` en `board.spec.ts` y obliga a reescribir con temporizadores falsos los bucles `while (!isCleared)` de `useBoard.spec.ts`. Activa por fin el estado `resolved`, que estaba definido en los tipos y estilado en `main.css` pero era **CSS muerto**, y cumple lo previsto en **P5** sobre animar salidas y entradas con `TransitionGroup` por `CellId`.

### D9 — El desenlace se comunica sobre el tablero, no en otra ruta

- **Qué:** el fin de partida se muestra con un modal sobre el tablero congelado, y a `/result` se navega por acción del usuario en lugar de automáticamente.
- **Cómo:** segundo `GameModal` en `GameScreen` abierto con `isFinished`; se elimina el `watch` que navegaba solo. `ResultScreen` deja de resetear incondicionalmente al desmontarse y, sin resultado, muestra un estado vacío en lugar de redirigir en silencio.
- **Porqué:** el camino de la derrota por tiempo era correcto, pero **todo el feedback vivía en otra ruta, detrás de una navegación asíncrona y dependiendo de un estado en memoria que sobreviviera al desmontaje**. `ResultScreen` se borraba el resultado a sí misma al salir y redirigía a `home` con `replace` cuando no lo encontraba, así que cualquier remontaje —una recarga, entrar por URL, volver atrás— aterrizaba en el menú sin decir nada. Había además un segundo camino con la misma percepción: `router.push` sin `.catch()` y sin `router.onError`, de modo que un fallo al cargar el chunk dejaba al jugador ante un tablero muerto a 0:00. Mostrar el desenlace in situ elimina la clase de fallo entera en vez de parchear la redirección.
- **Ventaja adicional:** el jugador ve en qué estado quedó el tablero, que es información real —qué tríadas le faltaban—, en lugar de perderla al saltar de pantalla.
- **Impacto:** `GameScreen.vue`, `ResultScreen.vue`. Añade a `stores/ranking.ts` la consulta de posición (un `count` de cuántos te superan, sin migración nueva) y la de récord personal, que debe leerse **antes** de insertar la partida o se compararía consigo misma.

### D10 — Se borra el ranking al cambiar las reglas

- **Qué:** las filas de `game_sessions` anteriores a D8 se eliminan con una migración.
- **Porqué:** un tablero que se vacía durante la racha cambia la dificultad, así que un tiempo de antes y uno de después no son comparables. Mantenerlos mezclaría en la misma tabla partidas jugadas con reglas distintas, que es peor que empezar de cero: el ranking dejaría de medir lo que dice medir.
- **Alternativa descartada:** añadir una columna de versión de reglas y filtrar por la vigente. Conserva el historial, pero añade complejidad permanente a un prototipo cuyas filas actuales son unas pocas partidas de prueba.
- **Impacto:** una migración de datos, documentada como reinicio deliberado.
