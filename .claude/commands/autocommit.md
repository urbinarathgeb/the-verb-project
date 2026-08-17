---
### Description

Agrupa cambios por intención, crea commits semánticos cortos en español y hace push.

### Convention
Conventional Commit
---

# Reglas de Agrupación y Mensajes

## 1. Inspección y Exclusiones

- Antes de actuar, ejecuta `git status` y `git diff --stat`.
- **FILTRO CRÍTICO:** ignora cualquier cambio en archivos sensibles: `.env`, `.env.*`, `.claude/settings.local.json`, y cualquier archivo que contenga credenciales o secretos. Estos NO deben ser parte de los commits automáticos bajo ninguna circunstancia.
- Todo lo demás se incluye normalmente en los commits automáticos, **incluyendo `CLAUDE.md`, `PLAN.md`, `README.md` y `.claude/commands/`**: son documentación y configuración de proyecto versionada, no archivos personales.

## 2. Lógica de Agrupación (Atomic Commits)

- **Identificar Dominios:** separa los cambios por área (ej: Base de Datos, Backend, Frontend, Documentación, Configuración de Agente).
- **No mezclar:** si hay cambios en `schema.sql` y en `README.md`, deben ir en commits separados. Lo mismo aplica a cambios en `CLAUDE.md` o `PLAN.md`: van en su propio commit `docs:` o `chore:`, nunca mezclados con código de funcionalidad.
- **Unidad Lógica:** si varios archivos forman parte de una misma funcionalidad (ej: la lógica de `bookings`), agrúpalos en un solo commit.

## 3. Estándar de Mensajes

- **Longitud:** máximo 100 caracteres.
- **Formato:** `<tipo>: <descripción en español>` (Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`).
- **Tono:** verbos en infinitivo (Crear, Añadir, Configurar, Corregir).
- **Idioma:** mensaje en español, manteniendo términos técnicos de DB/Código en inglés (ej: "feat: crear tabla showtimes").

## 4. Gate de Calidad (ANTES de crear los commits)

- **El gate corre antes de commitear, no antes del push.** Un commit con lint roto o tests en rojo ya ensucia el historial local aunque nunca se sincronice; es más limpio no crearlo.
- Ejecutar `pnpm check`, que corre en paralelo las cuatro comprobaciones:
    - `pnpm lint` — ESLint, con `--max-warnings 0`.
    - `pnpm format:check` — Prettier en modo verificación.
    - `pnpm type-check` — `vue-tsc --build`.
    - `pnpm test` — Vitest.
- Si algo falla, **detener el procedimiento sin crear ningún commit** y reportar qué falló y en qué archivo.
- Si el fallo es solo de formato, se puede corregir con `pnpm format` (o `pnpm lint:fix` para reglas autocorregibles) y volver a ejecutar el gate. Cualquier otro fallo se resuelve antes de continuar.

## 5. Procedimiento Automático

1. Ejecutar el gate de calidad (`pnpm check`). Si falla, detener aquí sin commitear (ver sección 4).
2. Analizar el `diff` excluyendo archivos sensibles (ver sección 1).
3. Para cada grupo de archivos con una intención común:
    - `git add <archivos_específicos>`
    - `git commit -m "<tipo>: <descripción_corta_y_lógica>"`
4. Detectar la rama actual y ejecutar `git push origin <rama_actual>`.
