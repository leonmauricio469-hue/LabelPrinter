# Plantilla 59 x 35 mm, editor de geometria y capa de override

## Que hay

La etiqueta de PA PICAR es de **59 x 35 mm**, no de 50 x 25. Todo lo de la 50 x 25 se borro:
la plantilla antigua, el selector de plantillas de `/settings`, y las medidas que arrastraba.

Una sola plantilla, `DEFAULT_TEMPLATE` en `label.template.ts`:

```
ancho  472 dots  = 59,00 mm
alto   280 dots  = 35,00 mm
MM_TO_DOTS = 8   (203 dpi)
```

**Nada se escala proporcionalmente.** Cada zona tiene sus numeros en dots, y si cambia el
ancho del **diseno** hay que mover las zonas a mano, en el editor o en el codigo. Es lo unico
que se puede hacer bien: una plantilla que se estira sola deformaria el logo, dejaria el
EAN-13 con un modulo de 0,4 mm y pondria el precio encima del nombre.

El ancho del **medio** (el rollo) si es configurable, pero no escala el diseno: solo cambia el
`^PW`. Ver mas abajo.

El reparto vertical, con el nombre mas largo que cabe (54 dots de alto):

```
y    8.. 272   marco, 1 dot de grosor, radio 16
y   20..  87   logo, 200 x 67 dots (25,0 x 8,4 mm), centrado
y   92.. 146   nombre, una linea, hasta 54 dots de alto  <-- lo que se agranda
y  150.. 214   barras, 64 dots = 8 mm
y  216.. 228   linea de interpretacion, 12 dots
y  230.. 260   REF: y el precio
y  271         borde interior del marco
```

## El editor: `/editor`

Todo el contenido de la etiqueta se mueve y se redimensiona. La previsualizacion **no es una
maqueta**: la dibuja `renderLabel()`, que es el mismo codigo que produce el ZPL. Si el PNG
sale bien, el ZPL esta bien. Un renderizador aparte, dibujando cada elemento por su cuenta,
daria verde en verde con dos medidas distintas.

Las cuatro clases de zona hacen cosas distintas al estirarlas, y no hay manera de que hagan lo
mismo:

| Zona | Vertical | Horizontal |
|---|---|---|
| texto | alto de la fuente (el techo de `autoFit`) | ancho de la caja `^FB` |
| grafico | reescala el `^GFA` conservando la proporcion | idem |
| barras | `heightDots` | **no se puede**: 95 modulos fijos |
| **marco** | **no se toca** | **no se toca** |

### El marco no se mueve (v1.7)

En v1.6 los cuatro tipos de zona se podian mover, marco incluido, con el argumento de que si
el borde va a 2 mm del borde eso se decide mirando la etiqueta. La razon era buena y la
conclusion estaba equivocada: **lo que se decide mirando la etiqueta es el ancho del rollo**,
que es un dato de la impresora, no la posicion del marco.

El marco es el margen fisico del papel. Si el borde queda a 0,4 mm del canto, la impresora lo
corta y la etiqueta sale con un lado comido, y eso no lo arregla ni el ZPL ni el arrastre. Es
ademas la unica zona cuya medida se deduce sola de la plantilla, de modo que si se pudiera
mover, `label.template.ts` y lo guardado en `data/plantilla-override.json` dirian dos cosas
distintas sin que nada dijera cual manda.

Por eso en v1.7:

- `EDITABLES` en `/editor` es `text, barcode, graphic`. **Sin `shape`.** El marco sigue en la
  lista, en gris y con "(fija)", y sigue dibujandose en la previsualizacion: quitado del
  editor no es quitado de la etiqueta. Lo que se quita es el tirador, que es lo que invita a
  moverlo.
- Su panel de numeros (ancho, alto, grosor, esquina) se borro. Era inalcanzable, y un
  formulario de esos seria una forma de desincronizar el marco de lo que se imprime.
- Sus medidas salen de `ANCHO_DOTS - 2 x margen`, no de un `59` y un `35` escritos a mano.
  Antes los tres consumidores de la medida (`widthDots`, el marco, el centrado del logo) la
  escribian por su cuenta, y nada comprobaba que siguieran siendo el mismo numero. Cambiar el
  ancho a mano era cambiar uno y olvidarse de los otros dos, y el que se olvidaba era el marco.
- La rama de `shape` en `redimensionar()` y sus 8 comprobaciones en `check-resize` **se
  quedan**. La geometria existe y esta probada; lo que no se hace es presentarla como la
  garantia de algo que la pantalla ya no ofrece. El aviso esta escrito en el propio test.

## El ancho del rollo: `printer.mediaWidthMm`

Son dos medidas distintas y confundirlas cuesta caro:

| | Que es | Quien lo pone | Para que sirve |
|---|---|---|---|
| **el medio** | el rollo de papel cargado | la persona, en la impresora | solo `^PW` |
| **el diseño** | la etiqueta de `label.template.ts` | el codigo (o `/editor`) | centrado, zona quieta, marco |

El medio va en `/settings` ("Ancho del rollo"), editable, sin arrastrar. El diseño **no** se
arrastra en absoluto: sus zonas se mueven en `/editor` y su medida sale del codigo.

**El medio solo manda en `^PW`, y a proposito.** Si el ancho del medio se metiera tambien en
la plantilla, el EAN-13 se centraria sobre el medio en vez de sobre el diseño, y la zona quieta
se mediria contra el canto del rollo en vez de contra el borde de la etiqueta. Las dos cosas
seguirián dando verde y dirian dos medidas distintas de lo mismo.

### `^PW` recorta, y no avisa

Si el rollo es de 50 mm y la etiqueta de 59, `^PW400` recorta todo lo que pase de 400 dots.
El ZPL sigue siendo valido, la impresora no protesta, el trabajo sale de la cola como
entregado, y al papel llega una etiqueta a la que le falta el lado derecho. Sin barras, sin el
precio entero, o con el marco cortado.

No se ve en la previsualizacion (que dibuja el diseño, no el medio) ni en el ZPL (que no dice
"he recortado", dice los numeros que le han dado). Solo se ve en el papel, que es donde no se
puede mirar antes de gastar.

Por eso `problemaDeMedio()` esta en `zpl.builder.ts`, al lado de la linea que escribe `^PW`, y
`POST /api/labels` **se niega a imprimir** con un 422 que trae los dos numeros en mm. Tambien
cubre el `0` (campo vaciado) y el `NaN`, que producirian un rollo entero de papel en blanco.

Cuando el medio es **mayor** que el diseño no dice nada: sale entero, con el sobrante en blanco
a la derecha porque el diseño va anclado a la izquierda. Centrarlo automaticamente no se hace:
cambiaria el sistema de coordenadas del editor y habria que hacer crecer el lienzo para que la
previsualizacion siga siendo el ZPL, y eso es otra tarea.

Tres cosas que no son evidentes:

- **Un texto no se estira en horizontal.** La fuente tiene su proporcion; lo que se estira es
  el hueco donde se imprime (`^FB`). Se cambia la anchura de la caja, no el glifo.
- **El `^GFA` solo acepta anchos multiplos de 8**, porque el formato es por bytes. Se ajusta al
  multiplo MAS CERCANO, no al de arriba. Y el ajuste se hace **antes** de calcular el factor
  de escala: si no, la cuantificacion se cuenta dos veces y el logo sale deformado.
- **Un asa que el tipo de zona no honra no se dibuja.** El ancho del EAN-13 son 95 modulos
  fijos; poner un tirador ahi seria un tirador muerto, que parece un fallo aunque no haga
  nada. Ademas, mientras `center` este activo, la `x` de las barras se ignora: se recalcula.

## Aplicar: `data/plantilla-override.json`

El boton "Aplicar cambios" **no reescribe `label.template.ts`**. Guarda las zonas en
`data/plantilla-override.json`, una capa que `templateForPrint()` aplica encima de la
plantilla del codigo al imprimir.

Es una distincion deliberada:

| | reescribir el `.ts` | guardar un archivo de datos |
|---|---|---|
| cuando aplica | al reiniciar / rebuild | al instante |
| como se deshace | `git checkout`, con cambios de por medio | borrar un archivo |
| si algo va mal | se ha perdido la plantilla | no se ha perdido nada |
| auditable | si, con git | no |

El archivo **esta en `.gitignore`**, a proposito. Es geometria por maquina, no datos de la
empresa como el catalogo o la configuracion: si se siguiera, lo que alguien ajusto en una
impresora pasaria a ser lo que imprimen las demas al hacer pull, y `label.template.ts` dejaria
de decir lo que se imprime sin que nada lo avise. Ademas, que no este en git es lo que hace
que **su ausencia sea el estado bueno**: si no hay archivo, se imprime la plantilla del codigo.

Antes de escribir, el servidor vuelve a renderizar con las zonas propuestas y **rechaza con
422** si algo se pisa o se sale del rollo. No escribe nada. La comprobacion es la misma
funcion que la del editor, del mismo modulo, para que el editor no pueda decir "no hay choques"
con una cuenta y el servidor responder 422 con otra.

## La regla de solapes, en un solo sitio

`label-solapes.ts`. La usaban tres copias distintas (el editor, el endpoint que guarda y
`check-zonas`), tres versiones de un predicado que decide si se puede imprimir. Con eso, el
boton de aplicar parecia roto sin forma de saber cual de los dos se equivocaba.

La regla tiene una parte que no es evidente y que salio de un fallo real:

- **El marco perdona la contencion.** El marco es un anillo hueco y TODO lo demas va dentro.
- **Entre contenido, no.** Un texto metido dentro de la caja de las barras esta **encima** de
  las barras. La exencion es del marco y solo del marco, porque las barras estan llenas de
  negro.

Lo segundo es el fallo grave: con la regla general, o el editor se queja del texto bien
puesto dentro del marco (que era exactamente lo que pasaba, y salia siempre y era mentira), o
se calla ante el precio encima del codigo de barras. Lo segundo sale en el papel y el codigo
ya no escanea.

El marco es un anillo, asi que medir "dentro" necesita su grosor, que va en la caja
(`grosorDots`). Con el grosor real de la plantilla, **1 dot**, un texto tumbado encima del
borde se sale por un solo dot y no se ve de ninguna manera. Un texto pegado justo al borde
interior, sin pasarse, es correcto y no se avisa.

## Los dos fallos que se encontraron en v1.6

**El logo se iba de la previsualizacion al redimensionarlo.** Sin error de ningun tipo.
`renderLabel()` sacaba el `^GFA` del ZPL con `zpl.match(/\^GFA,[\s\S]*?\n\^FS/)`. El payload
del logo trae saltos de linea, y ese `\n^FS` de cierre era en realidad el `^FS` del primer
texto que hubiera despues: casaba por casualidad, con el separador que por entonces traia el
logo generado. En cuanto `scaleGraphic()` reescribio el separador, dejo de casar. Un fallo que
nace de un fallo, que no se ve en el papel sino en que una caja no esta, y por eso no salto
ningun test.

Ahora el `^GFA` se dibuja desde la zona, que lleva exactamente lo que `emit()` mete en el ZPL.
Ademas se comprueba que ese texto este en el ZPL construido y se avisa si no, y
`drawGraphic()` devuelve cuantos dots negros ha pintado, para poder comprobarlo sin decodificar
el PNG.

**El marco proponia un solape falso** al anadirlo a las cajas (para que se pudiera arrastrar).
El texto de dentro salia como "pisa a". De ahi salio toda la unificacion de arriba.

## Suites

| Script | Que comprueba | Comprobaciones |
|---|---|---|
| `check-barcode-plan.ts` | `planBarcode()`: simbologia, encaje, digito de control | 32 |
| `check-busqueda.ts` | `resolveQuery()` contra el catalogo real de 3080 productos | 27 |
| `check-queue-status.ts` | mapa de banderas de la cola | 34 |
| `check-zonas.ts` | solapes y salidas de rollo de todas las plantillas | - |
| `check-ascii.ts` | todo el texto del catalogo sale en ASCII imprimible | - |
| `check-resize.ts` | las ocho asas mueven y redimensionan lo que toca | 74 |
| `check-gf.ts` | `^GFA`: medida, reescalado, y que el logo llegue a la pantalla | 45 |
| `check-solapes.ts` | la regla de solapes, incluido el caso que la hizo cambiar | 31 |

Las tres ultimas se escribieron **despues** de los fallos, no antes. Comprueban el efecto y no
el codigo: que el logo reescalado siga teniendo tinta y mida lo que dice su cabecera, que un
texto metido entre las barras se avise, que un `^GFA` de todo ceros salga en blanco y lo diga.
El test del logo se comprobo revirtiendo el arreglo: con el regex viejo falla.

## Sin verificar en fisico

En v1.7 salieron **dos** etiquetas: el producto `475` (`BADIA JALAPENO 2 OZ`, EAN-13
`033844007522`) y el `1` (`AMERICANO`, codigo interno `XPROD20220002`, que sale por la rama
`zonesWithoutBarcode`). Las dos impressions devolvieron HTTP 200 y la cola los recibio, y en
eso se para: **nadie ha mirado el papel.**

Lo que sale de la cola no es lo mismo que lo que llega al papel. Un 200 quiere decir que el
spooler acepto el trabajo, no que las barras escaneen ni que el marco no este cortado.

Pendiente, en este orden:

- [ ] **El rollo de la GK420t esta puesto a 59 mm?** El ajuste de v1.7 esta en **59**, que es
      una **suposicion**, no un dato medido: se puso el valor de la plantilla para que el
      422 no bloqueara. Si el rollo real es de 50 mm, las dos etiquetas que salieron estan
      cortadas por la derecha y todo lo demas hay que rehacerlo. Es lo unico que bloquea el
      resto, y se mide en la impresora, no en el software.
- [ ] La etiqueta sale entera o cortada por la derecha (depende de lo anterior)
- [ ] El radio del marco se dibuja a 16 dots (2 mm)? El manual de ZPL II documenta `r` entre
      0 y 8 dots, que a 203 dpi son 1 mm. Si el firmware lo recorta, sale redondeado a 1 mm,
      que es aceptable
- [ ] El EAN-13 de `475` escanea con el lector
- [ ] La etiqueta de `AMERICANO` sale con el nombre en 4 lineas y sin barras, y el `XPROD20220002`
      sale escrito entero en vez de cortado
- [ ] La `N` de `ANON` sale de la `N`? Se pliega a ASCII antes de imprimir (`^CI28`), asi que
      `ANON` deberia salir `ANON`. Sin ver una etiqueta no se sabe

## Sin resolver

**261 productos (8,5 %) se imprimen sin codigo de barras.** Los codigos internos
necesitan 145-200 modulos y no caben a 3 dots en 472 dots de ancho. A 2 dots caben todos los
825, pero 0,250 mm esta por debajo del minimo de ISO/IEC 15420 y el lector los puede rechazar.

Visto en v1.7 en el aviso que devuelve la propia impresion:

> Esta etiqueta sale SIN codigo de barras: el codigo "XPROD20220002" necesita 178 modulos de
> Code 128 y en una etiqueta de 472 dots caben 137. No cabe sin saltarse la zona quieta de 10X
> que manda la norma.

Es decir: la app no falla, avisa, y sale una etiqueta sin barras. Que sea aceptable es una
decision del negocio, no del codigo.

Que el lector acepte 0,250 mm no se puede decidir leyendo el codigo: hay que escanearlo. Si se
acepta, el ancho de modulo se baja a 2 y los 261 productos regain su codigo de barras, que es
justo lo que un producto de papel no puede perder. Ver [[Prueba Legibilidad Barcode]].

## Ver tambien

- [[Estado del Proyecto]]
- [[Proximos Pasos]]
- [[Catalogo Real y Symbologia]]
- [[Prueba Legibilidad Barcode]]
- [[Convenciones de Codigo]]
