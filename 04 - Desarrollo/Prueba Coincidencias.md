# Prueba Coincidencias

> Primer trabajo de la fase Carro. Corrige un fallo que imprimia **la etiqueta del producto
> equivocado, en silencio**, con el precio equivocado. Es el mismo tipo de fallo que el del
> barcode ([[Prueba Legibilidad Barcode]]): el sistema funciona, responde bien, y aun asi
> produce algo falso.

## Fecha y lugar

- **2026-09-29**, PC del trabajo. App en `http://localhost:3000`, sobre la build de
  produccion (`next build` + `next start`).

## El fallo

`GET /api/products?q=X` devolvia una lista y nada mas. No decia **como** habia encontrado
los productos. Y el modo rapido (`/fast`) hacia esto:

```ts
const { products } = await lookupProducts(code);
if (products.length === 0) { avisar("no esta en el catalogo") }
else { await print(products[0].code, 1, "fast"); }   // <-- el primero de la lista
```

O sea: cualquier lista no vacia se imprimia, y se imprimia su **primer elemento**.

A eso se sumaba que la busqueda parcial (`repository.search`) comparaba por subcadena el
codigo, **el barcode** y el nombre. De ahi salen tres formas de imprimir algo falso.

## Como se reprodujo, contra la app real

No se toco codigo hasta medir. Con el catalogo de 12 productos de prueba:

| Consulta | Antes | Que imprimia `/fast` |
|---|---|---|
| `7591234567801` (barcode exacto) | 1 | P-0001 correcto |
| `01` | **9** | **P-0001** (el primero de la lista) |
| `0001` | **4** | **P-0001** |
| `4235` | **5** | **P-0004** (ACEITE, 6,90) |
| `75912345678` (barcode **truncado**, 11 de 13) | **1** | **P-0001**, como si fuera una lectura buena |
| `7599999999999` (no existe) | 0 | nada |

Los tres casos con negrita son fallos reales:

- **`01`**: nueve productos coinciden por subcadena en el codigo (`p-0001`, `p-0010`...). En
  modo rapido imprimia CAFE AMANECER. El operador queria otra cosa.
- **`0001`**: cuatro productos, y el cuarto caso viene del **barcode** de otro producto:
  `77506700*0001*09` contiene la cadena `0001`. O sea, la busqueda por subcadena en el
  barcode es lo que multiplica las coincidencias.
- **`75912345678`**: el peor. Es un barcode leido a medias, que es justo lo que produce un
  codigo danado o un escaner que corta la lectura. Devolvia **un solo producto,
  indistinguible de una coincidencia exacta**, y se imprimia sin preguntar.

Sobre una góndola, el resultado es una etiqueta perfectamente impresa con el nombre y el
precio de otro producto. Y a diferencia del barcode ilegible, esta **se ve bien**: nadie la
cuestiona.

## Por que la busqueda por barcode era un error de diseno

Un barcode es un identificador unico, no una cadena de texto donde buscar. Si el codigo
escaneado no coincide entero, la unica respuesta aceptable es **"no esta en el catalogo"**.
Admitir coincidencias parciales no es "tolerancia a errores de tipeo": es inventar un
producto a partir de una lectura a medias.

Por eso el barcode salio de la busqueda parcial, y no solo del caso del barcode truncado.
Por codigo y por nombre la coincidencia parcial si tiene sentido, porque ahi el operador
esta buscando de verdad y puede elegir.

## El arreglo

El endpoint ahora dice **como** encontro el producto, y la UI lo respeta.

**`src/lib/products/product.lookup.ts`** (nuevo): `MatchKind` y `resolveQuery()`.

| Estado | Significado | Se puede imprimir sin preguntar |
|---|---|---|
| `exact` | codigo o barcode coinciden enteros | **si** |
| `partial` | coincidencia por subcadena en codigo o nombre | **no**, alguien tiene que elegir |
| `none` | no hay nada | no, hay que avisar |
| `all` | se pidio el catalogo entero, no es coincidencia | no habilita nada |

`all` existe para no mentir: `/api/products` sin `q` devuelve el catalogo completo, y
devolver `match: "exact"` ahi seria una frase falsa.

**`product.catalog.repository.ts`**: `search()` ya no compara el barcode. Solo codigo y
nombre.

**`/fast`**: imprime **solo** en `exact`. Ante `partial` avisa y no imprime:

> `"01" coincide con 4 producto(s) de forma aproximada, no es una coincidencia exacta. Este
> modo solo imprime coincidencias exactas: usa el modo normal para elegir.`

**`/` (modo normal)**: antes, un unico resultado parcial se aceptaba solo y salia el boton
IMPRIMIR, o sea que tambien imprimia una suposicion con la confirmacion del operador de
por medio. Ahora **cualquier** coincidencia aproximada va a la lista, aunque sea un solo
elemento, y el mensaje lo dice. El boton IMPRIMIR solo aparece tras una coincidencia exacta
o tras que el operador elija de la lista.

**`POST /api/labels` no hubo que tocarlo.** Resuelve con `findByCode ?? findByBarcode`, o
sea solo exacto. El riesgo estaba unicamente en el cliente, que decidia cual imprimir. Por
eso el arreglo era en la UI y en el contrato, no en la impresion.

## Verificacion

### API

| Consulta | `match` | n | `/fast` |
|---|---|---|---|
| `7591234567801` | exact | 1 | imprime P-0001 |
| `P-0007` | exact | 1 | imprime P-0007 |
| `p-0012` (minusculas) | exact | 1 | imprime P-0012 |
| `p 0001` (con espacio) | exact | 1 | imprime P-0001 |
| `75912345678` (truncado) | **none** | 0 | **no imprime** |
| `7591234567802` (un digito de mas) | **none** | 0 | **no imprime** |
| `01` | partial | 4 | no imprime |
| `0001` | partial | 1 | no imprime |
| `4235` | **none** | 0 | **no imprime** |
| `cafe` / `CAFE` / `500gr` | partial | 1 | no imprime |
| `P-` | partial | 12 | no imprime |
| `7599999999999` | none | 0 | no imprime |
| sin `q` | all | 12 | - |

`7591234567802` merecio una prueba propia: **un digito de mas ya no resuelve a ningun
producto**. Antes, un digito mal leido todavia podia dar con un barcode real.

### Navegador, sobre la app de verdad

Con el `fetch` de `/api/labels` interceptado, para contar los intentos de impresion **sin
gastar papel**:

| Pagina | Entrada | Banner | Intentos a `/api/labels` |
|---|---|---|---|
| `/fast` | `75912345678` | "no esta en el catalogo" | **0** |
| `/fast` | `01` | "coincide con 4 ... de forma aproximada" | **0** |
| `/fast` | `cafe` | "coincide con 1 ... de forma aproximada" | **0** |
| `/fast` | `0001` | "coincide con 1 ... de forma aproximada" | **0** |
| `/fast` | `7591234567801` | "1 etiqueta impresa" | 1, cuerpo `{"productCode":"P-0001","qty":1,"mode":"fast"}` |
| `/fast` | `p-0011` | "1 etiqueta impresa" | 1, cuerpo `{"productCode":"P-0011",...}` |
| `/` | `cafe` | "1 productos coinciden ... elige uno" | sin boton IMPRIMIR |
| `/` | `0001` | "1 productos coinciden ... elige uno" | sin boton IMPRIMIR |
| `/` | `01` | "4 productos coinciden ... elige uno" | sin boton IMPRIMIR |
| `/` | `7591234567801` | "CAFE AMANECER DE 500GR" | con boton IMPRIMIR |

Que el caso exacto siga mandando `productCode: P-0001` y no el `code` del primer resultado
de otra tabla es la comprobacion de que el camino bueno no se rompio al tapar el malo.

Consola del navegador: sin errores ni advertencias.

`tsc --noEmit` limpio y `next build` sin errores.

## Lo que NO se verifico

- **No se gasto papel en esta prueba.** El camino exacto se comprobó interceptando la
  llamada en el navegador, no con una impresion real. La impresion fisica de `/fast` con
  coincidencia exacta ya estaba confirmada en [[Prueba Patineta]] y el codigo que se manda
  es el mismo; aun asi, la impresion fisica de este arreglo queda pendiente de que el
  operador haga un escaneo real.
- **Falta probarlo con el catalogo real.** Con 12 productos, un termino corto como `01`
  coincide con 9. Con 2130 productos, `P-0001` devuelve 1 pero `cafe` puede devolver
  cientos. El umbral de "muchas coincidencias" en la UI habra que mirarlo con datos de
  verdad.
- **No se reviso si el escaner puede enviar un prefijo o un caracter de control.** Si lo
  hiciera, la coincidencia exacta ya no seria exacta y este arreglo solo lo convertiria en
  un "no imprime". Habria que normalizar la entrada en `scanner-input.tsx`.

## Decision que se dejo abierta a proposito

Si un producto debe poder imprimirse aunque su barcode no sea un EAN-13 valido **no se
decidio todavia**, porque depende del catalogo real de PA PICAR, que todavia no existe. Se
tomaron dos decisiones separadas:

- **Guardar** un producto con barcode que no sea EAN-13: permitido, con aviso. Almacenar un
  dato del que uno sospecha no es motivo para rechazarlo.
- **Imprimir** ese producto: prohibido, 422. Si sale en el papel, sale mal, y eso ya se
  comprobo.

Esa separacion es la que permite empezar el CRUD sin fijar una regla que despues hay que
deshacer.

## Deuda que deja esto

- `POST /api/labels` acepta cualquier `productCode` y resuelve exacto. Si en el futuro
  alguien le pasa un termino parcial, devuelve 404. Correcto, pero conviene un test que lo
  fije.
- El catalogo de `data/catalog.json` sigue con 12 productos inventados.
- La busqueda parcial no tiene paginado ni limite. Con miles de filas, `search()` devuelve
  el arreglo entero al navegador. Habra que acotarlo.

## Ver tambien

- [[Proximos Pasos]]
- [[Estado del Proyecto]]
- [[Prueba Legibilidad Barcode]]
- [[Prueba Patineta]]
- [[Modo Continuo]]
- [[Busqueda Manual]]
