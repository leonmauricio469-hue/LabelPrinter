---
id: E17
tipo: ficha-aprendizaje
area: configuracion
prioridad: P2
estado: corregido
verificacion: riesgo identificado en codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E17 - Guardar settings puede dejar el archivo incompleto

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** riesgo identificado en codigo. **Prioridad:** P2.

## Qué ocurre

La configuración se escribe directamente sobre el archivo activo. Un cierre durante la escritura puede dejarlo truncado; otro lector puede observar contenido incompleto. Guardar repetidamente no está bloqueado desde la UI.

## Por qué ocurre

Guardar un archivo y publicar una versión válida son operaciones distintas. `fs.writeFile` no convierte varias lecturas y escrituras concurrentes en una transacción. La revisión no provocó un corte real del proceso.

## Dónde estudiarlo

- [src/lib/settings/settings.store.ts](../../label-printer-web/src/lib/settings/settings.store.ts) · línea 28
- [src/app/settings/page.tsx](../../label-printer-web/src/app/settings/page.tsx) · línea 214

## Cómo arreglarlo paso a paso

1. Validar el objeto antes de escribir.
2. Serializar los guardados en el servidor.
3. Escribir un temporal en el mismo directorio y reemplazar el activo después de completar; revisar el comportamiento de reemplazo en Windows.
4. Mantener una última versión válida recuperable si el proyecto lo necesita.
5. Deshabilitar Guardar durante la operación y explicar el resultado.

## Cómo comprobar la solución

En una carpeta temporal, interrumpir el flujo antes del reemplazo: el archivo activo debe seguir siendo válido. Probar dos guardados y una lectura concurrente. Registrar aparte las garantías frente a caída del proceso y frente a fallo eléctrico: no son automáticamente iguales.

## Qué aprender con este error

Aprender publicación atómica, concurrencia y recuperación sin necesitar una base de datos para este ejercicio.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E12 - Leer settings acepta objetos incompletos]]

## Corrección

Estado: **corregido**. Registro: [[Correccion E12 E17 - Configuracion segura]]. Resumen de todas las fichas en [[Registro de correcciones]].
