# Estado del Proyecto

## Resumen

| Fase | Estado | Notas |
|---|---|---|
| Requisitos | Completado | Documentados en `01 - Requisitos` |
| Stack | Definido | Next.js monolitico 100% TypeScript |
| Arquitectura | Redefinida | App Router + capas + sin base de datos |
| Rueda (MVP minimo) | **Completado** | Etiqueta fisica verificada por USB, a 50 x 25 mm |
| Patineta (escaneo) | **Completado** | Ciclo verificado con el escaner USB fisico: escanea, imprime, y la etiqueta se lee |
| Carro (producto completo) | **En curso** | Geometria de la etiqueta lista y con editor visual; **la 59 x 35 mm se ha impreso dos veces pero nadie ha mirado el papel**; el estado real de impresora esta codificado pero **sin prueba fisica**; sigue CRUD, busqueda y servicio |
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
- [x] **Plantilla unica de 59 x 35 mm** (472 x 280 dots). Se borro la de 50 x 25 y con ella
      el selector de plantillas de `/settings`. Sin escalado proporcional: cada zona tiene sus
      numeros en dots
- [x] **Editor de geometria en `/editor`**: el contenido se mueve y se redimensiona, con
      la previsualizacion dibujada por el mismo `renderLabel()` que produce el ZPL, no una
      maqueta. **El marco queda fuera** (`EDITABLES` no lleva `shape`): es el margen fisico del
      papel, se deduce solo de la plantilla y no se toca. Ver [[Plantilla 59x35 y Editor]]
- [x] **El ancho del rollo se puede cambiar sin arrastrarlo**: `/settings` ->
      `printer.mediaWidthMm`, y de ahi sale el `^PW`. Es el **medio**, no el diseno: se evita a
      proposito que acabe en `template.widthDots`, porque entonces el EAN-13 se centraria sobre
      el rollo y la zona quieta se mediria contra el canto del papel. Con un rollo mas estrecho
      que la etiqueta, `POST /api/labels` devuelve 422 en vez de imprimir recortado en silencio
- [x] **"Aplicar cambios"** guarda la geometria en `data/plantilla-override.json`, que se
      aplica encima de la plantilla del codigo al imprimir. No reescribe `label.template.ts`,
      **no hace falta `next build`** y se deshace borrando un archivo. Rechaza con 422 si algo se
      pisa o se sale del rollo

## Que falta

- [ ] **Mirar las dos etiquetas que ya salieron** (producto `475` con EAN-13, producto `1` con
      codigo interno): entera o cortada por la derecha, con el radio del marco a 2 mm o a
      1 mm, con la `N` de `ANON` o sin ella. Y **confirmar el ancho real del rollo**: ahora
      `/settings` tiene 59 mm, que es una suposicion puesta para no bloquear, no un dato
      medido. Si el rollo real es de 50, las dos etiquetas estan cortadas y hay que repetirlo
      todo. Bloquea el resto de la lista siguiente
- [ ] **Probar fisicamente el estado de la impresora**: quitar el papel o apagarla y
      confirmar que la app avisa. Es lo unico que cierra el punto anterior
- [ ] **261 productos (8,5 %) se imprimen sin codigo de barras**: sus codigos internos no caben
      a 3 dots de modulo en 472 dots. A 2 dots caben, pero 0,250 mm esta bajo el minimo de
      ISO/IEC 15420. Solo el lector fisico puede decir si los acepta
- [ ] Fase Carro: **CRUD del catalogo** desde la web (hoy `catalog.json` se edita a mano)
- [ ] Fase Carro: **busqueda manual por nombre** como requisito propio (hoy la busqueda
      parcial existe y ya no imprime sin confirmacion)
- [ ] Fase Carro: **servicio de Windows**, para que la app arranque sola en el puesto
- [ ] Fase Carro: **probar el ciclo de ida y vuelta** de Patineta (escanear la etiqueta
      resultante y comprobar que devuelve el mismo producto)
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
- [[Plantilla 59x35 y Editor]]
- [[Prueba Fisica Rueda]]
- [[Prueba Patineta]]
- [[Prueba Legibilidad Barcode]]
- [[Prueba Coincidencias]]
- [[Prueba Estado Impresora]]
- [[Arquitectura General]]
- [[Stack Tecnologico]]