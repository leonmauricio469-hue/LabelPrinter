# Pantallas Stitch

5 maquetas en `stitch_labelprinter_interface_redesign.zip` (ver [[docs/rediseno-2.5/05 - Referencias/Stitch Original|Stitch Original]]).
Cada una trae `code.html` (referencia visual, no se porta) + `screen.png`.

## 1. Editor (`editor_de_etiquetas_web_desktop_modo_claro`, 56 botones)

Workbench: toolbar, drawer de herramientas, canvas con etiqueta logistica 100x150,
inspector derecho con tabs Origen/Estilo/Posicion/ZPL II, variables CSV/ERP, parametros
de cabezal, comando ZPL resultante, Test 1 Copia.

## 2. Impresion masiva (`impresi_n_masiva_lotes_web_desktop`, 29 botones)

Lote #8492 en ejecucion (340/500), mapeo CSV→ZPL (`ID_ORDEN`→`NUM_GUIA`...), controles
de tirada (copias, corte, pausa, densidad), cola activa, preview de registro.

## 3. Biblioteca (`biblioteca_de_plantillas_web_desktop`, 37 botones)

24 plantillas (Courier 4x6, Retail EAN-13, WMS/QR, GS1 pallet, alimentaria, manejo),
filtros categoria/DPI, detalle con parametros tecnicos, variables detectadas,
versiones, Importar/Nueva/Duplicar/Archivar.

## 4. Historial (`historial_de_trabajos_auditor_a_zpl`, 48 botones)

KPIs, tabla de trabajos con progreso/estado, detalle con preview + payload ZPL +
telemetria, reimpresion quirurgica por rango, log de socket.

## 5. Dispositivos (`dispositivos_hardware_web_desktop`, 27 botones)

ZD620 activa, tarjetas de estado (cabezal 38 °C, rollo 84 %, ribbon, odometro),
calibracion de sensor, prueba de cabezal, densidad, tear-off, impresoras detectadas,
puente local, metricas, mantenimiento preventivo.

> Total: **197 botones**. El mapeo funcional boton por boton vive en
> [[docs/rediseno-2.5/01 - Requisitos/Alcance y Recortes|Alcance y Recortes]]: lo adaptable se implementa, lo recortado se deja fuera.
