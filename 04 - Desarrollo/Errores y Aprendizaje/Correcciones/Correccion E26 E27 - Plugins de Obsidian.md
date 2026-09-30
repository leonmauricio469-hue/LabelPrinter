---
tipo: registro-correccion
fichas: [E26, E27]
fecha: 2026-09-29
estado: parcial
prueba-fisica: no
---
# Corrección de E26 y E27 — plugins de Obsidian

Fecha: 2026-09-29
Fichas: [[E26 - Los plugins de Obsidian contienen HTML en lugar de codigo]], [[E27 - Una clave de Share Note esta publicada en el repositorio]]
Commit: `fix(vault): disable broken Obsidian plugins and stop tracking plugin credentials`

## Comprensión inicial

- **E26:** `obsidian-git/main.js`, `obsidian-git/obsidian_askpass.sh` y `share-note/main.js` empiezan por `<!DOCTYPE html><html><head><title>Google Drive - Virus scan`: son la página de advertencia de Drive, no código. `community-plugins.json` los tenía activados.
- **E27 (nuevo):** `share-note/data.json` tiene un `apiKey` y un `uid` y está en el commit inicial del repositorio público.

## Antes del cambio

- Primeros bytes de los tres archivos: HTML (comprobado con `head -c 60`).
- `git ls-files .obsidian` listaba `share-note/data.json`; el repositorio responde `public` en la API de GitHub.

## Cambio

- `community-plugins.json` → `[]`: ningún plugin roto se intenta cargar. Los archivos quedan como estaban; no se reconstruye código a partir del HTML.
- `git rm --cached .obsidian/plugins/share-note/data.json`: deja de seguirse; el archivo sigue en disco para no perder la configuración local.
- `.gitignore` nuevo en la raíz del vault: `.obsidian/plugins/*/data.json` y las herramientas locales (`.claude/`, `.mcp.json`).

## Lo que NO se hizo, a propósito

- **No se rotó la clave:** solo se puede hacer desde la cuenta de Share Note. Es el paso que falta para cerrar E27.
- **No se reescribió el historial** de `main` (requiere `force-push`, es destructivo y es decisión del dueño del repositorio). La clave sigue visible en el commit inicial hasta que se rote o se reescriba.
- **No se reinstalaron los plugins:** se hace desde Obsidian (Ajustes → Plugins de la comunidad). Después, comprobar que `main.js` sea JavaScript y reactivarlos.

## Cierre

- [x] Plugins rotos desactivados. - [x] `data.json` fuera del seguimiento. - [ ] Clave rotada. - [ ] Plugins reinstalados desde Obsidian.

**Estado:** parcial hasta rotar la clave y reinstalar los plugins.
