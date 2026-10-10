# Alcance y Recortes

Matriz boton por boton (resumen; el inventario completo de 197 botones vive en
[[docs/rediseno-2.5/03 - Diseno/Pantallas Stitch|Pantallas Stitch]]). Clasificacion: **REAL YA** / **ADAPTABLE** / **NUEVO** / **RECORTE**.

## Editor (56 botones)

- REAL YA: herramientas conectadas al override (Elegir, Texto, Barras 1D, QR/2D, Formas,
  Grafico), tabs Origen/Estilo/Posicion/ZPL, undo/redo, zoom, Guardar Plantilla,
  Test 1 Copia (impresion real x1), Copiar ZPL, Aplicar Cambios.
- ADAPTABLE: Importar CSV (alimenta variables de muestra).
- RECORTE: RFID, Invertido, "Vista Simulacion Termica" (nuestro preview YA es el ZPL real),
  densidad `~SD` (se evalua: el comando existe en ZPL; si la GX420 lo acepta, va).

## Lotes (29 botones, todo NUEVO)

Subir CSV → mapeo de columnas → previsualizar 5 → iniciar lote con progreso real
(trabajo por trabajo) → pausar/cancelar **entre etiquetas** → cola → historial.
"Conectar API REST/ERP": solo con endpoint definido; si no, recorte.

## Biblioteca (37 botones, casi todo NUEVO)

Grid real sobre `plantillas.json`, filtros por categoria/DPI, detalle con parametros,
**Duplicar / Archivar / Importar (.zpl/.json) / Nueva en blanco** funcionando de verdad.
Implica que el motor deje de asumir una sola plantilla (fase mas gorda junto con lotes).

## Historial (48 botones)

- ADAPTABLE: KPIs **contados del `.jsonl`** (no inventados), filtros que filtran,
  paginacion, detalle con payload ZPL + Copiar, **Reimprimir rango** (reencola de verdad),
  **Exportar CSV real**.
- RECORTE: exportar PDF (sin libreria), log de socket crudo (se muestra lo que el
  transporte informe). "Politicas de Retencion": se evalua (borrar `.jsonl` viejo es
  trivial y real).

## Dispositivos (27 botones)

- REAL YA / ADAPTABLE: GX420 con **estado real** (cola Windows, test), Guardar/Probar,
  **Imprimir Test ZPL real**, Anadir por IP (TCP ya existe).
- RECORTE: escanear red/Zeroconf, otras marcas, temperatura/ribbon/odometro en vivo,
  NVRAM, "Reiniciar Agente" (no hay agente). Mantenimiento preventivo solo como
  checklist manual.
- **Decision (solo GX420)**: el programa da soporte **exclusivamente a la Zebra GX420**.
  Cualquier otro modelo o marca queda **pospuesto hasta nuevo aviso**: la pantalla de
  Dispositivos muestra una sola impresora, sin "Activar/Vincular" otras ni discovery.
