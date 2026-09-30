# Proximos Pasos

> [!important] Revisión actual — 2026-09-29
> Esta nota conserva el historial de implementación y pruebas anteriores. El catálogo actual contiene 3.080 productos y el trabajo pendiente se documenta en [[Mapa de errores y aprendizaje]]. Sigue [[Ruta de aprendizaje y correccion]] para estudiar y corregir los problemas. Las pruebas físicas antiguas no cubren automáticamente los nuevos hallazgos. Las referencias a un catálogo pequeño, a rechazo 422 de todo barcode inválido o a atomicidad física deben leerse como antecedentes: la implementación actual puede corregir barcodes o emitir advertencias, y un trabajo único de cola no garantiza impresión física indivisible. Consulta [[Evidencias y alcance de la revision]].

Roadmap incremental: **de lo micro a lo macro**. Cada fase termina con algo funcional y verificable (rueda -> patineta -> carro). XETUX esta temporalmente fuera de alcance: los datos salen del **catalogo local** (`data/catalog.json`).

## Fase RUEDA - Imprimir la primera etiqueta

Objetivo: demostrar que el navegador llega a la impresora.

- [x] Crear app Next.js con TypeScript strict
- [x] Configurar Tailwind + layout base
- [x] `settings.json` con host/puerto de la Zebra
- [x] Implementar `tcp.transport.ts` (socket 9100)
- [x] Implementar `zpl.builder.ts` con template estatico
- [x] Pagina con boton "Imprimir etiqueta de prueba"
- [x] `usb.transport.ts` + `scripts/send-raw.ps1`: ZPL crudo a la cola USB de Windows
- [x] Logo PA PICAR como zona `graphic` (`pa-picar-logo.ts`, generado con `generate-logo.ps1`)
- [x] Ajuste de linea con `^FB` + centrado de barcode con `justify` / `center`
- [x] Verificar etiqueta fisica de PA PICAR

**Definicion de hecho**: se imprime una etiqueta real desde el navegador. **CUMPLIDA.**

> Estado: completada el 2026-09-29 en el PC del trabajo. Se verifico fisica: la Zebra
> GK420t imprime la etiqueta de 50 x 25 mm con logo, nombre, precio, barcode y referencia.
> Ver `04 - Desarrollo/Prueba Fisica Rueda.md` para el detalle completo.

### Decisiones de la fase Rueda

- **La impresora resulto ser USB, no Ethernet.** La Zebra esta en la cola `ZDesigner GX420t`
  (puerto `USB002`), asi que el socket 9100 no aplica y se implemento `usb.transport.ts`.
  El campo `transport` de `settings.json` permite alternar `tcp` / `usb` sin tocar codigo.
- **Como se manda ZPL crudo por USB**: `scripts/send-raw.ps1` hace P/Invoke a `winspool.drv`
  (`OpenPrinter` / `StartDocPrinter` / `WritePrinter`) con `pDataType = "RAW"`, que pasa los
  bytes sin que el driver los reescriba. Sin `RAW` el driver ZPL los transforma.
- **Cuidado con `DOCINFO`**: `StartDocPrinter` con `CharSet.Unicode` resuelve a
  `StartDocPrinterW` y exige `DOCINFOW` con `LPWStr`. Usar `DOCINFOA` da Win32 1804.
- **Trampa de ZPL**: `^CF0,18` fija ancho de caracter = alto. Los textos se desbordaban
  del papel. Todos los `^A0N` llevan ahora alto **y** ancho explicitos.
- **Orden obligatorio en ZPL**: `^A` -> `^FB` -> `^FO` -> `^FD`. Con `^FB` antes de `^A`
  el ajuste de linea se ignora.
- **El rollo es continuo** de 50 x 25 mm; la etiqueta se corta a mano.

### Deuda tecnica heredada (no bloquea, pero conviene corregir)

- `buildZpl()` usa la constante `DEFAULT_TEMPLATE` y **nunca lee `label.widthMm` /
  `heightMm` de `settings.json`**. Cambiar las medidas desde la UI no afecta lo que se
  imprime. Deberia derivar la plantilla de los settings.
- La plantilla y `settings.json` estan duplicados: pueden quedar desincronizados.
- `tcp.transport.ts` sigue sin probarse contra una impresora de red real: la unica
  maquina con 9100 abierto en la subred es una Epson L5190 de tinta, que no habla ZPL.

## Fase PATINETA - Escanear e imprimir con catalogo local

Objetivo: ciclo real escanear -> buscar -> imprimir.

- [x] `scanner-input.tsx`: captura del escaner (keydown + Enter sobre `document`)
- [x] `product.types.ts` + `product.repository.ts` (contrato) + `product.catalog.repository.ts` leyendo `data/catalog.json`
- [x] Poblar `catalog.json` con **12 productos de prueba** (no son los reales de PA PICAR, ver abajo)
- [x] `GET /api/products?q=` (exacto por codigo o barcode; parcial si no hay coincidencia exacta)
- [x] ProductCard + quantity stepper en la pagina normal
- [x] `POST /api/labels` ejecutando el ciclo completo con `{ productCode, qty, mode }`
- [x] Modo continuo (`/fast`): escanear -> imprimir automatico, con cola de un escaneo pendiente
- [x] `audit.store.ts` + `GET /api/history` + pagina `/history`
- [x] Pagina `/settings` funcional (impresora + etiqueta) con lista de colas de Windows
- [x] **Barcode legible por el escaner** (`^BY3` + EAN-13; antes `^BY2` + Code 128 salia por debajo del minimo)
- [x] Verificar con un escaner fisico de verdad (definicion de hecho)

**Definicion de hecho**: el operador escanea un codigo real y recibe su etiqueta.
**CUMPLIDA.**

> Estado: completada el 2026-09-29 en el PC del trabajo. El ciclo se verifico primero por
> API y con teclas simuladas, y despues de verdad: el operador escaneo desde `/fast` y la
> etiqueta que salio la leyo el mismo escaner.
>
> **Hubo un bug de por medio que hacia la fase parecer cerrada sin serlo**: el ciclo
> imprimia bien y el historial lo confirmaba, pero **el codigo de barras impreso no lo leia
> nadie**, porque `^BY2` daba un ancho de modulo de 0.250 mm (el minimo es 0.264 mm) y las
> barras median 6.00 mm (el minimo practico es 6.64 mm). Se veia bien en el papel. Ver
> `04 - Desarrollo/Prueba Legibilidad Barcode.md`.

### Decisiones de la fase Patineta

- **`POST /api/labels` pide `productCode`, no los datos.** El precio sale siempre del
  catalogo, nunca del cliente: asi no se puede imprimir una etiqueta con un precio
  inventado. A cambio, el endpoint ya no sirve para imprimir una etiqueta suelta fuera del
  catalogo (que era lo que hacia la fase Rueda).
- **El request acepta codigo interno o barcode.** El escaner entrega el barcode, pero el
  operador a veces teclea el codigo. `findByCode ?? findByBarcode` cubre los dos.
- **Los codigos se comparan como texto, nunca como numero.** Un EAN-13 empieza por ceros a
  la izquierda; `parseInt("009300002509")` los pierde y el producto queda imposible de
  encontrar. En el `catalog.json` de prueba hay un producto cuyo barcode empieza por cero
  a proposito, para que esta regresion no vuelva.
- **N etiquetas = un solo trabajo de impresion.** `buildZplBatch()` repite el bloque
  `^XA ... ^XZ` N veces. Es una sola ida y vuelta al spooler y, sobre todo, es atomico: si
  algo falla no sale la mitad del lote. Verificado: qty 5 genera 5 bloques `^XA`/`^XZ`.
- **El historial registra tambien los fallos.** Con solo los exitosos, el historial
  diria "imprimio bien" y noaria falta de las veces que la impresora no respondio.
- **Si el historial falla, la impresion sigue siendo un exito.** El papel ya salio;
  `safeAudit` avisa por consola y la API responde `ok: true`.
- **El catalogo se valida al leerlo, no solo al escribirlo.** `catalog.json` se edita a
  mano, asi que una fila mala (precio en cadena, barcode vacio) tiene que salir a la luz
  antes de llegar a una etiqueta. Si hay filas invalidas, el repositorio lanza con el
  numero de fila y el motivo, en vez de imprimir datos equivocados.
- **Cache del catalogo por `mtime`.** `catalog.json` se lee entero y se revalida en cada
  peticion; con miles de filas eso se nota en el modo rapido. Si el `mtime` no cambio se
  devuelve la copia en memoria.
- **El modo rapido apila un escaneo pendiente.** Si llega un escaneo mientras el anterior
  sigue yendo al spooler, se guarda y se imprime al terminar. Descartarlo seria perder una
  etiqueta sin avisar.
- **`GET /api/products` responde 200 con lista vacia, no 404.** "No existe" y "la app esta
  caida" tienen que verse distinto, y la UI distingue los dos casos.
- **`/api/printers` no bloquea el formulario.** Lanza PowerShell y tarda; si `/settings`
  esperara por el, la pagina se quedaria en "Cargando" aunque la config ya hubiera llegado.
  Si la lista falla, se sigue escribiendo el nombre de la cola a mano.
- **El barcode se imprime como EAN-13, no como Code 128.** No por gusto: Code 128 con
  `^BC` automatico **cambia de ancho segun el dato** (13 digitos = 123 modulos, 12 = 101,
  alfanumerico = 178), y a `^BY3` el caso de 13 digitos no deja zona quieta dentro de 400
  dots. EAN-13 son 95 modulos fijos. Ademas el catalogo guarda EAN-13, que es justo lo que
  se quiere escanear.
- **Antes de gastar papel se mide el simbolo.** `POST /api/labels` calcula el ancho real y
  las zonas quietas y responde 422 si no cabe, en vez de imprimir una etiqueta inservible.
  El calculo del ancho de Code 128 que tenia era una estimacion que fallaba por 11 modulos.
- **Un EAN-13 con el digito de control mal se imprime perfecto y no lo lee nadie.** Es el
  fallo mas desconcertante porque no se ve. El repositorio avisa por consola al cargar el
  catalogo y `POST /api/labels` lo rechaza con 422; `scripts/check-ean.ts` valida un
  catalogo entero.

### Bugs encontrados y corregidos durante la verificacion

- **Stepper de cantidad: dos clics rapidos daban un resultado menos.** Calculaba el valor
  siguiente desde la prop en vez de desde un updater, asi que 1 + 1 + 1 daba 2. Ahora
  `onChange` acepta un updater, como el setter de `useState`.
- **`/settings` se quedaba en "Cargando".** `Promise.all` con `/api/printers` bloqueaba
  todo el formulario. Ahora son dos cargas independientes.
- **El barcode impreso no lo leia el escaner.** `^BY2` daba un modulo de 0.250 mm (minimo
  0.264 mm) y barras de 6.00 mm (minimo practico 6.64 mm). Arreglado con `^BY3` + `^BEN,72`
  y todo el reparto vertical rehecho. Detalle en [[Prueba Legibilidad Barcode]].

### Lo que falta para cerrar la fase

- [x] Probar con el **escaner USB fisico**. Funciona: el operador leyo con el escaner la
      etiqueta que salio de `/fast`.
- [ ] Confirmar el **aspecto** de la etiqueta nueva: se movieron cuatro zonas y se
      cambiaron dos tamanos de fuente, y eso se razono con numeros, no mirando el papel.
- [ ] Probar el **ciclo de ida y vuelta**: escanear un producto, que imprima, escanear la
      etiqueta resultante y comprobar que devuelve el mismo producto. Se confirmo por
      partes (escanea e imprime), no encadenado.
- [ ] Reemplazar los **12 productos de prueba** por el catalogo real de PA PICAR, y decidir
      que se hace con los codigos que no sean EAN-13 (hoy darian 422).

> El archivo `C:\Users\BODEGON\Desktop\RESPALDO\Rogert\Lista_Precio_Productos.xls` tiene
> 2130 productos con codigos de barras reales, pero **se descarto**: es de enero de 2022
> (tasa 4,5756 Bs/$) y el encabezado dice "NURJAN IMPORT, C.A.", no PA PICAR. Se dejo
> constancia para no volver a buscarlo. Los 12 productos actuales se generaron con un script
> de un solo uso, con el digito de control EAN-13 calculado para que los barcodes sean
> escaneables de verdad. Cuando llegue el catalogo real basta con reemplazar el contenido de
> `data/catalog.json`: la forma de cada fila es la de `productSchema` en
> `src/lib/validation/schemas.ts`.

### Fuera de esta fase

- **Busqueda por nombre**: `[[Busqueda Manual]]` dice explicitamente que no es parte del
  MVP. El repositorio ya la soporta (`search` cubre codigo, barcode y nombre) y el endpoint
  la expone, asi que solo falta decidir cuanta tolerancia de error acepta el operador en la
  UI.

## Fase CARRO - Producto completo (sin XETUX)

Objetivo: robustez y gestion del catalogo dentro de la app.

> **El editor de plantillas se hace al final**, por decision del operador: la etiqueta tiene
> que quedar como se quiere antes de construir la herramienta que la dibuja.

Orden de trabajo decidido el 2026-09-29, empezando por un fallo de correccion y no por una
pantalla nueva:

- [x] **Coincidencias exactas vs aproximadas** (`match` en la API; `/fast` imprime solo lo
      exacto). Antes, una coincidencia por subcadena imprimia la etiqueta del producto
      equivocado. Ver [[Prueba Coincidencias]].
- [ ] **Estado real de la impresora**: que se vea sin papel, apagada o sin cinta.
      **Codificado y comprobado por software el 2026-09-29**, pero **sin la prueba fisica**
      que lo cierra: hay que quitar el papel o apagarla y confirmar que la app se entera.
      Ver [[Prueba Estado Impresora]].
- [ ] Gestion del catalogo local desde la web (CRUD de productos en `catalog.json`)
- [ ] Busqueda manual por nombre (requisito pendiente)
- [ ] Correr como servicio de Windows (PM2 / nssm)
- [ ] Pruebas en el puesto real de trabajo
- [ ] Editor de plantillas (diseno de la etiqueta en vivo) -- **ultimo, a proposito**

**Definicion de hecho**: la app se usa a diario por el operador. En curso.

### Decisiones tomadas al abrir la fase

- **El catalogo real de PA PICAR todavia no existe.** El Excel de RESPALDO quedo descartado
  (enero 2022, encabezado "NURJAN IMPORT, C.A."). El CRUD se construye y se prueba con los
  12 productos inventados; la carga del catalogo real es un paso posterior, y ahi es donde
  habra que revisar de nuevo el umbral de "muchas coincidencias": con 12 productos, `01`
  devuelve 9; con 2130 puede devolver cientos.
- **Que se hace con los barcodes que no son EAN-13 sigue sin decidir**, porque depende del
  catalogo real. Se dejo separada en dos reglas que no se contradicen:
  - *guardar* un producto con barcode no EAN-13: permitido, con aviso;
  - *imprimirlo*: 422, como ya esta.

  Esa separacion es la que deja empezar el CRUD sin fijar una regla que luego haya que
  deshacer.
- **Primero un fallo de correccion, no una pantalla nueva.** El fallo de coincidencias ya
  estaba vivo durante la fase Patineta y la impresion fisica de Patineta sigue siendo valida
  (el operador escaneo un barcode entero, que si es coincidencia exacta). No se corrige
  Patineta: se corrige un defecto que ese trabajo dejo al descubierto.
- **Un `powershell.exe` cuesta ~2,3 s en este PC.** Medido, no supuesto. Es el dato que
  condiciona dos decisiones de Carro: el estado de la impresora **no** se puede consultar en
  cada escaneo (con el ritmo de impresion ya es de ~2,4 s por etiqueta), y el banner refresca
  despues de cada impresion en vez de en bucle corto. Afecta tambien al punto del servicio
  de Windows: es el mismo cuello de botella.
- **El estado de la impresora avisa, no bloquea.** Con la cola en mal estado Windows guarda el
  trabajo y lo imprime cuando la impresora vuelva; negarse a imprimir tiraria las etiquetas.
  Un error de impresora es un *estado* (200 con `state: "blocked"`), no un fallo de la API.

### Lo que Carro todavia no ataca

- El **aspecto** de la etiqueta y el **editor de plantillas**, ambos al final por decision
  del operador.
- La integracion con **XETUX**, que sigue en suspenso.


## XETUX - En suspenso (fuera del roadmap actual)

XETUX no es parte de las fases actuales. Cuando se decida reintegrar:

- [ ] Capturar API real (F12 > Network en Chrome)
- [ ] Implementar `xetux.repository.ts` bajo el mismo contrato
- [ ] Mecanismo de fallback: si XETUX no responde -> aviso claro y opcion de seguir con el catalogo local
- [ ] Cifrado de credenciales

> Todo el flujo de UI/impresion ya esta preparado para que este cambio no requiera tocar componentes.

## Orden de implementacion (micro -> macro)
1. **Rueda**: canal de impresion funcionando
2. **Patineta**: ciclo de escaneo completo con el catalogo local
3. **Carro**: producto completo (gestion de catalogo, plantillas, robustez)

No se avanza de fase hasta cumplir la definicion de hecho de la anterior.

## Ver tambien

- [[Estado del Proyecto]]
- [[Estructura de Carpetas]]
- [[Modulos del Programa]]
- [[Prueba Legibilidad Barcode]]
- [[Prueba Coincidencias]]
- [[Prueba Estado Impresora]]