---
id: E27
tipo: ficha-aprendizaje
area: seguridad
prioridad: P1
estado: parcial
verificacion: confirmado en el repositorio publico
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
  - seguridad
---
# E27 - Una clave de Share Note está publicada en el repositorio

> [!warning] Encontrado al preparar el control de versiones
> Esta ficha no estaba en la revisión original. Apareció al revisar qué archivos del vault se suben a Git ([[M03 - Preparar control de versiones para aprender]]).

**Evidencia:** confirmado en el repositorio público. **Prioridad:** P1.

## Qué ocurre

`.obsidian/plugins/share-note/data.json` guarda la configuración del plugin Share Note, incluidos un `apiKey` y un `uid` de 32 caracteres. El archivo está en el commit inicial del repositorio `leonmauricio469-hue/LabelPrinter`, que es **público** en GitHub. Cualquiera puede leer esa clave en el historial.

## Por qué ocurre

La carpeta `.obsidian/` se subió entera. Los plugins de Obsidian guardan sus ajustes, y a veces credenciales, en `data.json` dentro de su carpeta. No había `.gitignore` en la raíz del vault.

## Dónde estudiarlo

- `.obsidian/plugins/share-note/data.json` (no copiar su contenido a ninguna nota)
- `.gitignore` en la raíz del vault

## Cómo arreglarlo paso a paso

1. **Rotar la clave** en el servicio Share Note: generar una nueva e invalidar la publicada. Es el único paso que la protege de verdad, porque la clave ya estuvo pública.
2. Dejar de seguir `data.json` de los plugins en Git y agregarlos al `.gitignore`.
3. Decidir si se reescribe el historial para borrar el archivo de commits anteriores. Requiere `force-push` a `main` y coordinar con quien tenga clones; aun así, no reemplaza el paso 1.

## Cómo comprobar la solución

`git ls-files .obsidian/plugins` no lista ningún `data.json`. La clave anterior deja de funcionar en Share Note. Si se reescribe el historial, `git log --all -- .obsidian/plugins/share-note/data.json` no devuelve commits.

## Qué aprender con este error

Antes del primer commit, revisar qué contiene cada archivo de configuración. "Es configuración del editor" no significa "no tiene secretos".

## Criterio para cerrarlo

- [ ] Clave rotada en Share Note.
- [x] `data.json` fuera del seguimiento de Git.
- [ ] Decisión registrada sobre reescribir el historial.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[M03 - Preparar control de versiones para aprender]]
- [[E26 - Los plugins de Obsidian contienen HTML en lugar de codigo]]

## Corrección

Estado: **parcial**. Registro: [[Correccion E26 E27 - Plugins de Obsidian]]. Resumen de todas las fichas en [[Registro de correcciones]].
