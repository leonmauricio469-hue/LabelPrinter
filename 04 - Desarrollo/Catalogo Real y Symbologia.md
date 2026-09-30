# Catalogo Real y Symbologia

Tercer trabajo de la fase **Carro**: pasar del catalogo de 12 productos inventados al catalogo
real de PA PICAR, y decidir que symbologia lleva cada etiqueta.

> **Estado: codificado y verificado por software. SIN CONFIRMACION FISICA.**
> Lo unico que no esta comprobado es si la impresora optimiza el subconjunto de Code 128
> en modo automatico. Ver "La prueba que falta" abajo.

## Por que esta fase existia

Con los 12 productos de prueba, todo era EAN-13 y la pregunta no existia. Los 12 tenian
codigo de 13 digitos, el simbolo ocupaba siempre 95 modulos, y el ancho no dependia del
dato. `^BE` y ya esta.

Con el catalogo real la pregunta es inmediata y no tiene una respuesta sola: **3080
productos, y no todos los codigos son EAN-13.** Hay UPC-A de 12, hay alfanumericos de
13-15 caracteres, hay codigos de 4 digitos y hay productos sin codigo. Forzar una sola
symbologia se salia del papel en 6 de cada 10 productos.

## De donde sale el catalogo

El export de PA PICAR, 3080 productos, 23 familias (2540 RETAIL, 260 LICORES, mas una
carta de foodservice). Se leyo **sin convertir nada** y sin abrir el Excel de inventario:

- `scripts/leer-catalogo.ps1`: Excel COM en modo solo lectura. `AutomationSecurity = 3` para
  que no corran macros, `Workbooks.Open($src, 0, $true)` para solo lectura, el `UsedRange`
  entero leido con `.Value2` de una vez. La hoja se llama "Exportar a PDF".
- `scripts/importar-catalogo.ts`: el CSV a `data/catalog.json`, validando cada fila contra
  el esquema real y escribiendo un informe de lo que no cuadra.

**Resultado: 3080 importados, los 3080 validan, 0 descartados, 442 KB, sin BOM.** Copia del
anterior en `data/catalog.json.bak` (el de los 12 inventados).

**"Solo lectura" no es inocente aqui.** El `.xls` de la columna `#` es la que genera los
`code` de producto, y de ahi viene el problema mas grave de la fase. Ver abajo.

## El reparto real

| Symbologia | Productos | Que es |
|---|---|---|
| `^BE` EAN-13 | 2250 | 1180 de 13 digitos correctos, 1064 UPC-A de 12 con un 0 delante, 6 con el control mal |
| `^BC` Code 128 | 561 | alfanumericos: `XPROD20220002`, `202616OZ`, `PU000003`... |
| sin codigo | 269 (8,7 %) | 264 no caben a 3 de modulo, 5 vienen como `0` o `null` en origen |

De los 269 sin codigo, **29 son RETAIL o LICORES** (se escanean en caja) y **240 son de
mostrador** (café, postres, jugos, brunch: se venden por nombre, no se escanean).

## Las cinco reglas, y por que cada una

Viven en `src/lib/labels/barcode-plan.ts`, en `planBarcode()`. Es una funcion pura: mismo
codigo, mismo resultado, sin archivos ni excepciones. Todo caso raro devuelve un `reason`,
nunca revienta, porque esta en el camino de una impresion.

1. **EAN-13 de 13 digitos con control correcto -> `^BE` tal cual.** 95 modulos fijos, el
   ancho no depende del dato.
2. **UPC-A de 12 digitos -> `^BE` con un 0 delante.** Un UPC-A *es* un EAN-13 con un 0
   delante: no es una convencion mia, sigue siendo un simbolo valido de 95 modulos y entra
   sin tocar el ancho. Son 1068 productos, el 35 % del catalogo.
3. **Control mal -> se corrige al imprimir y se avisa.** Un EAN-13 con el control mal se
   imprime impecable, con buen contraste y la altura correcta, y no hay lector que lo
   decodifique. Es el peor fallo posible porque no se ve. Corregirlo produce un codigo que
   si lee. Son 6 productos, y el aviso dice cual es el bueno para arreglarlo en origen.
   **El catalogo NO se corrige al guardar**: el barcode se guarda tal cual para que
   `catalog.json` siga siendo copia fiel y el error se pueda ver y arreglar.
4. **Alfanumerico -> Code 128 `^BC`.** EAN-13 solo admite digitos, no hay alternativa.
5. **El que no cabe -> etiqueta sin codigo.** Se comprueba antes de gastar papel, porque un
   simbolo que se sale del papel produce una etiqueta que sale bien y que no lee nadie.

## Lo que NO se hizo, y por que

**No se bajo el modulo a 0,250 mm.** El minimo de X en ISO/IEC 15420 es 0,264 mm. 2 dots
son 0,250: un 5 % por debajo, y con el sangrado termico de un cabeza a 203 dpi las barras
estrechas se cierran. A 2 de modulo cabrian 180 modulos en vez de 113, y 182 productos mas
tendrian codigo, pero de los que se escanean en caja solo pasarian de 29 a 2 sin codigo.
Se eligio respetar la norma: son 29 productos de RETAIL, y se imprimen con nombre y
precio a la espera de una decision de negocio.

**No se metio el comando ZPL del barcode en la plantilla.** `BarcodeZone` ya no tiene
`format` ni `symbology`: la plantilla da posicion, altura y si lleva linea de
interpretacion, y `barcodeFormat()` construye `^BE` o `^BC` a partir del plan. Con el
comando escrito a mano en la plantilla habia dos verdades, y ganaba la que nadie revisaba.

## Tres bugs que aparecieron

### 1. `XPROD2022000NaN` en 181 etiquetas

El guardia de "esto es un EAN-13" comprobaba la **longitud**, no los digitos.
`XPROD20220002` tiene 13 caracteres, asi que entraba en la rama de EAN-13, `isValidEan13`
devolvia false, y la rama de "corregir el control" fabricaba `XPROD2022000NaN`: los ultimos
dos caracteres del codigo original sustituidos por un `NaN` de un `parseInt` fallido.

No habria salido en una etiqueta: **lo encontro la prueba unitaria de `barcode-plan.ts`**. Un
`NaN` en `^FD` imprime basura, y de lejos parece un codigo de barras.

El guardia ahora es `/^\d{13}$/` y `/^\d{12}$/`, no longitud. Once productos con nombre
alfanumerico de 13 caracteres estaban expuestos, y el numero de etiquetas afectadas habria
sido 181.

### 2. La zona quieta se calculaba con un numero fijo

El primer codigo usaba 10 dots fijos para la zona quieta. La norma pide 10**X**, donde X es
el ancho de modulo: el suelo crece con el. Con `^BY3` son 30 dots, con `^BY2` 20. El
calculo correcto es `modulos <= ancho/X - 2*factor`, y de ahi sale `maxModules()`.

### 3. Un `if` que devolvia lo mismo en las dos ramas

`resolveLabel()` se escribio con una rama para "sin zona de barcode" y otra con la lista
alternativa, y las dos hacian `emit(template, zones, ...)`. No rompia nada, pero era ruido
que ocultaba la logica. Se reescribio plano.

Ademas, en la reescritura se colaron dos **caracteres CJK** en los comentarios de
`zpl.builder.ts` (`U+6253 U+5370`, "imprimir"). Es el tercer caso del mismo problema en esta
sesion, y por eso todos los `.ts` se comprueban con un barrido de `\u2E80-\u9FFF` antes de
dar cualquier cosa por buena.

A esta nota le paso el mismo barrido, y encontro tres glifos mas. Es un sintoma que se
repite, no un accidente aislado.

## El problema del que nadie avisa: los `code` son numeros

Este es el hallazgo del catalogo real, y no tiene nada que ver con la symbologia.

La columna `#` del export son 3080 filas y se importo **tal cual**, sin prefijo. Asi que
los `code` de producto quedaron como `"1"`, `"2"`, ..., `"3080"`, a pelo.

Con los 12 productos de prueba el `code` era `"P-0001"`, y un escaner, que solo produce
numeros, jamas podia acertar con un codigo. El problema no existia. **Con codigos numericos
a pelo, un escaner que entrega una lectura a medias puede dar en un producto EXACTO.**

El caso concreto: el barcode `"4388"` es COCINA ELECTRICA PARA CARBON, y `"4"`, `"43"` y
`"438"` son los `code` de los productos 4, 43 y 438. Si el escaner se come el ultimo
digito, entrega `"438"`, la busqueda resuelve **exacta**, y `/fast` imprime la etiqueta de
otro producto sin preguntar. Es exactamente el fallo que `MatchKind` se invento para cerrar,
y lo volvia a abrir el catalogo real.

**Hay 593 terminos asi.** Medido en `scripts/medir-barcode-numerico.js`.

### La primera regla que se probo, y por que no vale

Lo primero fue un minimo de caracteres: `MIN_DIGITOS_CODIGO = 7`. La prueba unitaria lo
tumbo en la primera ejecucion, con un dato que hacia falta mirar:

```
### Barcodes de SOLO digitos, por longitud (crudo)
   4 digitos:    1   4388=COCINA ELECTRICA PARA CARBON
   5 digitos:    4   40949=MISERABLE DE SILICON
   6 digitos:  146   000294=ACEITUNAS KALAMATA 2KG
   7 digitos:  245   0000180=7 ESPECIES 150 GR
```

**151 productos tienen barcode de 4, 5 o 6 digitos.** Con un minimo de 7, esos 151
dejaban de poder escanearse: pasaban a "no esta en el catalogo" para productos que si
estaban. Un umbral que protege a unos deja de proteger a otros y solo mueve el fallo.

### La regla que si vale

La pregunta util no es "¿cuantos digitos tiene?", sino **"¿este texto puede ser un barcode
al que le falta el final?"**. Y esa depende de los datos, no de la forma del termino.

Por eso se responde en el contrato del repositorio, no con una constante:

```ts
esPrefijoDeBarcode(term: string): Promise<boolean>;
```

En `resolveQuery()`, el orden es el que hace el trabajo:

1. `findByCode(candidato)` -- **siempre primero**. Viene del listado o de un tecleo
   intencional, no de un escaneo a medias.
2. `findByBarcode(candidato)` -- **solo si no es prefijo de ningun barcode**.
3. Repetir 1-2 con la otra forma del mismo barcode (el 0 delante del UPC-A).
4. Subcadena, solo con `MIN_BUSQUEDA` (3) caracteres.

El paso 1 va primero por una razon que no es de seguridad sino de correccion: si el guardia
de prefijos fuera primero, teclear `3080` no abriria su producto, y **no se podrian
imprimir todos los codigos**. El `code` es lo que la app manda a imprimir desde el listado;
bloquearlo deja 3080 productos sin imprimir.

El paso 2 va segundo porque el barcode es lo que produce el escaner, y lo que produce el
escaner puede venir cortado.

**"Prefijo ESTRICTO"** quiere decir que un barcode entero no es prefijo de si mismo. Sin
ese matiz, el producto de 4 digitos se bloquearia a si mismo y no se podria escanear nunca.

**El barcode va antes que el code en `findBy*`**, y no al reves. El barcode es lo que ve el
operador; el `code` es un identificador interno. Ademas los dos caminos (esta busqueda y
`POST /api/labels`) tienen que resolver IGUAL, o la pantalla muestra un producto y se
imprime otro. Medido: **0 de los 3080 barcode colisiona con un `code`**, asi que hoy el
orden es irrelevante, pero se deja fijo para que no importa que se rompa.

### `too-short`, un estado que no existia

`"A"` devolvia 2828 productos, `"PA"` 392. Con 12 productos eso no pasaba. Se añadió un
`MIN_BUSQUEDA = 3` y un tope `MAX_BUSQUEDA = 60`.

Y `too-short` se **separo de `none`**, porque son cosas distintas:

- `none` = "no hay nada". La respuesta es avisar.
- `too-short` = "aun no has escrito lo suficiente". Decirle "no esta en el catalogo" al
  operador que esta tecleando es mentira.

## La busqueda por subcadena, y por que el barcode queda fuera

`search()` busca en `code` y `name`, **nunca en `barcode`**. El barcode es un identificador
unico: si no coincide entero, la respuesta correcta es "no esta en el catalogo", no "aqui hay
cuatro productos cuyo barcode contiene estos digitos". Buscar por subcadena en el barcode
convierte un codigo ilegible en una sugerencia plausible y equivocada.

## El 422 que era un error en el 62 % de los productos

`POST /api/labels` tenia un 422 que rechazaba "el barcode no se puede imprimir como EAN-13"
y otro que rechazaba por zona quieta corta. Con el catalogo real, ese 422 habría saltado en
el 62 % de los productos. No era un error de quien pulsa: era un dato del sistema de origen.

Ahora los dos casos son **avisos, no errores**:

- control corregido -> se imprime igual, y el aviso dice cual era el codigo bueno
- sin codigo imprimible -> se imprime igual, y el aviso dice por que

La respuesta lleva `barcode: {symbology, data, modules}` y `avisos: string[]`, y el banner
de `/` y `/fast` los muestra. **Imprimir sale bien y el papel esta en la mano**, asi que el
estado es `ok`; lo que cambia es que no se puede ir sin enterarse.

Un unico 500 se conserva, y es el correcto: si el plan dijo que el simbolo cabe pero la zona
quieta sale corta, la plantilla y `planBarcode()` han dejado de estar de acuerdo. Eso es un
fallo **interno**, y un 422 diria al operador que su codigo esta mal, que no es verdad.

## `zonesWithoutBarcode`

Sin esta lista, los 269 productos sin codigo sale con el logo, el nombre y el precio arriba
y **12,5 mm de papel en blanco abajo**, que parece una etiqueta rota.

La decision se toma **antes de emitir nada**, y no zona a zona, en `resolveLabel()`. La
plantilla trae una lista alternativa completa (logo, nombre en 3 lineas, precio grande,
referencia, todo centrado).

**Sus coordenadas estan puestas a ojo y sin ver la etiqueta impresa.** El modelo no puede
ver imagenes, asi que ni el render ni los screenshots se han inspeccionado. Es lo primero
que hay que mirar cuando haya una etiqueta delante.

## La nota de formato: `tsconfig.preview.json`

Se **corruptio** al editarlo con PowerShell (`-replace` vacio entradas y dejo correr `.js`
viejos). Se arreglo a mano y se recompilo limpio. Desde entonces: **nunca editarlo con
PowerShell**, y al anadir un script hay que borrar `.preview-build` y recompilar, o se
ejecuta codigo viejo.

Y no se le pueden poner `paths` para resolver `@/`: el preview compila a CommonJS y
TypeScript no reescribe los alias en el JS emitido. Un `@/` pasaria la comprobacion de
tipos y reventaria con `Cannot find module` **al ejecutar el script**, que es cuando ya no
se puede arreglar. En `product.lookup.ts` el import de `barcode-plan` es relativo, con un
comentario que explica por que.

## Verificacion

| Que | Como | Resultado |
|---|---|---|
| `planBarcode` con casos raros | `check-barcode-plan.ts` | **32 pruebas, todas ok** |
| Reparto sobre el catalogo real | idem | 2250 `^BE`, 561 `^BC`, 269 sin codigo |
| El bug del `NaN` | idem | el guardia es de digitos, no de longitud |
| `resolveQuery` sobre 3080 productos | `check-busqueda.js` | **27 pruebas, todas ok** |
| Los 593 terminos peligrosos | idem | ninguno resuelve como exacto |
| Barcodes de 4 a 7 digitos | idem | los 245 se siguen escaneando bien |
| UPC-A con el 0 delante | idem | escaneado de las dos formas |
| Importador | `importar-catalogo.ts` | 3080/3080 validan, 0 descartados, 442 KB |
| `tsc --noEmit` | linea de comandos | limpio |
| `next build` | linea de comandos | limpio, 14 rutas |

## La prueba que falta

**Lo que hace la impresora con `^BC` en modo automatico no se sabe.** Es lo unico que queda
de esta fase, y decide si 264 productos sin codigo lo estan de mas.

`planBarcode()` calcula el ancho con Code B completo: conservador, y es lo correcto
mientras no se sepa lo que hace la impresora. Si optimiza, un codigo como `202616OZ`
(EMBASE 12 OZ) son **101 modulos = 303 dots = 37,88 mm** y **si caben** en 400. Con Code B
completo son 123 modulos = 369 dots, y con zona quieta son 429: no caben.

**Diferencia: 22 modulos = 66 dots = 8,25 mm.**

### El protocolo

Dos etiquetas generadas con `scripts/generar-prueba-symbology.ts`, que imprime el ZPL y el
comando exacto de cada una:

- **A**, `^BY3`: el de produccion. Si usa Code B entero, al simbolo le quedan 16 dots de
  zona quieta cuando la norma pide 30, y un lector serio **no deberia** leerla.
- **B**, `^BY2`: el control. Sobran 139 dots, asi que se lee uses el subconjunto que use.
  Sirve para separar "no cabe" de "la impresora no funciona".
  Ojo: 0,250 mm esta un 5 % por debajo del minimo de ISO, **esta prohibido en produccion**.
  Aqui es una sonda de diagnostico.

| A escanea | B escanea | Conclusion |
|---|---|---|
| si | si | La impresora optimiza. Cabe, y hay que revisar por que el plan los descarta |
| no | si | Usa Code B entero. El plan tiene razon, `no-cabe` es correcto |
| no | no | Ni impresora ni escaner. Repetir [[Prueba Fisica Rueda]] |

**Con el resultado, la siguiente decision es si el plan aprende a codificar mixto
(`Start C` + `Start B` en vez de Code B entero).** Es un cambio real, no un parche, y por
eso espera a la medida.

## Un error mio, en el calculo del "optimo"

La primera version de la sonda calculaba los digitos por pares sobre la cadena entera, y
daba **90 modulos** con una nota que decia `Start C x4 + Start B x0`. Ninguna de las dos
cosas era verdad para `202616OZ`: la cuenta correcta es por rachas, y da **101 modulos**
con `C x3 ("202616") + B x2 ("OZ")`.

Se corrigio antes de imprimir nada. Las cifras de arriba son las del codigo corregido.

## Deuda tecnica que queda viva

- **`buildZpl()` ignora `label.widthMm` y `heightMm`.** La geometria sale de `widthDots`.
- **`tcp.transport.ts` esta escrito pero nunca probado.** El envio va por USB.
- **No se reviso si el escaner puede enviar prefijo o caracter de control** antes del
  codigo. Si lo hace, `variantesDeBusqueda()` no lo cubre.
- **Los 29 productos de RETAIL sin codigo** quedan sin resolver de negocio: el operador
  teclea el nombre.
- **`zonesWithoutBarcode` sin ver la etiqueta.** Coordenadas a ojo.
- **Imprimir cuesta ~2,4 s** por el `powershell.exe` por etiqueta. Ver
  [[Prueba Estado Impresora]].

## Problemas del export de origen

Del informe que escribe `importar-catalogo.ts` (`data/informe-catalogo.md`):

- **6 controles mal**: `740312410281`, `0400000570608`, `074570820110`, `759138100688`,
  `6971824952502`, `240509130452`. Se corrigen al imprimir y se avisa.
- **`7509546074627` en dos Palmolive distintos.** El barcode no es unico en origen.
- **11 productos a $0,00.**
- **4 codigos `0` y 1 `null`.** El sistema de origen los guardo vacios.
- **4 nombres repetidos.**
- **2 codigos con guion** (`02-012`, `99-999`), que `normalize()` quita al comparar.

Ninguno se "arreglo" al importar: `catalog.json` es copia fiel, y los problemas se arreglan
en el sistema de origen o con el CRUD de la fase Carro.

## Ver tambien

- [[Estado del Proyecto]]
- [[Proximos Pasos]]
- [[Prueba Estado Impresora]]
- [[Prueba Coincidencias]]
- [[Prueba Legibilidad Barcode]]
- [[Convenciones de Codigo]]
