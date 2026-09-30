# Estado del Proyecto

> [!important] Revisión actual — 2026-09-29
> **Actualización:** las correcciones de la revisión están hechas y verificadas en software (rama `fix/revision-2026-09-29`). Estado por ficha: [[Registro de correcciones]]. Próximo paso: [[Plan de prueba fisica]] en el puesto real.
>
> Esta nota conserva el historial de implementación y pruebas anteriores. El catálogo actual contiene 3.080 productos y el trabajo pendiente se documenta en [[Mapa de errores y aprendizaje]]. Sigue [[Ruta de aprendizaje y correccion]] para estudiar y corregir los problemas. Las pruebas físicas antiguas no cubren automáticamente los nuevos hallazgos. Las referencias a un catálogo pequeño, a rechazo 422 de todo barcode inválido o a atomicidad física deben leerse como antecedentes: la implementación actual puede corregir barcodes o emitir advertencias, y un trabajo único de cola no garantiza impresión física indivisible. Consulta [[Evidencias y alcance de la revision]].

## Resumen

| Fase | Estado | Notas |
|---|---|---|
| Requisitos | Completado | Documentados en `01 - Requisitos` |
| Stack | Definido | Next.js monolitico 100% TypeScript |
| Arquitectura | Redefinida | App Router + capas + sin base de datos |
| Rueda (MVP minimo) | **Completado** | Etiqueta fisica 50x25 mm verificada por USB (cola `ZDesigner GX420t`) |
| Patineta (escaneo) | **Completado** | Ciclo verificado con el escaner USB fisico: escanea, imprime, y la etiqueta se lee |
| Carro (producto completo) | **En curso** | Corregidos el fallo de coincidencias y el del BOM; el estado real de impresora esta codificado pero **sin prueba fisica**; sigue CRUD, busqueda y servicio |
| XETUX | En suspenso | Integracion temporalmente fuera de alcance |

## Definicion del stack

- **Unico lenguaje**: TypeScript strict en toda la app (UI + servidor)
- **Framework**: Next.js monolitico (App Router), ZPL crudo a la impresora, sin base de datos
- **Motivo**: una sola app (UI + API), escaner USB funciona igual en el navegador, nada que instalar en el puesto

## Donde esta la Zebra en la practica

- **Transporte real: USB**, no red. Cola de Windows `ZDesigner GX420t`, puerto `USB002`.
- En la subred `192.168.2.0/24` no hay ninguna Zebra alcanzable: el unico host con 9100
  abierto es `192.168.2.80` (una Epson L5190 de tinta) y la IP `192.168.2.231` de la cola
  `NE PA PICAR` no responde.
- El selector de la pagina alterna `tcp` / `usb`, asi que la app queda preparada para
  cuando la impresora se pase a Ethernet.

## Que esta hecho

- [x] Documento de requisitos completo
- [x] Flujo principal y modo continuo definidos
- [x] Wireframes de interfaz (modo normal + continuo)
- [x] Ficha Zebra GK420t y lenguaje ZPL
- [x] Nueva arquitectura Next.js (monolito, capas, patrones, estructura)
- [x] App Next.js + canal de impresion de la fase Rueda implementado (`label-printer-web/`)
- [x] **Fase Rueda completa**: etiqueta fisica de PA PICAR impresa y verificada (50 x 25 mm)
- [x] Transporte USB (`usb.transport.ts` + `scripts/send-raw.ps1`, ZPL crudo por spooler)
- [x] Logo PA PICAR integrado como zona `graphic` en la plantilla
- [x] Modulo de productos con repositorio sobre `catalog.json` (validado al leer, cache por mtime)
- [x] `GET /api/products` y `GET /api/printers`
- [x] `POST /api/labels` por `productCode` + cantidad, con lote atomico (`buildZplBatch`)
- [x] Las 4 pantallas: modo normal, modo rapido, configuracion e historial
- [x] `audit.store.ts` + historial en `print-history.jsonl`
- [x] **Fase Patineta completa**: el escaner USB fisico escanea, imprime, y la etiqueta
      resultante la lee el mismo escaner
- [x] Barcode legible: EAN-13 con `^BY3` (0.375 mm de modulo) y barras de 9 mm, por
      encima de los minimos de ISO/IEC 15420
- [x] Medida del simbolo antes de imprimir: `POST /api/labels` responde 422 si el barcode
      no cabe o si el EAN-13 tiene el digito de control mal
- [x] **Coincidencia exacta contra aproximada**: la API responde `match` y `/fast` imprime
      solo en coincidencia exacta. Antes, un escaneo leido a medias imprimia la etiqueta del
      producto equivocado sin avisar
- [x] **Estado real de la impresora**: `GET /api/printer/status` lee las banderas de la cola
      de Windows y un banner las muestra en `/`, `/fast` y `/settings`. Comprobado por
      software (34 pruebas del mapa de banderas). **Pendiente de prueba fisica**: nadie ha
      comprobado si el driver de la Zebra rellena `PaperOut` / `Offline`. Ver
      [[Prueba Estado Impresora]]
- [x] **`settings.json` con BOM ya no tumba la app**: PowerShell y muchos editores de
      Windows guardan con BOM, y `JSON.parse` lo rechaza. Antes, `/api/settings` y
      `/api/printer/status` devolvian 500 sin explicacion

## Que falta

- [ ] **Probar fisicamente el estado de la impresora**: quitar el papel o apagarla y
      confirmar que la app avisa. Es lo unico que cierra el punto anterior
- [ ] Fase Carro: **CRUD del catalogo** desde la web (hoy `catalog.json` se edita a mano)
- [ ] Fase Carro: **busqueda manual por nombre** como requisito propio (hoy la busqueda
      parcial existe y ya no imprime sin confirmacion)
- [ ] Fase Carro: **servicio de Windows**, para que la app arranque sola en el puesto
- [ ] Fase Carro: **probar el ciclo de ida y vuelta** de Patineta (escanear la etiqueta
      resultante y comprobar que devuelve el mismo producto)
- [ ] Fase Carro, **al final por decision del operador**: editor de plantillas y aspecto
      final de la etiqueta
- [ ] Cargar el **catalogo real de PA PICAR** (todavia no existe; el Excel de RESPALDO se
      descarto) y decidir que se hace con los codigos que no sean EAN-13
- [ ] Corregir que `buildZpl()` ignora `label.widthMm` / `heightMm` de `settings.json`
- [ ] **Imprimir cuesta ~2,4 s**, por un `powershell.exe` por etiqueta. Limita `/fast` a
      unas 25 etiquetas por minuto. Se arreglaria con un proceso PowerShell persistente
- [ ] Probar `tcp.transport.ts` si la Zebra pasa a Ethernet

## Donde esta el escaner en la practica

- Es un **dispositivo compuesto USB**: `USB\VID_2258&PID_2348\0329`, con la descripcion que
  reporta el bus, `"USB Keyboard"`.
- La interfaz MI_00 aparece en Windows como `Dispositivo de teclado HID`, clase `Keyboard`,
  driver `kbdhid`, estado OK. La MI_01 es el HID definido por el proveedor (configuracion).
- Es decir: esta en modo teclado y es un teclado mas para el sistema. No hace falta driver.
- La pagina `/teclado` sirve para diagnosticar si llega algo y con que sufijo.

## Ver tambien

- [[Proximos Pasos]]
- [[Prueba Fisica Rueda]]
- [[Prueba Patineta]]
- [[Prueba Legibilidad Barcode]]
- [[Prueba Coincidencias]]
- [[Prueba Estado Impresora]]
- [[Arquitectura General]]
- [[Stack Tecnologico]]