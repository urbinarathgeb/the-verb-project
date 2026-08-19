# The Verb Project

Juego web para aprender y practicar las formas de los verbos irregulares en inglés: presente, pasado y participio.

En lugar de estudiar una tabla de gramática, se juega. El tablero muestra tres columnas desordenadas —una por forma verbal— y hay que emparejar las tres formas de cada verbo. Hay dos modos competitivos y un tercero sin reloj ni derrota, para aprender sin prisa.

> **Estado:** prototipo en desarrollo. Los tres modos son jugables, con o sin cuenta, y el login con Google, la clasificación y el progreso persistente ya funcionan. Pendiente: ajustes de jugabilidad y cierre.

## Cómo se juega

El tablero muestra **N verbos** en sus tres formas, repartidos en tres columnas. Dentro de cada columna el orden está desordenado: la fila **no** indica correspondencia.

Se selecciona **una celda por columna**, en cualquier orden. Al completar las tres:

- **Acierto:** las tres celdas se atenúan y quedan como huecos. Unos segundos después entra una tríada nueva, mientras queden verbos en el pool del nivel.
- **Fallo:** las tres celdas se deseleccionan y se marcan brevemente en rosa.

Pulsar otra celda de una columna que ya tenía selección la reemplaza; pulsar la celda ya seleccionada la deselecciona.

La reposición **tarda unos segundos a propósito**: durante esa espera puedes seguir acertando y el tablero se va vaciando, así que encadenar aciertos se nota. Y las tríadas nuevas ocupan sólo huecos: **ninguna celda que ya estuviera en el tablero se mueve de sitio**.

Durante la partida, el aspa del marcador —o `Esc`— pide confirmación para abandonar y volver al menú. Y si mandas la pestaña a segundo plano, **la partida se pausa y el reloj se detiene**: se reanuda cuando tú lo digas, no al volver. Una notificación o una llamada ya no arruinan una partida.

Además espera a que haya al menos tres huecos antes de reponer. Con uno solo, la tríada nueva caería justo donde estaba la que acabas de resolver, y eso te la regalaría. Esa espera **no es indefinida**: si dejas de acertar, pasado un margen se repone igual, porque quedarse con el tablero corto para siempre sería peor. Y si encadenas tantos aciertos que se queda casi desierto, la reposición se adelanta sola.

## Accesibilidad

El tablero se puede jugar entero con el teclado: **flechas** para moverse entre celdas y columnas, **Enter** o **Espacio** para seleccionar. Los modales atrapan el foco mientras están abiertos y lo devuelven al cerrarse. Los que se pueden descartar —el «¿Cómo se juega?» y la confirmación de abandonar— se cierran con `Esc`, tocando fuera o con el aspa de su cabecera, que se queda fija junto con los botones aunque el texto sea largo.

En el Dojo, las teclas **1**, **2** y **3** responden, y el foco salta solo al botón «Siguiente» al contestar, de modo que se puede encadenar preguntas sin tocar el ratón.

El resultado de cada jugada se anuncia a los lectores de pantalla, ya que de otro modo sólo se comunicaría por color y movimiento. Cada pregunta nueva del Dojo también se anuncia entera. Todos los colores del sistema superan el nivel AAA de contraste de WCAG, y las animaciones se desactivan si el sistema pide reducir movimiento.

En móvil, el acierto y el fallo se acompañan de una **vibración corta**, que también se omite si se ha pedido reducir movimiento.

Si el tablero no cabe a lo alto —el nivel difícil en un móvil pequeño, o cualquier nivel en horizontal—, se desplaza en lugar de encoger las celdas: el área táctil de 44 px no se sacrifica nunca.

## Modos

| Modo | Reloj | Cómo se gana | Cómo se pierde |
| --- | --- | --- | --- |
| **Contrarreloj** | Cuenta atrás desde el límite del nivel | Alcanzar el objetivo de aciertos | Que se acabe el tiempo |
| **Supervivencia** | Cronómetro ascendente, sin límite | Vaciar el tablero | Un solo error |
| **Dojo** | Sin reloj | No se gana ni se pierde | — |

En **Contrarreloj** los errores no terminan la partida, pero restan tiempo (2 s o 3 s según el nivel) y ese tiempo también cuenta para la clasificación.

El **Dojo** es el relajado: muestra una forma verbal y pregunta por otra, con tres alternativas. Cualquiera de las tres formas puede aparecer en el enunciado y cualquiera de las otras dos como pregunta, así que también se practican los saltos difíciles como participio → pasado. El enunciado indica siempre de qué forma parte, porque hay verbos que se escriben igual en varias. No hay ranking: alimenta el progreso personal y una racha que sube con cada acierto y se reinicia al fallar.

En **Supervivencia** el primer error termina la ronda de inmediato. La métrica es el **ritmo**: verbos por minuto, `(aciertos / segundos) × 60`. Premia acertar mucho y rápido, así que jugar despacio para acumular aciertos no compensa.

## Niveles

| Nivel | Verbos del catálogo | En pantalla | Objetivo | Tiempo | Penalización |
| --- | --- | --- | --- | --- | --- |
| Fácil | 49 (básicos) | 6 | 16 | 90 s | −2 s |
| Medio | 86 (básicos + intermedios) | 8 | 20 | 90 s | −2 s |
| Difícil | 106 (catálogo completo) | 10 | 24 | 100 s | −3 s |

Los valores viven en `src/data/levels.ts` y se espera ajustarlos tras jugar el prototipo.

## Pantallas disponibles

- `/` — menú: elegir modo y nivel, con un «¿Cómo se juega?» que explica el juego en tres bloques.
- `/play/:mode/:difficulty` — partida, con cuenta atrás inicial de 3 segundos y modal de desenlace al terminar.
- `/practice/:difficulty` — Dojo, sin reloj.
- `/result` — desenlace con las métricas del modo jugado y, si hubo fallos, un repaso de cada uno con las formas correctas. Si bates tu marca, la posición en la clasificación; si no, tu mejor marca en ese nivel.
- `/ranking` — clasificación por modo y nivel.
- `/progress` — qué verbos dominas y cuáles se te resisten, con lo peor primero.
- `/auth/callback` — vuelta desde Google al iniciar sesión. Es una pantalla de tránsito: comprueba el acceso y redirige al menú.
- `/styleguide` — guía visual del sistema de diseño. **Sólo en desarrollo**, no entra en el bundle de producción.

## Clasificación

Es pública: se puede consultar sin cuenta. Hay **seis tablas** —dos modos por tres niveles— porque comparar un tiempo de nivel fácil con uno de difícil no significaría nada: cambian el tamaño del tablero y el objetivo.

Al terminar una partida, el desenlace se anuncia **sobre el propio tablero**, que queda congelado para que se vea qué faltaba. Desde ahí se pasa al resultado, que con sesión iniciada muestra en qué puesto has quedado y avisa si has batido tu marca en ese modo y nivel.

Cada tabla muestra el **mejor resultado de cada jugador**, no todas sus partidas, para que quien más juegue no copie la tabla con sus propios intentos. «Mejor» significa cosas distintas por modo: en Contrarreloj el menor tiempo, en Supervivencia el mayor ritmo en verbos por minuto. Los empates comparten posición.

Qué se guarda al terminar una partida, si has iniciado sesión:

| Situación | Se guarda | Entra al ranking |
| --- | --- | --- |
| Contrarreloj, objetivo alcanzado | Sí | Sí |
| Contrarreloj, se acabó el tiempo | No | No |
| Supervivencia, 5 aciertos o más | Sí | Sí |
| Supervivencia, menos de 5 aciertos | Sí | No |
| Cualquiera, como invitado | No | No |

Una partida de Supervivencia floja se guarda igual porque forma parte de tu historial, aunque no clasifique. Una derrota en Contrarreloj no se guarda: no tiene tiempo que comparar.

## Cuenta e inicio de sesión

Se puede jugar **sin cuenta**, y es un modo de primera clase: todos los modos, todos los niveles y el Dojo funcionan igual. Lo único que cambia es que el progreso vive en memoria y se pierde al recargar, y que las partidas no entran al ranking.

Iniciar sesión con Google se ofrece desde el menú. Si la aplicación arranca sin credenciales de Supabase, el acceso ni se muestra: no tendría a dónde ir, así que la app se comporta como si fuera de invitado permanente en lugar de ofrecer un botón que falla.

Al cerrar sesión se borra el progreso acumulado en memoria, para que no quede atribuido a quien siga jugando en el mismo navegador.

### Progreso del Dojo

Con sesión iniciada, los aciertos y fallos por verbo se guardan y se recuperan al volver. Se envían **agrupados cada pocos segundos**, y también al salir de la pantalla o al mandar la pestaña a segundo plano, así que no hace falta esperar a nada antes de cerrar.

Lo que se manda son **incrementos**, no totales: «suma un acierto al verbo 7». Eso permite practicar en el móvil y en el portátil sin que uno pise lo aprendido en el otro. Si falla la red, lo pendiente se conserva y se reintenta en el siguiente envío.

Lo practicado **como invitado no se sube** al iniciar sesión después: no se pidió atribuírselo a esa cuenta.

Todo eso se ve en `/progress`, accesible desde el menú: cuántos verbos dominas, cuántos has tocado y tu porcentaje global, más la lista de los practicados **ordenada por lo que peor se te da**. Un verbo cuenta como dominado con al menos 3 aciertos y un 80 % de acierto: sólo el porcentaje sería frágil con tres opciones, y sólo el número premiaría insistir hasta acertar.

## Instalarla como aplicación

La app trae manifiesto e iconos, así que el navegador ofrece instalarla y entonces se abre sin barra de direcciones, a pantalla completa. **No fija la orientación** a propósito: aunque el tablero esté pensado para vertical, WCAG 1.3.4 pide no restringirla, y en horizontal el tablero se desplaza.

Instalada no hay botón «atrás» del navegador, y por eso la partida tiene su propia salida en el marcador.

## Desarrollo

Requiere [pnpm](https://pnpm.io) y **Node 22.18+ o 24.12+**; con una versión por debajo, pnpm avisa en cada comando (`Unsupported engine`).

```sh
pnpm install
pnpm dev
```

### Variables de entorno

Opcionales: sin ellas la app arranca y se juega en modo invitado. Se copian de `.env.example` a `.env.local`, que no se versiona.

| Variable | Qué es |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima, pública por diseño. La seguridad la aplica RLS en la base de datos, no el secreto de esta clave |

La clave `service_role` **no** se usa en este proyecto: salta RLS, y el código corre íntegramente en el navegador.

Para que el acceso con Google funcione hace falta además, en el panel de Supabase: activar el proveedor Google con su client ID y secret, poner `http://localhost:5173` como **Site URL** y añadir `http://localhost:5173/**` a **Redirect URLs**.

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo en `localhost:5173` |
| `pnpm build` | Compilación de producción |
| `pnpm check` | Lint, formato, tipos y tests en paralelo |
| `pnpm test` | Vitest |
| `pnpm lint:fix` | ESLint con autocorrección |
| `pnpm format` | Prettier en modo escritura |

`pnpm check` es el gate que debe pasar en verde antes de cualquier commit.

### Despliegue

La app usa historial HTML5, así que **ninguna ruta existe como archivo**: `/ranking` o `/auth/callback` sólo las resuelve el router una vez cargada la aplicación. El hosting tiene que servir `index.html` para cualquier ruta, o devolverá 404 al entrar por URL directa, al recargar dentro del juego y —de forma más visible— al volver de Google tras iniciar sesión.

En Vercel lo resuelve `vercel.json`, versionado en el repo. En otro proveedor hay que configurar el mismo fallback (`_redirects` en Netlify, `try_files` en Nginx).

Recuerda además que Vite **incrusta las variables `VITE_*` en tiempo de compilación**: definirlas en el panel del hosting no basta, hay que volver a construir.

## Stack

Vue 3.5 (Composition API con `<script setup>`), TypeScript estricto, Vite, Tailwind CSS 4, Pinia y Vitest. Supabase aporta Auth (Google) y Postgres; el schema y sus políticas RLS viven en `supabase/migrations/`.

## Documentación del proyecto

- **`PRODUCT.md`** — el problema y la propuesta de valor.
- **`CLAUDE.md`** — convenciones técnicas y protocolos de trabajo.

La especificación de mecánicas y el plan de ejecución con su bitácora de decisiones son documentación interna y no forman parte del repositorio.
