---
id: E16
tipo: ficha-aprendizaje
area: rendimiento
prioridad: P2
estado: pendiente
verificacion: reproducido con proceso simulado
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E16 - Las consultas simultaneas no comparten el proceso

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** reproducido con proceso simulado. **Prioridad:** P2.

## Qué ocurre

Seis consultas simultáneas a la misma cola arrancaron seis procesos simulados. La caché ayuda después de terminar una lectura, pero no mientras está en curso. Los sondeos con `force=1` evitan además su reutilización.

## Por qué ocurre

La caché guarda resultados, no una promesa pendiente. Cada petición que llega antes del resultado considera que no hay caché. En la UI, `inFlight` impide solapar consultas pero descarta un refresco si llega durante otra.

## Dónde estudiarlo

- [src/lib/printing/queue.status.ts](../../label-printer-web/src/lib/printing/queue.status.ts) · línea 111
- [src/lib/printing/queue.status.ts](../../label-printer-web/src/lib/printing/queue.status.ts) · línea 136
- [src/components/printer-status-banner.tsx](../../label-printer-web/src/components/printer-status-banner.tsx) · línea 80

## Cómo arreglarlo paso a paso

1. Guardar una promesa en curso por cola y devolverla a los demás consumidores.
2. Compartirla también para llamadas forzadas que coincidan en el tiempo.
3. Limpiar la promesa al terminar o fallar y conservar un TTL para resultados.
4. En el banner, registrar un refresco pendiente si una impresión termina durante otro sondeo.
5. Empezar por esta mejora antes de construir un servicio PowerShell persistente.

## Cómo comprobar la solución

Con un proceso simulado lento, hacer seis llamadas concurrentes: esperar un arranque y seis resultados. Probar un error seguido de reintento. Simular refresco durante sondeo y comprobar que se ejecuta una consulta adicional al terminar.

## Qué aprender con este error

Aprender deduplicación de trabajo en curso: caché de valores y coordinación de promesas resuelven problemas distintos.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E04 - Los escaneos pendientes se sobrescriben]]
