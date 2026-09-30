---
tipo: plan-prueba
fecha: 2026-09-29
estado: pendiente de ejecutar
---
# Plan de prueba física

Todo lo corregido el 2026-09-29 está verificado **en software** (`npm run check` en `label-printer-web/`). Esta lista es lo que falta comprobar en el puesto real: Windows, Zebra GK420t, rollo en uso y el lector de caja. Responde a [[M05 - Verificar el resultado con hardware real]].

**Regla:** una prueba se marca solo si se hizo en el equipo real. Si algo no se puede provocar (por ejemplo, sin papel), se anota "no probado" y el motivo, no "aprobado".

## Antes de empezar

Anotar: modelo y firmware de la impresora (etiqueta de configuración: mantener FEED 2 s), versión del driver ZDesigner, medida del rollo, nombre exacto de la cola en Windows, rama y commit de la app (`git log --oneline -1`).

## Productos de prueba (del catálogo real)

| Caso | Código | Barcode | Producto | Precio |
|---|---|---|---|---|
| EAN-13 válido | 240 | 7591031003588 | 7UP 1,5 LT | 1,40 |
| UPC-A (se imprime con 0 delante) | 232 | 810078034100 | 10 SUPER SOFT PASTEL MINTS | 14,04 |
| Dígito de control corregido | 1067 | 0400000570608 → imprime 0400000570600 | DOVE TRUFFLES ASSORTED 573G | 17,52 |
| Code 128 par (antes no cabía en B) | 246 | 47960195602341 | ACEITE DE COCO AFRUSUR 1 LITRO | 22,30 |
| Code 128 impar | 239 | 0000180 | 7 ESPECIES 150 GR | 5,00 |
| Code 128 alfanumérico | 1088 | 202616OZ | EMBASE 12 OZ | 0,30 |
| Barcode duplicado | 2042 / 2048 | 7509546074627 | PALMOLIVE (dos productos) | 2,55 / 3,60 |
| Barcode prefijo de otros | 350 | 202616 | ALMENDRAS SALADAS 250 GR | 7,00 |
| Ñ en el nombre | 10 | XPRO2607000030 | CAPUCCINO PEQUEÑO | 2,50 |
| Nombre más largo (50) | 808 | 7591720033001 | CHOCOLATE REPOSTERIA EXTRA BITTER ST MORITZ 250 GR | 5,69 |
| Sin código (no cabe) | 1 | XPROD20220002 | AMERICANO | 2,30 |

## Pruebas

| # | Qué hacer | Resultado esperado | Fichas | Resultado |
|---|---|---|---|---|
| 1 | Imprimir 1 etiqueta de cada producto de la tabla y escanearla en `/` | Cada escaneo vuelve al mismo producto y precio; 2042/2048 y 350 piden elegir | E01, E02, E03, E08 | |
| 2 | Escanear las etiquetas de 246, 239 y 1088 con el lector de caja | Las tres se leen | E08 | |
| 3 | Imprimir 10 y luego 25 etiquetas del 232 por USB | Salen todas; el historial muestra un `spoolerJobId` igual al de la cola de Windows | E09, E10, E11 | |
| 4 | Imprimir el 10 (Ñ) | La Ñ sale como Ñ | E18 | |
| 5 | Imprimir el 808 | El nombre ocupa 2 líneas legibles y no toca el barcode | E19 | |
| 6 | En `/fast`, escanear 3 productos seguidos mientras la primera etiqueta sale | Salen las 3, en orden | E04 | |
| 7 | Pausar la cola de Windows e imprimir 1 | La UI dice "enviada", no "impresa"; el banner muestra la cola pausada | E07, E15 | |
| 8 | Con la cola pausada, esperar el timeout de 15 s | La UI dice "puede que se haya impreso"; el historial dice "incierto"; al reanudar sale 1 sola etiqueta | E22 | |
| 9 | Abrir la tapa / quitar papel e imprimir | Anotar qué informa el banner (banderas crudas en `/settings`) | E15, M05 | |
| 10 | Cambiar la cola en `/settings` a un nombre parecido pero inexistente | El estado dice que no existe; no toma otra cola | E14, E21 | |
| 11 | Con dos pestañas abiertas, mirar el Administrador de tareas | Un solo `powershell.exe` por consulta de estado | E16 | |
| 12 | `netstat -an \| findstr 3000` con la app corriendo | `127.0.0.1:3000`, no `0.0.0.0:3000` | E20 | |
| 13 | Elegir la medida estándar e imprimir una etiqueta en ella | Nada se sale del papel; el barcode se lee | E05 | |

## Registro

Para cada prueba: fecha, quién, foto de la etiqueta, qué leyó el escáner y qué mostró la UI. Si una prueba falla, abrir una nota con [[Como registrar una correccion]] y enlazarla aquí.
