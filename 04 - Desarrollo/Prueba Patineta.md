# Prueba Patineta

> Registro de la verificacion de la fase Patineta: escanear -> buscar -> imprimir.
> La definicion de hecho es "el operador escanea un codigo real y recibe su etiqueta".

## Fecha y lugar

- **2026-09-29**, PC del trabajo. App en `http://localhost:3000`.
- Impresora: Zebra GK420t por USB, cola `ZDesigner GX420t` (misma de la fase Rueda).

## Como se verifico, y que NO se verifico

Esto importa mas de lo que parece, asi que va explicito:

| Que | Como | Resultado |
|---|---|---|
| Ciclo de API completo | `curl` / `Invoke-WebRequest` contra `/api/labels` | **Verificado** |
| Captura del escaner | Teclado sintetico (`KeyboardEvent`) en el navegador | **Verificado** |
| Stepper, busqueda, seleccion, estados | Automatizado sobre el DOM real | **Verificado** |
| Salen etiquetas de la impresora | Papel en la mano del operador | **Verificado** |
| **Escaner USB fisico** | Escaneo real desde `/fast` | **Verificado** |
| **La etiqueta impresa la lee el escaner** | Lectura fisica de la etiqueta | **Verificado** |
| Aspecto de la etiqueta con barcode EAN-13 | Razonado con numeros | **Sin mirar el papel** |
| Ciclo de ida y vuelta (imprimir y reescanear) | -- | **No probado** |

**Lo que el operador confirmo de verdad** fue una sola cosa, y basta para el objetivo de la
fase: escaneo desde `/fast`, salio la etiqueta, y **el mismo escaner la leyo**. Con eso las
dos filas marcadas quedan probadas. Las demas son de la ronda de pruebas automaticas.

La antepenultima fila es la que mas conviene no dar por buena: cuando se corrigio la
legibilidad del barcode se movieron cuatro zonas de la etiqueta y se cambiaron dos tamanos
de fuente. Eso se calculo, pero **el render generado (`preview/label-preview.png`) no se
pudo mirar**, asi que el aspecto final sigue sin confirmarse de ojos.

Las 5 etiquetas de la ronda sintetica quedaron obsoletas: su barcode salia por debajo del
minimo y no lo leia nadie. No tiene sentido volver a ellas.

## El bug que hacia pasar la fase por cerrada

El ciclo imprimia, el historial lo confirmaba y el `POST /api/labels` respondia `ok: true`
... y **el codigo de barras impreso no lo leia nadie**. `^BY2` daba un ancho de modulo de
0.250 mm (minimo ISO 15420: 0.264 mm) y barras de 6.00 mm (minimo practico: 6.64 mm).

Se veia perfecto en el papel, que es lo que lo hace peligroso: `ok: true` solo significa que
el spooler acepto el trabajo. Detalle completo, con la tabla de descartados y la tabla de
candidatos, en [[Prueba Legibilidad Barcode]].

## Pruebas de API que salieron bien

Lectura:

| Prueba | Resultado |
|---|---|
| `GET /api/products` | 200, 12 productos |
| `GET /api/products?q=7591234567801` (barcode exacto) | 200, 1 producto |
| `GET /api/products?q=P-0004` (codigo interno) | 200, 1 producto |
| `GET /api/products?q=cafe` (parcial) | 200, 1 producto |
| `GET /api/products?q=999` (inexistente) | 200, `products: []` |
| `GET /api/printers` | 200, 9 colas de Windows |

Validacion (`POST /api/labels`, sin gastar papel):

| Entrada | Respuesta | Por que |
|---|---|---|
| `{}` | 400 | falta `productCode` |
| `{"productCode":""}` | 400 | codigo vacio |
| `{"productCode":"P-0001","qty":0}` | 400 | minimo 1 |
| `{"productCode":"P-0001","qty":1000}` | 400 | maximo 999 |
| `{"productCode":"P-0001","qty":2.5}` | 400 | no es entero |
| `{"productCode":"9999999999999"}` | 404 | no esta en el catalogo |
| `no-es-json` | 400 | JSON invalido |

Impresion real:

| Llamada | Etiquetas | Historical |
|---|---|---|
| `productCode: 7591234567801, qty: 2, mode: normal` | 2 x CAFE AMANECER | registrada |
| `productCode: P-0006, qty: 1, mode: fast` | 1 x LECHE EN POLVO | registrada |
| escaneo simulado en `/fast`: 7804235001411 | 1 x ACEITE DE GIRASOL | registrada |
| escaneo simulado en `/fast`: 7591000010159 | 1 x CACAO EN POLVO | registrada |

Al final `Get-PrintJob -PrinterName "ZDesigner GX420t"` no devolvio nada: el spooler estaba
vacio, o sea que no quedaron trabajos atascados.

## Pruebas de interfaz que salieron bien

- Escaneo sintetico de `7591234567801` sobre `/` -> aparece la tarjeta de CAFE AMANECER,
  cantidad en 1, boton IMPRIMIR visible.
- Stepper: 1 + 3 clics = 4; un clic de menos = 3; baja hasta 1 y el boton `-` se
  deshabilita; escribir 7 a mano funciona.
- Codigo inexistente -> "Codigo ... no esta en el catalogo" y no imprime.
- Limpiar cierra la tarjeta y vuelve al estado inicial.
- Busqueda parcial `kg` -> 5 coincidencias y el operador elige.
- `/fast` arranca en reposo, un escaneo valido imprime solo sin clic, uno invalido avisa y
  no imprime, y tras imprimir vuelve al estado de reposo.
- `/history` lista las impresiones con fecha en formato `es-VE`.
- `/settings` muestra el formulario de inmediato y luego la lista de las 9 colas.
- Consola del navegador: sin errores ni advertencias.

## Bugs encontrados al verificar (y corregidos)

1. **Stepper: dos clics rapidos daban un resultado menos.** `onChange` recibia un numero ya
   calculado desde la prop, asi que los dos clics usaban el mismo valor viejo (1 -> 1 -> 2).
   Ahora `onChange` acepta un updater, igual que el setter de `useState`.
2. **`/settings` se quedaba en "Cargando configuracion".** Hacia
   `Promise.all([/api/settings, /api/printers])`, y `/api/printers` lanza PowerShell y
   tarda. Ahora son dos cargas independientes y la lista de colas no bloquea el formulario.
3. **El barcode impreso no lo leia el escaner.** Encontrado despues de dar por buena la
   fase. Detalle en [[Prueba Legibilidad Barcode]].
4. **Una coincidencia aproximada imprimia la etiqueta del producto equivocado.** Encontrado
   al abrir la fase Carro. Detalle en [[Prueba Coincidencias]].

## Un defecto que estaba vivo durante esta fase

El defecto 4 **ya existia** cuando esta fase se dio por cumplida, y conviene decirlo sin
rodeos: `/fast` imprimia `products[0]` de cualquier coincidencia, y la busqueda parcial
comparaba por subcadena tambien el barcode. Un escaneo leido a medias devolvia un producto
unico, indistinguible de una lectura buena, y se imprimia sin preguntar.

**La verificacion fisica de esta fase sigue siendo valida**: el operador escaneo un barcode
entero, que si es coincidencia exacta, y la etiqueta que salio la leyo bien. El defecto
solo se disparaba con lecturas parciales o busquedas ambiguas, y la prueba fisica no
buscaba ninguna de las dos.

Se corrige en la fase Carro, no antes: corregirlo antes habria significado reabrir una
fase que el operador ya habia confirmado.

## Deuda tecnica que sigue abierta

- `buildZpl()` usa la constante `DEFAULT_TEMPLATE` y **no lee** `label.widthMm` /
  `heightMm` de `settings.json`. `/settings` lo avisa en pantalla con un aviso amber, pero
  el defecto sigue ahi. Sin corregir, cambiar las medidas no cambia lo impreso.
- `tcp.transport.ts` nunca se probo contra una Zebra de red: en esta subred no hay ninguna.
- El catalogo son 12 productos inventados. Los precios y codigos de barras son de mentira.
- **El barcode ahora se imprime como EAN-13**, asi que un codigo real que no sean 13
  digitos daria 422 en `POST /api/labels`. Hay que decidir si se admite Code 128 como
  alternativa antes de cargar el catalogo real.
- Los `^A0N` siguen fijando la fuente a la A. La `03 - Diseno/Plantilla Etiqueta.md` puede
  pedir otra tipografia; no se reviso esa nota al hacer el layout de 50 x 25 mm.
- El **aspecto** de la etiqueta con el reparto vertical nuevo no se ha mirado en el papel.
  Por decision del operador, el diseno de la etiqueta y su editor se hacen **al final** de
  la fase Carro.

## Ver tambien

- [[Proximos Pasos]]
- [[Estado del Proyecto]]
- [[Prueba Fisica Rueda]]
- [[Prueba Legibilidad Barcode]]
- [[Prueba Coincidencias]]
- [[Escaner USB]]
- [[Flujo Principal]]
