// Que symbologia lleva cada codigo del catalogo, y si cabe en la etiqueta.
//
// Vive aqui y no en la API ni en un script porque hay tres sitios que necesitan la misma
// respuesta y los tres tienen que dar la misma: la API antes de gastar papel, el
// constructor de ZPL, y el informe del importador. Si cada uno decide por su cuenta,
// un dia uno dice "imprimible" y otro dice que no, y el que gana es el que nadie ha
// revisado.
//
// La decision se tomo con el catalogo real de PA PICAR (3080 productos, 23 familias) y no
// con los 12 productos inventados, porque con 12 todo era EAN-13 y la pregunta no existia.
//
// ---------------------------------------------------------------------------------------
// Las reglas, y por que cada una
// ---------------------------------------------------------------------------------------
//
// 1. EAN-13 de 13 digitos, digito de control correcto -> `^BE` tal cual.
//    Es el caso bueno: 95 modulos fijos, el ancho no depende del dato.
//
// 2. UPC-A de 12 digitos -> `^BE` con un 0 delante.
//    Un UPC-A ES un EAN-13 con un 0 delante, no una convencion: por eso sigue siendo un
//    simbolo valido de 95 modulos y entra en la etiqueta sin tocar el ancho. Son 1068
//    productos, el 35% del catalogo, y sin esto no se podian imprimir.
//    El detalle, y es el motivo de que la busqueda tenga que normalizar: el escaner
//    devolvera 13 digitos, no 12. Ver `variantesDeBusqueda`.
//
// 3. EAN-13 o UPC-A con el digito de control mal -> se CORRIGE el ultimo digito y se avisa.
//    Un EAN-13 con el digito mal se imprime impecable, con buen contraste y con la altura
//    correcta, y no hay lector en el mundo que lo decodifique. Es el peor fallo posible
//    porque no se ve. Corregirlo produce un codigo que si lee; avisar produce una etiqueta
//    que no sirve. Son 6 productos y el error esta en el sistema de origen, asi que el
//    aviso dice cual es el codigo bueno para arreglarlo alla.
//    NO se corrige al guardar el catalogo: ahi el barcode se guarda tal cual, para que
//    `catalog.json` siga siendo una copia fiel y el error se pueda ver y arreglar.
//
// 4. Alfanumerico (XPROD20220002, XPBOD2608000012, 0000180...) -> Code 128 `^BC`.
//    EAN-13 solo admite digitos, asi que no hay alternativa.
//
// 5. El que no cabe -> etiqueta SIN codigo de barras.
//    Se comprueba aqui, antes de gastar papel, porque un simbolo que se sale del papel
//    produce una etiqueta que sale bien y que no lee nadie.
//
// ---------------------------------------------------------------------------------------
// Lo que NO se hace, y por que
// ---------------------------------------------------------------------------------------
//
// No se baja el ancho de modulo a 2 dots (0,250 mm) para que quepan mas codigos. Esta un
// 5% por debajo del minimo de ISO/IEC 15420 (0,264 mm) y el sangrado termico de un cabeza
// a 203 dpi cierra las barras estrechas. Se rechazo a proposito: son 266 productos, de los
// que solo 30 se escanean en caja. Pagar 30 productos por no saltarse la norma no sale.
//
// No se usa `^BY2` "solo cuando haga falta" para los que no caben a 3 dots. Seria la misma
// cosa que lo anterior con otro nombre.

import { EAN13_MODULES, ean13CheckDigit, isValidEan13 } from "./ean13";
import { encodeCode128Auto } from "./code128";

/** Factor de zona quieta que pide Code 128 y EAN-13: 10 veces el ancho de modulo. */
export const QUIET_FACTOR = 10;

/** Ancho de modulo en dots. 3 dots = 0,375 mm, por encima del minimo de la norma. */
export const MODULE_DOTS = 3;

export type BarcodeNoImprimible = {
  printable: false;
  reason: "vacio" | "cero" | "texto" | "ilegible" | "no-cabe";
  /** Explicacion para el operador, en una frase. */
  detail: string;
  /** Cuando es `no-cabe`: cuantos modulos haria falta. */
  modulesNeeded?: number;
};

export type BarcodeImprimible = {
  printable: true;
  symbology: "ean13" | "code128";
  /** Lo que va en `^FD`. Para un UPC-A son 13 digitos, no los 12 que hay en el catalogo. */
  data: string;
  modules: number;
  moduleWidth: number;
  /** Solo si hubo que corregir el digito de control: el codigo tal como vino. */
  correctedFrom?: string;
};

export type BarcodePlan = BarcodeImprimible | BarcodeNoImprimible;

export interface BarcodePlanOptions {
  /** Ancho de la etiqueta en dots. 50 mm a 8 dots/mm = 400. */
  labelWidthDots: number;
  moduleWidthDots?: number;
  quietFactor?: number;
}

/**
 * Modulos maximos que caben con zona quieta a ambos lados.
 *
 * La zona quieta no es un numero fijo: crece con el ancho de modulo. Por eso el calculo
 * es `ancho = 2 * factor * X + modulos * X`, y despejando, `modulos <= ancho/X - 2*factor`.
 */
export function maxModules(options: BarcodePlanOptions): number {
  const x = options.moduleWidthDots ?? MODULE_DOTS;
  const q = options.quietFactor ?? QUIET_FACTOR;
  return Math.floor(options.labelWidthDots / x) - 2 * q;
}

/**
 * Decide que symbologia lleva un codigo del catalogo.
 *
 * Es una funcion pura: mismo codigo, mismo ancho de etiqueta, mismo resultado. No lee
 * archivos, no depende de la hora y no lanza excepciones. Todo caso raro devuelve un
 * `reason`, nunca revienta, porque esta en el camino de una impresion.
 */
export function planBarcode(raw: string, options: BarcodePlanOptions): BarcodePlan {
  const x = options.moduleWidthDots ?? MODULE_DOTS;
  const tope = maxModules(options);
  const compacto = raw.replace(/[\s-]/g, "");

  if (compacto === "") {
    return { printable: false, reason: "vacio", detail: "el producto no tiene codigo de barras" };
  }
  if (/^0+$/.test(compacto)) {
    return {
      printable: false,
      reason: "cero",
      detail: `el codigo "${raw}" es solo ceros: en el sistema de origen no tiene codigo asignado`,
    };
  }
  if (/^null$/i.test(compacto)) {
    return {
      printable: false,
      reason: "texto",
      detail: `el codigo "${raw}" es el texto "null": el sistema de origen lo guardo vacio`,
    };
  }

  // 1 y 2: EAN-13 de 13 DIGITOS, o UPC-A de 12 que se ensancha con un 0.
  //
  // El guardia tiene que ser de digitos y no de longitud. `XPROD20220002` tiene 13
  // caracteres: si se preguntara solo por la longitud, entraria aqui, `isValidEan13`
  // devolveria false, y la rama de "corregir el digito" fabricaria `XPROD2022000NaN`.
  // Asi se ha impreso basura en 181 productos: lo encontro la prueba de este mismo
  // fichero, no una etiqueta.
  const ean = /^\d{13}$/.test(compacto)
    ? compacto
    : /^\d{12}$/.test(compacto)
      ? "0" + compacto
      : null;
  if (ean !== null) {
    if (isValidEan13(ean)) {
      return { printable: true, symbology: "ean13", data: ean, modules: EAN13_MODULES, moduleWidth: x };
    }
    const bueno = ean.slice(0, 12) + String(ean13CheckDigit(ean.slice(0, 12)));
    return {
      printable: true,
      symbology: "ean13",
      data: bueno,
      modules: EAN13_MODULES,
      moduleWidth: x,
      correctedFrom: compacto,
    };
  }

  // 4: alfanumerico -> Code 128.
  if (!/^[\x20-\x7e]+$/.test(compacto)) {
    return {
      printable: false,
      reason: "ilegible",
      detail: `el codigo "${raw}" tiene caracteres que Code 128 no puede codificar`,
    };
  }

  const { encoded } = encodeCode128Auto(compacto);
  if (encoded.modules > tope) {
    return {
      printable: false,
      reason: "no-cabe",
      detail:
        `el codigo "${raw}" necesita ${encoded.modules} modulos de Code 128 y en una ` +
        `etiqueta de ${options.labelWidthDots} dots caben ${tope}. No cabe sin saltarse la ` +
        `zona quieta de ${options.quietFactor ?? QUIET_FACTOR}X que manda la norma.`,
      modulesNeeded: encoded.modules,
    };
  }

  return { printable: true, symbology: "code128", data: compacto, modules: encoded.modules, moduleWidth: x };
}

/**
 * El comando ZPL del simbolo.
 *
 * El 4o parametro de `^BE` y de `^BC` es la linea de interpretacion; el 5o de `^BC` es el
 * digito de control UCC, que se pone a `N` porque el dato ya viene con su digito puesto: si
 * la impresora lo anade otra vez, salen dos y el codigo no lee.
 */
export function barcodeFormat(plan: BarcodeImprimible, heightDots: number, interpretation = true): string {
  const linea = interpretation ? "Y" : "N";
  if (plan.symbology === "ean13") {
    return `^BY${plan.moduleWidth}\n^BEN,${heightDots},${linea},N`;
  }
  return `^BY${plan.moduleWidth}\n^BCN,${heightDots},${linea},N,N`;
}

/**
 * Las formas en que un codigo puede venir de un escaner y buscar el mismo producto.
 *
 * Existe por el 0 delante del UPC-A. Si la etiqueta lleva `0810078034100` y el catalogo
 * guarda `810078034100`, buscar solo por el texto exacto daria "no esta en el catalogo" para
 * un producto que si esta. Por eso, cuando no hay coincidencia entera, se prueba la otra
 * forma.
 *
 * Se devuelve una lista y no un unico valor porque el orden importa: la coincidencia EXTATA
 * manda siempre, y la variante con el 0 quitado es el ultimo recurso. Un producto cuyo
 * barcode real empieza por 0 (y hay 75) no debe perder nunca frente a un UPC-A.
 */
export function variantesDeBusqueda(leido: string): string[] {
  const compacto = leido.replace(/[\s-]/g, "");
  const variantes = [compacto];
  if (/^0\d{12}$/.test(compacto)) {
    variantes.push(compacto.slice(1));
  }
  return variantes;
}
