/**
 * Pruebas de `planBarcode` sobre reglas sueltas y sobre el catalogo entero.
 *
 * Esto no sustituye a escanear la etiqueta: comprueba que la decision es la que se ha
 * tomado, no que el papel salga bien. Lo unico que sabe el software es cuantos modulos
 * pide el codigo.
 *
 * Ejecutar:  node .preview-build\scripts\check-barcode-plan.js [catalog.json]
 */
import fs from "node:fs";
import {
  planBarcode,
  maxModules,
  barcodeFormat,
  variantesDeBusqueda,
  MODULE_DOTS,
} from "../src/lib/labels/barcode-plan";
import type { BarcodeImprimible } from "../src/lib/labels/barcode-plan";

const ETIQUETA = { labelWidthDots: 400, moduleWidthDots: MODULE_DOTS };

let pruebas = 0;
let fallos = 0;

function ok(cond: boolean, texto: string, extra = ""): void {
  pruebas++;
  if (cond) {
    console.log(`  ok    ${texto}`);
  } else {
    fallos++;
    console.log(`  FALLO ${texto}${extra ? "  ->  " + extra : ""}`);
  }
}

function imprimible(plan: ReturnType<typeof planBarcode>): BarcodeImprimible | null {
  return plan.printable ? plan : null;
}

console.log("### Geometria");
ok(maxModules(ETIQUETA) === 113, "a 400 dots y 3 de modulo caben 113 modulos con zona 10X",
  `salio ${maxModules(ETIQUETA)}`);
ok(maxModules({ labelWidthDots: 400, moduleWidthDots: 2 }) === 180, "a 2 de modulo caben 180 (no se usa, pero el calculo es el mismo)");
ok(maxModules({ labelWidthDots: 700, moduleWidthDots: 3 }) === 213, "una etiqueta de 87,5 mm caben 213");

console.log("\n### Regla 1: EAN-13 de 13 digitos, se imprime tal cual");
{
  const p = planBarcode("7591031003588", ETIQUETA);
  const i = imprimible(p);
  ok(i?.symbology === "ean13", "es EAN-13", JSON.stringify(p));
  ok(i?.data === "7591031003588", "el dato no cambia", String(i?.data));
  ok(i?.correctedFrom === undefined, "no se marca como corregido");
  ok(i?.modules === 95, "95 modulos fijos");
}

console.log("\n### Regla 2: UPC-A de 12 digitos, se ensancha con un 0");
{
  const p = planBarcode("810078034100", ETIQUETA);
  const i = imprimible(p);
  ok(i?.symbology === "ean13", "sigue siendo EAN-13", JSON.stringify(p));
  ok(i?.data === "0810078034100", "sale con 0 delante", String(i?.data));
  ok(i?.modules === 95, "y sigue ocupando 95 modulos");
  ok(i?.correctedFrom === undefined, "no es una correccion: es la forma correcta de un UPC-A");
}

console.log("\n### Regla 3: digito de control mal, se corrige y se avisa");
{
  const p = planBarcode("0400000570608", ETIQUETA);
  const i = imprimible(p);
  ok(i?.symbology === "ean13", "se imprime como EAN-13", JSON.stringify(p));
  ok(i?.data === "0400000570600", "el ultimo digito pasa a 0", String(i?.data));
  ok(i?.correctedFrom === "0400000570608", "se guarda de donde venia, para poder avisar");
}
{
  const p = planBarcode("740312410281", ETIQUETA);
  const i = imprimible(p);
  ok(i?.data === "0740312410288", "un UPC-A con el control mal tambien se corrige", String(i?.data));
  ok(i?.correctedFrom === "740312410281", "y se avisa igual");
}

console.log("\n### Regla 4: alfanumerico -> Code 128");
{
  // Este caso es real: 13 caracteres, como un EAN-13, pero con letras. Entra por
  // aqui porque el primer bug de esta funcion lo tomaba por un EAN-13 con el digito de
  // control roto y fabricaba "XPROD2022000NaN". Si esta prueba falla, se imprimen 181
  // etiquetas con basura.
  const p = planBarcode("XPROD20220002", ETIQUETA);
  ok(!p.printable && p.reason === "no-cabe",
    "13 CARACTERES con letras no es un EAN-13 aunque tenga 13 de largo", JSON.stringify(p));
  ok(!p.printable && p.reason === "no-cabe" && p.modulesNeeded === 178,
    "y se dice cuantos modulos haria falta", JSON.stringify(p));
}
{
  const p = planBarcode("0000180", ETIQUETA);
  const i = imprimible(p);
  ok(i?.symbology === "code128", "un codigo de 7 digitos es Code 128", JSON.stringify(p));
  ok((i?.modules ?? 0) <= 113, "y cabe en 113 modulos", String(i?.modules));
  ok(barcodeFormat(i!, 72).includes("^BCN,72"), "el comando ZPL es ^BC", barcodeFormat(i!, 72));
}
{
  const p = planBarcode("XPROD20220002", ETIQUETA);
  ok(!p.printable && p.reason === "no-cabe", "un XPROD de 13 caracteres NO cabe a 3 de modulo", JSON.stringify(p));
  ok(!p.printable && p.reason === "no-cabe" && p.modulesNeeded === 178,
    "y se dice cuantos modulos haria falta", JSON.stringify(p));
}
{
  // El mismo codigo, en una etiqueta mas ancha, si cabe. Comprueba que el motivo es el
  // ancho y no el codigo.
  const p = planBarcode("XPROD20220002", { labelWidthDots: 700, moduleWidthDots: 3 });
  ok(p.printable && p.symbology === "code128", "el mismo codigo cabe en una etiqueta de 87,5 mm", JSON.stringify(p));
}

console.log("\n### Regla 5: los que no se pueden imprimir, y POR QUE");
{
  const p = planBarcode("0", ETIQUETA);
  ok(!p.printable && p.reason === "cero", "el codigo 0 no es un codigo", JSON.stringify(p));
  ok(!p.printable && p.detail.includes("sistema de origen"), "y el motivo apunta al origen, no a la app");
}
{
  const p = planBarcode("null", ETIQUETA);
  ok(!p.printable && p.reason === "texto", 'el texto "null" tampoco', JSON.stringify(p));
}
{
  const p = planBarcode("", ETIQUETA);
  ok(!p.printable && p.reason === "vacio", "un codigo vacio tampoco", JSON.stringify(p));
}
{
  const p = planBarcode("759-103-1003588", ETIQUETA);
  const i = imprimible(p);
  ok(i?.data === "7591031003588", "los guiones del tecleo se quitan antes de decidir", JSON.stringify(p));
}

console.log("\n### La busqueda: el 0 delante del UPC-A");
{
  const v = variantesDeBusqueda("0810078034100");
  ok(v.length === 2 && v[0] === "0810078034100" && v[1] === "810078034100",
    "leido con 0 delante, se prueba tambien sin el", JSON.stringify(v));
  const w = variantesDeBusqueda("810078034100");
  ok(w.length === 1, "leido con 12 digitos no se inventa ninguna variante", JSON.stringify(w));
  const u = variantesDeBusqueda("009300002509");
  ok(u[0] === "009300002509", "un EAN-13 que empieza por 0 se prueba primero entero", JSON.stringify(u));
}

console.log(`\n### ${pruebas - fallos}/${pruebas} pruebas ok`);

// ---------------------------------------------------------------------------------------
// Y ahora el catalogo entero
// ---------------------------------------------------------------------------------------
const CATALOGO = process.argv[2] ?? "data/catalog.json";
if (!fs.existsSync(CATALOGO)) {
  console.log(`\n(${CATALOGO} no existe: se salta la parte del catalogo completo)`);
} else {
  const productos = JSON.parse(fs.readFileSync(CATALOGO, "utf8").replace(/^\uFEFF/, "")) as Array<{
    code: string; name: string; barcode: string; reference: string; price: number;
  }>;

  const reparto = {
    ean13: 0, code128: 0,
    corregidos: [] as string[],
    sinCero: 0, sinTexto: 0, sinVacio: 0, noCabe: 0, ilegible: 0,
  };
  const sinCodigoPorFamilia = new Map<string, number>();
  const codigoRepetido = new Map<string, string[]>();

  for (const p of productos) {
    (codigoRepetido.get(p.barcode) ?? codigoRepetido.set(p.barcode, []).get(p.barcode)!).push(p.code);
    const plan = planBarcode(p.barcode, ETIQUETA);
    if (plan.printable) {
      if (plan.symbology === "ean13") reparto.ean13++;
      else reparto.code128++;
      if (plan.correctedFrom) reparto.corregidos.push(`${p.code} ${p.barcode} -> ${plan.data}`);
    } else {
      if (plan.reason === "cero") reparto.sinCero++;
      else if (plan.reason === "texto") reparto.sinTexto++;
      else if (plan.reason === "vacio") reparto.sinVacio++;
      else if (plan.reason === "no-cabe") reparto.noCabe++;
      else reparto.ilegible++;
      if (plan.reason === "no-cabe" || plan.reason === "cero" || plan.reason === "texto") {
        const f = p.reference;
        sinCodigoPorFamilia.set(f, (sinCodigoPorFamilia.get(f) ?? 0) + 1);
      }
    }
  }

  const total = productos.length;
  const conCodigo = reparto.ean13 + reparto.code128;
  const sinCodigo = total - conCodigo;

  console.log(`\n### Los ${total} productos del catalogo, con la regla definitiva\n`);
  console.log(`  con ^BE (EAN-13, UPC-A con 0 delante, o control corregido): ${reparto.ean13}`);
  console.log(`  con ^BC (Code 128):                                        ${reparto.code128}`);
  console.log(`  SIN codigo de barras:                                      ${sinCodigo}  (${((sinCodigo / total) * 100).toFixed(1)}%)`);
  console.log(`      de los que no caben a 3 de modulo:   ${reparto.noCabe}`);
  console.log(`      de los que no traen codigo ("0"/"null"): ${reparto.sinCero + reparto.sinTexto + reparto.sinVacio}`);
  console.log(`      con caracteres no codificables:      ${reparto.ilegible}`);

  console.log(`\n  digito de control corregido al imprimir: ${reparto.corregidos.length}`);
  reparto.corregidos.forEach((c) => console.log(`      ${c}`));

  // RETAIL y LICORES se escanean en caja. El resto (COFFEE, POSTRES, JUGOS...) son de
  // mostrador y se venden por nombre, asi que quedarse sin codigo no las rompe.
  const esDeMostrador = (f: string) => f !== "RETAIL" && f !== "LICORES";
  const deMostrador = [...sinCodigoPorFamilia.entries()]
    .filter(([f]) => esDeMostrador(f))
    .reduce((s, [, n]) => s + n, 0);
  const deCaja = sinCodigo - deMostrador;
  console.log(`\n  de los ${sinCodigo} sin codigo:`);
  console.log(`      ${deCaja} de RETAIL/LICORES, que SI se escanean en caja`);
  console.log(`      ${deMostrador} de mostrador, que se venden por nombre`);
  console.log("  reparto por familia:");
  [...sinCodigoPorFamilia.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => {
    const marca = esDeMostrador(f) ? "" : "   <-- se escanea en caja";
    console.log(`      ${String(n).padStart(4)}  ${f}${marca}`);
  });

  const dup = [...codigoRepetido.entries()].filter(([b, cs]) => cs.length > 1 && b !== "0");
  console.log(`\n  codigos de barra que apuntan a mas de un producto: ${dup.length}`);
  dup.forEach(([b, cs]) => console.log(`      "${b}" -> ${cs.join(", ")}`));

  // El codigo de un producto tiene que ser unico: es lo que se manda a la API para imprimir.
  const codeVistos = new Map<string, number>();
  let codesRepetidos = 0;
  for (const p of productos) {
    codeVistos.set(p.code, (codeVistos.get(p.code) ?? 0) + 1);
  }
  codesRepetidos = [...codeVistos.values()].filter((n) => n > 1).length;
  ok(codesRepetidos === 0, "todos los codigos de producto son unicos", `${codesRepetidos} repetidos`);
}

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
