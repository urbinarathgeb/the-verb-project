# CLAUDE.md — The Verb Project

## Contexto y Propósito del Proyecto

* **Nombre:** The Verb Project
* **Descripción:** Aplicación web interactiva tipo juego diseñada para ayudar a los usuarios a aprender y practicar formas verbales en inglés de manera dinámica y atractiva.
* **Enfoque UX/UI:** Interfaz inmersiva a pantalla completa (viewport controlado), minimizando elementos tradicionales de sitios estáticos (sin headers ni footers pesados) y priorizando un diseño de juego limpio con HUD (Heads-Up Display) y modales de estado.
* **Documento de producto:** para el contexto completo de negocio (insight, problema, público objetivo, propuesta de valor), consultar `PRODUCT.md`. Para la especificación de mecánicas de juego (modos, reglas de ranking, estructura del tablero), consultar `MECHANICS.md`. Cualquier feature nueva debe evaluarse contra ambos documentos antes de implementarse.

## Stack Tecnológico

* **Vue.js:** 3.5.40
* **TypeScript:** uso estricto en todo el proyecto (componentes, composables, stores)
* **Tailwind CSS:** 4.3.3 — Tailwind puro, sin librerías de componentes adicionales (sin shadcn-vue ni similares)
* **Pinia:** gestión de estado global
* **Supabase:** Auth (login con Google) + base de datos (Postgres) para progreso y ranking
* **Vitest:** testing de lógica de negocio
* **Gestor de paquetes:** pnpm

## Roles y Responsabilidades

Como tu Ingeniero de IA y Desarrollador Senior, mi función es garantizar que este proyecto se ejecute con precisión técnica, manteniendo una estructura atómica y una documentación viva.

---

## Directrices Operativas (Protocolos)

### 1. Planificación y Ejecución Atómica

* **Fase de Planificación:** Ningún código será escrito sin un plan detallado (que debe existir en un archivo `PLAN.md`).
* **Atomicidad:** Cada tarea se desglosará en unidades mínimas de trabajo. La implementación debe ser modular y enfocada en una sola funcionalidad a la vez.
* **Definition of Ready (antes de empezar una tarea):** una tarea del `PLAN.md` solo se considera lista para ejecutar si tiene: input/output claro, sin ambigüedad de alcance, y sin dependencias no declaradas de otras tareas pendientes.
* **Definition of Done (para marcar una tarea como completada):** `pnpm check` pasa en verde (lint, formato, type-check y tests — ver sección 13), tiene sus tests correspondientes pasando si involucra lógica de negocio (ver sección 9), y si la tarea cambia comportamiento visible para el usuario, el `README.md` ya fue actualizado en este mismo momento (ver sección 3). Todo esto ocurre **antes** de que exista un commit — `/autocommit` no escribe ni edita contenido, solo empaqueta en commits lo que ya está modificado.
* **Seguimiento:** Una vez finalizada e integrada (con commit local) una tarea, actualizaré inmediatamente el `PLAN.md` marcándola como completada.

### 2. Gestión de Cambios (Pivotaje)

* Si surgen nuevas ideas, aristas no contempladas o mejoras, detendré la ejecución y presentaré un análisis detallado de la nueva propuesta.
* **Solicitud de Autorización:** Esperaré tu aprobación explícita antes de proceder.
* **Historial de Decisiones:** Si el plan cambia, se añadirá una sección de "Bitácora de Decisiones" en el `PLAN.md` donde se explicará el qué, el cómo y el porqué del cambio, preservando la trazabilidad del plan original.

### 3. Documentación Sincronizada (Living Documentation)

* **README:** Solo las tareas que cambien comportamiento visible para el usuario (nueva pantalla, nueva mecánica, cambio de flujo) requieren actualizar `README.md`. Tareas de refactor, estilo o configuración interna que no alteren el comportamiento observable no la requieren, para evitar lecturas de contexto innecesarias.
* **Momento:** la actualización ocurre **durante el trabajo de la tarea, como parte de su Definition of Done** (sección 1) — nunca después, y nunca como parte del flujo de `/autocommit`. Cuando finalmente invocas `/autocommit`, el README ya está modificado junto con el código, y el comando lo agrupa en su propio commit `docs:` (ver `.claude/commands/autocommit.md`, regla de no mezclar dominios).
* **Sincronía:** el `README.md` debe reflejar el estado actual del proyecto en la sección afectada — no es necesario releer el archivo completo si el cambio afecta una parte puntual y conocida.

### 4. Control de Versiones (Protocolo Git)

* **Control Estricto:** NUNCA realizaré `git commit` ni `git push` de forma autónoma.
* **Acción Manual:** El único canal para ejecutar comandos de Git (commit y push) es la invocación explícita de `/autocommit`. No ejecutaré `git commit` ni `git push` por iniciativa propia ni por ninguna otra vía.
* **Comando `/autocommit`:** vive en `.claude/commands/autocommit.md`, versionado en el repo. Agrupa cambios por intención y genera commits semánticos automáticamente. Al invocarlo, se ejecutarán múltiples commits y un push en esa sesión sin pedirte confirmación commit por commit.
* **Archivos de agente versionados:** `CLAUDE.md`, `.claude/commands/` y `.claude/skills/` se commitean normalmente al repo, igual que cualquier otro archivo del proyecto — son memoria compartida, no configuración personal.
* **Documentación interna fuera del repo:** `PLAN.md` y `MECHANICS.md` **no se versionan** y están en `.gitignore`. Siguen siendo las fuentes de verdad del plan y de las mecánicas, y se mantienen igual de vivos que antes: lo único que cambia es que viven sólo en la máquina del autor. Al citarlos desde documentación pública como el `README.md`, hay que tener presente que quien clone el repositorio no los tendrá.
* **Excepción real:** `.claude/settings.local.json`, `.claude/launch.json` y cualquier `.env`/secreto quedan en `.gitignore` y nunca se commitean, ni manual ni automáticamente vía `/autocommit`.

### 5. Estándares Técnicos y de Código

* **Vue 3.5:** uso estricto de Composition API con `<script setup lang="ts">`.
* **TypeScript estricto:** todo el código (componentes, composables, stores, utilidades) debe estar tipado. Se evita `any` salvo justificación explícita en comentario.
* **Idioma — regla de dos planos:**
    * **El código se escribe en inglés.** Nombres de variables, funciones, constantes, tipos, interfaces, propiedades de objetos, archivos, rutas y **valores de uniones de literales de tipo**. Un valor como `'easy'` en `Difficulty` es un identificador del dominio, no texto de interfaz, aunque acabe siendo visible en una URL.
    * **En español va todo lo que leen las personas.** Comentarios de código, documentación (`CLAUDE.md`, `PLAN.md`, `PRODUCT.md`, `MECHANICS.md`, `README.md`), descripciones de tests (`describe`/`it`), mensajes de commit, reportes de avance, y **los textos de interfaz visibles para el usuario final** (por ejemplo, `label: 'Fácil'` en `data/levels.ts`).
    * Motivo: el código en inglés se mantiene coherente con el lenguaje y las bibliotecas sobre las que está escrito. Mezclar planos produce construcciones incómodas del tipo `getVerbsForDificultad`.

### 6. Gestión de Estado: Pinia + Composables

Pinia y composables **conviven**, no son alternativas. La regla para decidir dónde va cada pieza de estado:

* **Pinia** → estado global compartido entre componentes desconectados entre sí (puntaje actual, racha, progreso del usuario, sesión de juego, estado de autenticación).
* **Composable puro (sin store)** → lógica reutilizable pero de estado local/aislado por instancia (timers individuales, mezcla de listas de verbos, detección de input de teclado, transiciones de UI).

**Patrón obligatorio:** los componentes de UI **nunca** acceden a un store de Pinia directamente. Siempre lo hacen a través de un composable que actúa como interfaz pública y encapsula la lógica de negocio (ej. `useGameEngine()` envolviendo internamente `useGameStore()`). Esto desacopla los componentes de la implementación del estado.

Esta regla **la aplica ESLint**, no la disciplina: la sección `app/componentes-no-acceden-a-pinia` de `eslint.config.ts` prohíbe importar `@/stores/*` o `pinia` desde `src/components/**` y `src/screens/**`.

Dentro del composable, el estado y los getters se extraen con `storeToRefs` y las acciones se desestructuran directamente del store. Desestructurar el store sin `storeToRefs` congela los valores y la UI deja de actualizarse en silencio.

```ts
// composables/useGameEngine.ts
import { useGameStore } from '@/stores/game'
import { storeToRefs } from 'pinia'

export function useGameEngine() {
  const store = useGameStore()
  const { score, streak, currentVerb } = storeToRefs(store)

  function submitAnswer(answer: string): boolean {
    const isCorrect = answer === currentVerb.value.correctForm
    store.registerAnswer(isCorrect)
    return isCorrect
  }

  return { score, streak, currentVerb, submitAnswer }
}
```

### 7. Estructura de Carpetas

```
src/
  assets/          # imágenes, fuentes, estilos base
  components/      # UI pura y reutilizable, sin lógica de negocio
  composables/      # useGameEngine, useTimer, useVerbShuffle...
  screens/         # pantallas principales del juego (una por vista/flujo)
  stores/          # stores de Pinia (game, progress, session, auth)
  data/            # listas de verbos, configuración de niveles
  lib/             # cliente de Supabase, utilidades de terceros
  types/           # tipos e interfaces compartidas (Verb, GameState, etc.)
```

### 8. Persistencia de Datos y Autenticación

* **Backend:** Supabase (Auth + Postgres).
* **Login:** autenticación con Google OAuth vía Supabase Auth.
* **Modo invitado:** el usuario puede jugar sin iniciar sesión. En este modo, todo el estado (progreso, puntaje) vive únicamente en Pinia/memoria y **no se persiste** en Supabase ni en almacenamiento local. Al recargar o cerrar, se pierde.
* **Modo autenticado:** el progreso (verbos dominados, historial de puntajes) y el ranking se guardan en Supabase, asociados al usuario.
* La lógica de sincronización con Supabase se aísla en `stores/` (o composables que envuelven llamadas a `lib/supabase.ts`), nunca directamente desde componentes.

### 9. Testing

* **Herramienta:** Vitest.
* **Alcance obligatorio:** toda lógica de negocio en **composables y stores** debe tener tests (cálculo de puntaje, validación de respuestas, transiciones de estado de juego, reglas de racha, etc.).
* **Fuera de alcance por ahora:** tests de componentes UI (Vue Test Utils) y tests E2E. Se evaluará agregarlos cuando el proyecto salga de la fase de prototipo.
* Una tarea del `PLAN.md` que introduzca o modifique lógica de negocio no se marca como completada sin sus tests correspondientes pasando.

### 10. Convenciones de Tailwind CSS 4

* Tailwind puro: no se usan librerías de componentes UI (sin shadcn-vue ni similares).
* Los design tokens del proyecto (colores del HUD, tipografías, espaciados propios del juego) se definen centralizadamente en el bloque `@theme` de Tailwind 4, no dispersos en cada componente.
* Se evitan clases arbitrarias (`w-[123px]`, `text-[#ff0000]`) salvo casos puntuales sin alternativa razonable en los tokens definidos.

### 11. Accesibilidad y Responsive

* La app debe ser usable en dispositivos táctiles (móvil/tablet), dado su enfoque a pantalla completa.
* Los modales deben ser navegables por teclado (foco atrapado, cierre con `Esc`).
* Contraste suficiente en los elementos del HUD sobre cualquier fondo dinámico del juego.

### 12. Uso de Skills (evitar duplicación de contexto)

* `CLAUDE.md` se carga completo en cada mensaje: debe contener únicamente decisiones específicas de este proyecto y de aplicación constante (stack, patrones de estado, protocolo de git). No debe crecer con contenido de referencia general.
* Las **skills** (ej. buenas prácticas de Vue, guías de testing) se cargan solo bajo demanda, cuando la tarea las amerita. Todo conocimiento general y extenso debe vivir ahí, no en este archivo.
* Si una skill cubre un tema (ej. `vue-best-practices`), este archivo no debe repetir su contenido — solo puede referenciarla con una línea (ej. "para patrones de componentes, ver skill `vue-best-practices`"), dejando que el sistema decida cuándo cargarla.

### Protocolo de consulta de skills (obligatorio por tarea)

La separación anterior solo funciona si las skills se consultan de verdad. Por eso, **antes de escribir código en cada tarea del `PLAN.md`** —no solo al iniciar el proyecto— hay que revisar la lista de skills disponibles y cargar las que apliquen al tema de esa tarea. Mapa de referencia:

| Tipo de tarea | Skills a consultar |
| --- | --- |
| Componentes, composables, `<script setup>` | `vue`, `vue-best-practices` |
| Stores de Pinia y gestión de estado | `vue-pinia-best-practices` |
| Estilos, design tokens, `@theme`, utilidades | `tailwind-css-patterns` |
| Pulido de UI, micro-interacciones, estados de error/vacío, crítica de UX | `impeccable` |
| Modales, foco, teclado, contraste | `accessibility` |
| Errores de runtime, warnings de Vue | `vue-debug-guides` |
| Configuración de build, plugins, entorno | `vite` |
| Cualquier SQL, schema, migración o RLS | `supabase-postgres-best-practices` |

> ⚠️ **`impeccable` está podada a propósito.** Upstream pesa 3,4 MB e incluye ~30 scripts ejecutables, subagentes y un servidor local: llama a `api.openai.com` para generar imágenes (requiere clave y tiene costo), llama a su backend `impeccable.style/api`, y su comando de hooks **escribe en `.claude/settings.json`** para instalar hooks de `PostToolUse` y `Stop` que correrían automáticamente tras cada Edit/Write.
>
> En este repo se eliminaron `scripts/` y `agents/`: quedan `SKILL.md` y los 35 documentos de `reference/` (460 kB, markdown puro, cero ejecutables). Se usa **solo como guía de diseño**.
>
> **Al actualizar skills, `npx skills update` restauraría esos directorios** — hay que volver a borrarlos y conservar la nota de aviso al inicio de `SKILL.md`.

Si una skill relevante **no está disponible**, hay que decirlo explícitamente en el reporte de la tarea en lugar de continuar en silencio.

**Instalación:** las skills viven como **directorios reales** en `.claude/skills/`, que es la convención nativa de Claude Code. No se usan enlaces simbólicos ni el directorio `.agents/` de la CLI multi-agente.

**No se versionan:** `.claude/skills/` está en `.gitignore`. Son 2,3 MB de documentación de terceros copiada al repositorio, que no es código del proyecto y no cambia con él. La contrapartida asumida es que quien clone el repo **no tiene las skills** y debe instalarlas antes de trabajar.

Para añadir o actualizar una skill hay que usar siempre `--copy` y acotar el agente, para no regenerar directorios de otros agentes:

```sh
npx skills add <owner>/<repo> --skill <nombre> --copy --agent claude-code -y
```

`skills-lock.json` **sí queda versionado**, como registro del origen de cada skill y punto de partida para reinstalarlas. No es una reproducción fiel del directorio local, y conviene saberlo antes de confiar en él: no incluye `ui-ux-pro-max`, lista dos skills que se descartaron a propósito (`frontend-design` y `typescript-advanced-types`), y reinstalar `impeccable` desde ahí devolvería los scripts ejecutables y subagentes que este repo eliminó (ver el aviso de arriba).

---

### 13. Linting y Formato

* **ESLint 10** (flat config en `eslint.config.ts`) con `eslint-plugin-vue` y `typescript-eslint`. Reglas propias del proyecto: `no-explicit-any` como error (refuerza la sección 5), `consistent-type-imports` para mantener el runtime limpio, y `multi-word-component-names` desactivada porque las pantallas de `screens/` son de una sola palabra por convención de rutas.
* **Prettier** se encarga del formato; `@vue/eslint-config-prettier` desactiva las reglas de ESLint que chocarían, para que no haya dos herramientas discutiendo sobre lo mismo.
* **Estilo del proyecto** (en `.prettierrc.json`): tabs, sin punto y coma, comillas simples, sin espacios dentro de llaves (`{foo}`), ancho 100. Los archivos `.json` y `.yaml` usan 2 espacios vía `overrides`, porque `useTabs` aplicaría a todos los lenguajes.
* **La documentación (`*.md`) está excluida de Prettier** a propósito: reformatearla solo cambiaría estilos de viñeta y alineación de tablas, generando diffs enormes que ocultarían los cambios reales de contenido.
* **Comandos:**

| Comando | Qué hace |
| --- | --- |
| `pnpm check` | Las cuatro comprobaciones en paralelo. **Es el gate de `/autocommit`.** |
| `pnpm lint` / `pnpm lint:fix` | ESLint, con `--max-warnings 0` |
| `pnpm format` / `pnpm format:check` | Prettier en modo escritura o verificación |
| `pnpm type-check` | `vue-tsc --build` |
| `pnpm test` | Vitest |

---

*(Esta sección se completará a medida que el proyecto evolucione y se registren pivotes respecto al plan original.)*
