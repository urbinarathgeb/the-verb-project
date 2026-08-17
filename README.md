# The Verb Project

Juego web para aprender y practicar las formas de los verbos irregulares en inglés: presente, pasado y participio.

En lugar de estudiar una tabla de gramática, se juega. El tablero muestra tres columnas desordenadas —una por forma verbal— y hay que emparejar las tres formas de cada verbo contra el reloj.

> **Estado:** prototipo en desarrollo. Los dos modos contrarreloj ya son jugables en modo invitado. El modo Práctica, el login y el ranking están pendientes (ver `PLAN.md`).

## Cómo se juega

El tablero muestra **N verbos** en sus tres formas, repartidos en tres columnas. Dentro de cada columna el orden está desordenado: la fila **no** indica correspondencia.

Se selecciona **una celda por columna**, en cualquier orden. Al completar las tres:

- **Acierto:** la tríada sale del tablero y entra una nueva en su lugar, mientras queden verbos en el pool del nivel.
- **Fallo:** las tres celdas se deseleccionan y se marcan brevemente en rosa.

Pulsar otra celda de una columna que ya tenía selección la reemplaza; pulsar la celda ya seleccionada la deselecciona.

## Accesibilidad

El tablero se puede jugar entero con el teclado: **flechas** para moverse entre celdas y columnas, **Enter** o **Espacio** para seleccionar. Los modales atrapan el foco mientras están abiertos y lo devuelven al cerrarse.

El resultado de cada jugada se anuncia a los lectores de pantalla, ya que de otro modo sólo se comunicaría por color y movimiento. Todos los colores del sistema superan el nivel AAA de contraste de WCAG, y las animaciones se desactivan si el sistema pide reducir movimiento.

## Modos

| Modo | Reloj | Cómo se gana | Cómo se pierde |
| --- | --- | --- | --- |
| **Contrarreloj** | Cuenta atrás desde el límite del nivel | Alcanzar el objetivo de aciertos | Que se acabe el tiempo |
| **Precisión** | Cronómetro ascendente, sin límite | Vaciar el tablero | Un solo error |
| **Práctica** | Sin reloj | No se gana ni se pierde | — |

En **Contrarreloj** los errores no terminan la partida, pero restan tiempo (2 s o 3 s según el nivel) y ese tiempo también cuenta para la clasificación.

El **modo Práctica** es el relajado: muestra una forma verbal y pregunta por otra, con tres alternativas. Cualquiera de las tres formas puede aparecer en el enunciado y cualquiera de las otras dos como pregunta, así que también se practican los saltos difíciles como participio → pasado. El enunciado indica siempre de qué forma parte, porque hay verbos que se escriben igual en varias. No hay ranking: alimenta el progreso personal y una racha que sube con cada acierto y se reinicia al fallar.

En **Precisión** el primer error termina la ronda de inmediato. La métrica es el **ritmo**: verbos por minuto, `(aciertos / segundos) × 60`. Premia acertar mucho y rápido, así que jugar despacio para acumular aciertos no compensa.

## Niveles

| Nivel | Verbos del catálogo | En pantalla | Objetivo | Tiempo | Penalización |
| --- | --- | --- | --- | --- | --- |
| Fácil | 49 (básicos) | 6 | 8 | 90 s | −2 s |
| Medio | 86 (básicos + intermedios) | 8 | 10 | 90 s | −2 s |
| Difícil | 106 (catálogo completo) | 10 | 12 | 100 s | −3 s |

Los valores viven en `src/data/levels.ts` y se espera ajustarlos tras jugar el prototipo.

## Pantallas disponibles

- `/` — menú: elegir modo y nivel.
- `/play/:mode/:difficulty` — partida, con cuenta atrás inicial de 3 segundos.
- `/practice/:difficulty` — modo Práctica, sin reloj.
- `/result` — desenlace con las métricas del modo jugado.
- `/styleguide` — guía visual del sistema de diseño. **Sólo en desarrollo**, no entra en el bundle de producción.

El resto de rutas (`/ranking`, `/auth/callback`) existen pero aún son placeholders.

## Desarrollo

Requiere [pnpm](https://pnpm.io) y Node 22.18+ o 24.12+.

```sh
pnpm install
pnpm dev
```

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo en `localhost:5173` |
| `pnpm build` | Compilación de producción |
| `pnpm check` | Lint, formato, tipos y tests en paralelo |
| `pnpm test` | Vitest |
| `pnpm lint:fix` | ESLint con autocorrección |
| `pnpm format` | Prettier en modo escritura |

`pnpm check` es el gate que debe pasar en verde antes de cualquier commit.

## Stack

Vue 3.5 (Composition API con `<script setup>`), TypeScript estricto, Vite, Tailwind CSS 4, Pinia y Vitest. Supabase (Auth + Postgres) está previsto para la fase de persistencia y ranking.

## Documentación del proyecto

- **`PRODUCT.md`** — el problema y la propuesta de valor.
- **`MECHANICS.md`** — especificación de las mecánicas de juego.
- **`PLAN.md`** — plan de ejecución y bitácora de decisiones.
- **`CLAUDE.md`** — convenciones técnicas y protocolos de trabajo.
