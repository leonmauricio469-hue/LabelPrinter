/**
 * Analisis: cuanto codigo de barras cabe en una COLUMNA IZQUIERDA, en vez de en toda la etiqueta.
 *
 * MOTIVO
 *
 * El layout pedido pone las barras en la mitad izquierda (45-50 % del ancho) y el precio a la
 * derecha. Hoy `planForZone()` mide el codigo contra `template.widthDots`, o sea la ETIQUETA
 * ENTERA, porque las barras iban centradas y ocupaban todo el ancho. Al meterlas en una
 * columna, el techo de modulos que cabe baja, y bajan los productos que se imprimen con barras.
 *
 * Aqui se mide ese bajon con el codigo real (`planBarcode()`, la misma decision que toma la
 * impresion), no con una regla de dedo. `labelWidthDots` es aqui el ancho de la COLUMNA, con
 * las dos zonas quietas dentro, que es lo que ocupa el simbolo de verdad.
 *
 * `X` es el ancho de modulo en dots, y es la decision que manda: a 2 dots caben el doble de
 * modulos, pero cada barra es de 0,250 mm, por debajo del minimo de 0,264 mm de ISO/IEC 15420.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { planBarcode, QUIET_FACTOR } from "../src/lib/labels/barcode-plan";

interface Producto {
  code: string;
  name: string;
  price: number;
  reference: string;
  barcode: string;
}

interface Recuento {
  total: number;
  conCodigo: number;
  ean13: number;
  code128: number;
  sinCodigo: number;
  internos: number;
  internosSinBarras: number;
}

async function main(): Promise<void> {
  const ruta = path.resolve(process.cwd(), "data", "catalog.json");
  const productos = JSON.parse(await fs.readFile(ruta, "utf8")) as Producto[];

  console.log(`Catalogo: ${productos.length} productos, zona quieta ${QUIET_FACTOR}X a cada lado\n`);

  // La etiqueta actual, para tener la referencia de contra que comparar.
  console.log("COMO ESTA HOY (etiqueta entera de 472 dots, barras centradas)");
  console.log("  X  ancho   modulos   EAN-13   Code 128   SIN BARRAS");
  for (const x of [2, 3]) {
    const r = cuenta(productos, 472, x);
    console.log(
      `  ${x}   472    ${String(modulos(472, x)).padStart(3)}      ` +
        `${String(r.ean13).padStart(4)}      ${String(r.code128).padStart(6)}    ` +
        `${String(r.sinCodigo).padStart(6)}   (${pct(r.sinCodigo, r.total)})`,
    );
  }

  console.log("\nCON BARRAS EN COLUMNA IZQUIERDA (el ancho de la columna incluye las zonas quietas)");
  console.log("  X  columna   modulos   EAN-13   Code 128   SIN BARRAS");
  for (const x of [2, 3]) {
    for (const col of [230, 250, 280, 300, 320, 340, 360, 400]) {
      const r = cuenta(productos, col, x);
      const marca = x === 2 ? "" : "";
      console.log(
        `  ${x}   ${String(col).padStart(4)}    ${String(modulos(col, x)).padStart(3)}      ` +
          `${String(r.ean13).padStart(4)}      ${String(r.code128).padStart(6)}    ` +
          `${String(r.sinCodigo).padStart(6)}   (${pct(r.sinCodigo, r.total)})` +
          `${marca}`,
      );
    }
    console.log("");
  }

  // El codigo del producto de prueba, que es el que hay que sacar.
  const prueba = "7591720033377";
  console.log(`PRODUCTO DE PRUEBA  ${prueba}  (EAN-13 valido, 95 modulos fijos)`);
  for (const x of [2, 3]) {
    const ancho = 95 * x;
    const plan = planBarcode(prueba, {
      labelWidthDots: 472,
      moduleWidthDots: x,
      quietFactor: QUIET_FACTOR,
    });
    console.log(
      `  X=${x}  simbolo ${String(ancho).padStart(3)} dots = ${pct(ancho, 472).padStart(5)} del ancho` +
        `  + ${QUIET_FACTOR * x * 2} de zonas quietas = ${ancho + QUIET_FACTOR * x * 2} dots` +
        `   ${plan.printable ? "imprimible" : "NO IMPRIMIBLE"}`,
    );
  }
  console.log(
    "  El ancho pedido era 220-250 dots. Con 95 modulos, eso da 2,32 a 2,63 dots de modulo:",
  );
  console.log("  el ancho de modulo de ZPL es entero, asi que 220-250 NO es alcanzable con EAN-13.");
}

/** Modulos que caben en un ancho dado, con las dos zonas quietas dentro. */
function modulos(ancho: number, x: number): number {
  return Math.floor(ancho / x) - 2 * QUIET_FACTOR;
}

function cuenta(productos: Producto[], anchoColumna: number, x: number): Recuento {
  const r: Recuento = {
    total: productos.length,
    conCodigo: 0,
    ean13: 0,
    code128: 0,
    sinCodigo: 0,
    internos: 0,
    internosSinBarras: 0,
  };
  for (const p of productos) {
    const plan = planBarcode(p.barcode, {
      labelWidthDots: anchoColumna,
      moduleWidthDots: x,
      quietFactor: QUIET_FACTOR,
    });
    if (!plan.printable) {
      r.sinCodigo++;
      if (p.barcode && !/^\d{12,13}$/.test(p.barcode)) r.internosSinBarras++;
      continue;
    }
    r.conCodigo++;
    if (plan.symbology === "ean13") r.ean13++;
    else {
      r.code128++;
      if (p.barcode && !/^\d{12,13}$/.test(p.barcode)) r.internos++;
    }
  }
  return r;
}

function pct(parte: number, total: number): string {
  return `${((parte / total) * 100).toFixed(1)} %`;
}

void main();