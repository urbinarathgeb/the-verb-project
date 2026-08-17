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

- [ ] **T1.1 — `lib/shuffle.ts`.** Fisher-Yates con RNG inyectable (seed) para tests deterministas. Tests: preserva elementos, no muta el original, misma seed → misma salida.
- [ ] **T1.2 — Generación de tablero (`composables/useBoard.ts`).** Toma pool de verbos + `N` → 3 columnas de N celdas, cada columna barajada de forma independiente. Garantías testeadas: cada celda conoce su `verbId` y su `form`; ninguna columna queda en el orden original; existe exactamente una celda por (verbo, forma).
- [ ] **T1.3 — Selección y validación.** Máximo una celda seleccionada por columna; seleccionar otra en la misma columna **reemplaza** la anterior (`MECHANICS.md` §1). Con 3 seleccionadas, validar **por `verbId`, nunca por texto**. Correcto → marcar resueltas + reponer tríada (P1). Incorrecto → deseleccionar las 3 + estado de error transitorio. Tests: reemplazo dentro de columna, acierto, error, orden de selección irrelevante, reposición correcta, agotamiento del pool.
- [ ] **T1.4 — `composables/useTimer.ts`.** Cuenta regresiva y ascendente, `start` / `pause` / `reset`, penalización aplicable, callback al llegar a 0. Tests con `vi.useFakeTimers()`.

## Fase 2 — Motor de juego y modos contrarreloj

- [ ] **T2.1 — `stores/game.ts`.** Estado de partida: modo, nivel, tablero, aciertos, errores, `elapsedMs`, `status` (`idle | playing | won | lost`). Acciones puras y testeables.
- [ ] **T2.2 — Modo Objetivo.** Cuenta regresiva desde `T`, penalización por error, éxito al alcanzar `X` aciertos, derrota al llegar a 0. Resultado: `time_ms` empleado. **Sólo los intentos exitosos son candidatos a ranking** (`MECHANICS.md` §2).
- [ ] **T2.3 — Modo Precisión.** Cronómetro ascendente; **el primer error termina la ronda** → por definición `errors = 0` en toda partida registrada. Cálculo de ritmo y aplicación del piso `MIN_MATCHES_FOR_RANKING`. Test explícito del caso degenerado: 1 acierto en 300 ms no clasifica.
- [ ] **T2.4 — `composables/useGameEngine.ts`.** Interfaz pública única que envuelve `useGameStore()` con `storeToRefs`, siguiendo el ejemplo de `CLAUDE.md` §6. A partir de aquí ningún componente importa un store.

## Fase 3 — UI del juego

- [ ] **T3.1 — Componentes puros.** `VerbCell` (estados neutra / seleccionada / resuelta / error, sin lógica de negocio), `BoardColumn`, `GameBoard`, `HudBar` (tiempo, aciertos, errores, objetivo) y `GameModal` (base reutilizable).
- [ ] **T3.2 — `HomeScreen` + `GameScreen`.** Home: elegir modo y nivel. GameScreen: HUD + tablero + modal de cuenta atrás inicial. Layout a pantalla completa, sin header ni footer.
- [ ] **T3.3 — `ResultScreen`.** Métricas según modo (tiempo en Objetivo; ritmo + aciertos en Precisión), botones de reintentar y volver. Para invitados, aviso de que el resultado no se guarda.
- [ ] **T3.4 — Accesibilidad y responsive** (`CLAUDE.md` §11). `composables/useFocusTrap.ts` para modales (foco atrapado, cierre con `Esc`), navegación por teclado del tablero (flechas + Enter), targets táctiles ≥ 44 px, `aria-live` para el feedback de acierto/error, y verificación de contraste sobre los tokens de T0.5.

> **Hito:** al cerrar la Fase 3 los dos modos competitivos son jugables de punta a punta en modo invitado. Punto natural para jugar y ajustar `data/levels.ts` antes de continuar.

## Fase 4 — Modo Práctica

- [ ] **T4.1 — Lógica de práctica.** Genera pregunta (verbo + forma solicitada) con 1 respuesta correcta y **2 distractores tomados de la misma forma en otros verbos del pool** (`MECHANICS.md` §4). Racha que incrementa con acierto y se resetea con error. Sin cronómetro. Tests: los distractores nunca coinciden con la respuesta correcta, distribución de formas solicitadas, reglas de racha.
- [ ] **T4.2 — `stores/progress.ts` (en memoria) + `usePracticeEngine`.** Aciertos y errores por verbo. En esta fase vive sólo en Pinia; la Fase 5 lo sincroniza.
- [ ] **T4.3 — `PracticeScreen` + `ChoiceButton`.** Feedback inmediato y racha visible en el HUD.

## Fase 5 — Supabase: auth, ranking y progreso

> Antes de escribir cualquier SQL, cargar la skill `supabase-postgres-best-practices`.

- [ ] **T5.1 — Cliente.** `@supabase/supabase-js`, `lib/supabase.ts`, `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ya cubierto por el patrón `*.local` del `.gitignore`), tipado en `env.d.ts`.
- [ ] **T5.2 — Schema + RLS.** Migraciones en `supabase/migrations/`:
    - `profiles(id → auth.users, display_name, avatar_url)`, poblada por trigger al registrarse (P3). RLS: lectura pública, escritura sólo del dueño.
    - `game_sessions(id, user_id NOT NULL, mode, level, time_ms, errors, verbs_matched, completed_at)` con `check` en `mode` y `time_ms > 0` (P2). RLS: insert sólo con `auth.uid() = user_id`; lectura pública para alimentar el ranking.
    - `user_progress(user_id, verb_id, hits, misses, last_practiced_at)` con PK compuesta. RLS: sólo el dueño lee y escribe.
    - Índices para las consultas de ranking: `(mode, level, time_ms)` y `(mode, level, verbs_matched, time_ms)`.
    - **Nota:** el catálogo de verbos se mantiene **en el cliente** (`verbs.json`), no en la base. Es estático, pequeño y no requiere consulta remota; `user_progress.verb_id` referencia el id del JSON. Se migrará a tabla sólo si el catálogo pasa a ser editable.
- [ ] **T5.3 — Auth con Google.** `stores/auth.ts` + `composables/useAuth.ts`, ruta `/auth/callback`, restauración de sesión al cargar, y **modo invitado plenamente funcional** (nada bloquea el juego sin login).
- [ ] **T5.4 — Persistencia de partidas y ranking.** Al terminar una partida, si hay usuario autenticado se inserta en `game_sessions` (en Objetivo, sólo si alcanzó el objetivo). Vista o RPC por modo que devuelve el **mejor resultado por usuario**: Objetivo → `time_ms` ascendente; Precisión → ritmo descendente filtrando `verbs_matched >= 5`. `RankingScreen` + `RankingTable`, con pestañas por modo y nivel.
- [ ] **T5.5 — Sincronizar `user_progress`.** El Modo Práctica hace upsert incremental por verbo para usuarios autenticados.

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
