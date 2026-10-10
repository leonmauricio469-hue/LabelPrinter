# Objetivo v2.5

Redisenar por completo la interfaz de LabelPrinter tomando como referencia visual y
funcional las 5 pantallas Stitch, manteniendo intacto el motor de impresion 1.x.

## Pantallas objetivo

1. **Editor** — workbench con canvas, inspector (Origen/Estilo/Posicion/ZPL), variables.
2. **Impresion Masiva / Lotes** — lote en ejecucion, mapeo CSV→ZPL, cola, preview. (Nuevo)
3. **Biblioteca de Plantillas** — grid, filtros, detalle tecnico, importar/duplicar/archivar. (Nuevo)
4. **Historial / Auditoria ZPL** — KPIs reales, tabla de trabajos, detalle con payload, reimpresion.
5. **Dispositivos & Hardware** — GX420 con estado real, test ZPL, configuracion.

## Fuera de objetivo (salvo decision contraria)

- Telemetria inventada (temperatura, ribbon, odometro en vivo).
- Multi-marca (Niimbot, TSC, Bixolon), Zeroconf, NVRAM, sensores de brecha.
- Exportar PDF, ERP sin endpoint definido.
- Pruebas en impresora fisica (no hay hardware).

Ver [[docs/rediseno-2.5/01 - Requisitos/Alcance y Recortes|Alcance y Recortes]] y [[docs/rediseno-2.5/01 - Requisitos/Pendientes de Alcance|Pendientes de Alcance]].
