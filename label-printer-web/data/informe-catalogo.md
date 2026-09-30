# Informe de importacion del catalogo

Generado por `scripts/importar-catalogo.ts` desde `.tmp-catalogo.csv`.

Este archivo lo genera el importador. **No se edita a mano.**

Los problemas de abajo NO se han arreglado: se anotan para que se arreglen en
el sistema de origen, no aqui.

- Productos importados: **3080**
- Familias: **23**
- Descartados por no validar el esquema: **0**

## Codigo de barra repetido en dos productos distintos

Un codigo de barra identifica UN producto. Con dos, escanear es ambiguo y la
app no puede saber cual se quiere. Esto es un error del sistema de origen.

- `7509546074627` aparece 2 veces:
  - 2042 — $2.55 — PALMOLIVE JABON HIDRATACION RADIANTE
  - 2048 — $3.6 — PALMOLIVE SENSACION HUMECTANTE

## Productos sin codigo de barras imprimible

En el export estos productos traen `0` o el texto `null` en la columna de codigo.
La etiqueta sale con nombre y precio, sin codigo.

- 138 — `0` — TARTINE CHAMPIÑONES
- 139 — `0` — TARTINE PESTO Y BUFALA
- 140 — `0` — TARTINE TOMATE Y BURRATA
- 144 — `0` — POULET AU PARMESAN
- 890 — `null` — COLLAGEN + BIOTIN 390 TABLETS 6000MG

## Digito de control que no cuadra

Un EAN-13 con el digito de control mal se imprime impecable y no lo lee absolutely
nadie. La app **corrige el ultimo digito al imprimir** y avisa, pero el codigo de
verdad es el que tiene el digito correcto: hay que arreglarlo en el sistema de origen.

- 735 — `740312410281` — debería acabar en **8 (con 0 delante: 0740312410281)** — CEREAL FRUIT RINGS
- 1067 — `0400000570608` — debería acabar en **0** — DOVE TRUFFLES ASSORTED 573G
- 1322 — `074570820110` — debería acabar en **5 (con 0 delante: 0074570820110)** — HAAGEN DAAZS PALETA
- 1378 — `759138100688` — debería acabar en **6 (con 0 delante: 0759138100688)** — HELADO SABOR A FRESA 480 CM3
- 1694 — `6971824952502` — debería acabar en **6** — MANGA AZUL 12 PULGADAS
- 1843 — `240509130452` — debería acabar en **1 (con 0 delante: 0240509130452)** — MINI UPS MASPOWER MP-01

## Productos a 0,00

No parece venta: la etiqueta saldria con un precio de cero. Conviene revisarlos.

- 295  ADAPTADOR NEGRO PARA CARGADOR  ($0.00)
- 342  ALMENDRAS CRUDAS CON PIEL 10 KILOS  ($0.00)
- 345  ALMENDRAS DE COLORES 10 KG  ($0.00)
- 375  ANTI ESTRESANTE POP POP  ($0.00)
- 423  AUDIFONOS BLANCO CON CABLE  ($0.00)
- 585  BRIE PRESI SOFT RIPENED CHEESE 555 GR  ($0.00)
- 1630  LLUVIA DE MANI 10 KG  ($0.00)
- 2010  ORBIT SWEET MINT GUM 14 PIECES  ($0.00)
- 2177  PIEZA QUESO MOZZARELLA SEM DON ARMANDO  ($0.00)
- 2217  POPSOCKET LARGO CON DISEÑO  ($0.00)
- 2691  WELCHIS MIXED FRUIT SNACKS  ($0.00)

## Nombres largos

El nombre mas largo del catalogo es de 50 caracteres.
El ancho del nombre en la etiqueta es un punto pendiente de la fase Carro.

-  50 — CHOCOLATE REPOSTERIA EXTRA BITTER ST MORITZ 250 GR
-  48 — MERMELADA DE PIÑA LOS SECRETOS DE LA ABUELA 250G
-  46 — BOMBONES DE CHOCOLATE SURTIDOS ST MORITZ 120 G
-  46 — GOTAS CON COBERTURA DE CHOCOLATE BLANCO 200 GR
-  46 — MERMELADA DE FRESA SECRETOS DE LA ABUELA 250 G
-  45 — ACEITE DE COCO ORGANICO VIRGEN KALDINI 500 ML
-  45 — TODO USO CHOCOLATE CON LECHE ST MORITZ 100 GR
-  44 — ARM & HAMMER BAKING SODA BICARBONATO 6.12 KG
-  44 — BOMBONES RELLENOS DE AVELLANA Y CACAO 120 GR
-  44 — GOTAS KRON COBERTURA CHOCOLATE OSCURO 500 GR
-  43 — AVELLANAS CUBIERTAS CON CHOCOLATE (TORONTO)
-  42 — CHOCOLATE BITTER RELLENO DE AVELLANA 28 GR
-  41 — COBERTURA CHOCOLATE CON LECHE KRON 500 GR
-  41 — TODO USO CHOCOLATE BITTER ST MORITZ 100 G
-  40 — ACEITE DE OLIVA EN SPRAY WELLSLEY 207 ML
