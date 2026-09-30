---
id: E26
tipo: ficha-aprendizaje
area: documentacion
prioridad: P2
estado: pendiente
verificacion: contenido de archivos confirmado
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E26 - Los plugins de Obsidian contienen HTML en lugar de codigo

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** contenido de archivos confirmado. **Prioridad:** P2.

## Qué ocurre

Los `main.js` de obsidian-git y share-note y `obsidian_askpass.sh` dentro de `.obsidian/plugins/` contienen páginas HTML de advertencia de Drive. No son implementaciones válidas de esos plugins. Este problema corresponde al vault, no a la app de impresión.

## Por qué ocurre

Los archivos descargados contienen una página de descarga guardada como si fuera código. Se comprobó que esa página ya era el contenido servido por Drive para estos archivos; no basta cambiarles la extensión. Confundir una respuesta HTTP exitosa con el contenido esperado provoca este tipo de corrupción.

## Dónde estudiarlo

- [Plugin Git descargado](../../.obsidian/plugins/obsidian-git/main.js)
- [Helper descargado](../../.obsidian/plugins/obsidian-git/obsidian_askpass.sh)
- [Plugin Share Note descargado](../../.obsidian/plugins/share-note/main.js)

## Cómo arreglarlo paso a paso

1. Revisar `.obsidian/community-plugins.json` y desactivar los plugins afectados mientras se recuperan.
2. Conservar la configuración útil y reinstalar cada plugin desde Obsidian o su distribución oficial.
3. No reconstruir el código copiando el HTML ni habilitarlo como si fuera un script.
4. Después de reinstalar, verificar que el archivo sea JavaScript válido y que el plugin cargue.

## Cómo comprobar la solución

Leer los primeros bytes de esos archivos: hoy empiezan por `<!DOCTYPE html>`. Tras la reinstalación deben corresponder al tipo de archivo y el panel de Obsidian debe informar carga correcta. No se ha ejecutado Obsidian en esta revisión.

## Qué aprender con este error

Aprender a validar el contenido de una descarga, además de su nombre, extensión y código HTTP.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[M04 - Mantener la documentacion sincronizada]]
