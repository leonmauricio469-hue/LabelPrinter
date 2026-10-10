# Plan de Fases

Cada fase termina con la app **funcionando y en verde** (typecheck + `npm run check` +
demo en `:3000`). Estimado total: **30–45 h de trabajo enfocado** (2–3 semanas calendario
con revisiones). Camino critico: F4 + F5.

| Fase | Contenido | Estimado |
|---|---|---|
| **F0 Fundaciones** (las ruedas) | Tokens ClearCraft, fuentes, `AppShell`, navegacion en las 6 rutas. Cero cambio funcional | 3–4 h |
| **F1 Imprimir simple** | `/` re-estilado + preview PNG real + pill de impresora | 2–3 h |
| **F2 Historial** | Filtros, detalle, reimprimir rango, exportar CSV | 3–4 h |
| **F3 Dispositivos** | Settings re-estilado + test ZPL real + estado real | 2–3 h |
| **F4 Biblioteca** | Modelo multi-plantilla + CRUD + importar + adaptar motor | 6–9 h |
| **F5 Lotes** | CSV → mapeo → cola con progreso → historial | 6–9 h |
| **F6 Editor** | Re-estilado + reconciliacion con override + variables | 4–6 h |
| Buffer | M issues de Next 16, fixes | +25% |

## Supuestos

`/fast` y `/teclado` con re-estilado liviano; biblioteca multi-plantilla real; CSV con
columnas normales; sin ERP/PDF/multi-marca/telemetria; decisiones entre fases sin demora.

## No incluye

Pruebas en impresora fisica, instalador/distribucion, capacitacion, vault 1.x.
