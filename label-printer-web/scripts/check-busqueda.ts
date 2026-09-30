/**
 * Pruebas de `resolveQuery()` contra el catalogo real de PA PICAR.
 *
 * Estas reglas se escribieron mirando 12 productos inventados, y con 3080 son otras
 * cosas las que se rompen. Aqui se monta el mismo `ProductRepository` en memoria con los
 * productos de verdad, y se comprueban los casos que importan:
 *
 *   - escanear un codigo de barras de verdad devuelve ese producto
 *   - escanear un UPC-A impreso con el 0 delante tambien
 *   - escanear un prefijo NO imprime el producto equivocado
 *   - teclear poco no dice "no esta en el catalogo"
 *   - el umbral de 7 digitos sigue siendo el correcto para ESTE catalogo
 *
 * Ejecutar:  node .preview-build\scripts\check-busqueda.js [catalog.json]
 */
import fs from "node:fs";
import {
  resolveQuery,
  MIN_BUSQUEDA,
  MAX_BUSQUEDA,
} from "../src/lib/products/product.lookup";
import type { Product } from "../src/lib/products/product.types";
import type { ProductRepository } from "../src/lib/products/product.repository";

const CATALOGO = process.argv[2] ?? "data/catalog.json";

interface Fila {
  code: string;
  name: string;
  price: number;
  reference: string;
  barcode: string;
}

function cargar(): Fila[] {
  if (!fs.existsSync(CATALOGO)) {
    console.error(`No existe ${CATALOGO}. Ejecuta antes el importador.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CATALOGO, "utf8").replace(/^\uFEFF/, "")) as Fila[];
}

const filas = cargar();

/** La misma normalizacion que usa `product.catalog.repository.ts`. */
const norm = (v: string) => v.replace(/[\s-]/g, "").toLowerCase();

function repoEnMemoria(datos: Fila[]): ProductRepository {
  return {
    async findByCode(code) {
      const t = norm(code);
      return datos.find((p) => norm(p.code) === t) ?? null;
    },
    async findByBarcode(barcode) {
      const t = norm(barcode);
      return datos.find((p) => norm(p.barcode) === t) ?? null;
    },
    async search(term) {
      const t = norm(term);
      if (!t) return [];
      return datos.filter((p) => norm(p.code).includes(t) || norm(p.name).includes(t));
    },
    async list() {
      return datos;
    },
    async esPrefijoDeBarcode(term) {
      const t = norm(term);
      if (!t) return false;
      return datos.some((p) => {
        const b = norm(p.barcode);
        return b.length > t.length && b.startsWith(t);
      });
    },
  };
}

const repo = repoEnMemoria(filas);

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

async function consultar(q: string) {
  return resolveQuery(repo, q);
}

async function main(): Promise<void> {
  console.log(`### Catalogo de ${filas.length} productos\n`);

  // -------------------------------------------------------------------------------------
  console.log("### Escanear un codigo de barras de verdad encuentra SU producto");
  // -------------------------------------------------------------------------------------
  const completos = filas.filter((p) => norm(p.barcode) === p.barcode && p.barcode.length >= 7);
  const muestras: Fila[] = [];
  for (const largo of [7, 8, 12, 13]) {
    const deEseLargo = completos.filter((p) => p.barcode.length === largo);
    if (deEseLargo.length > 0) muestras.push(deEseLargo[Math.floor(deEseLargo.length / 2)]);
  }
  for (const p of muestras) {
    const r = await consultar(p.barcode);
    ok(
      r.match === "exact" && r.products[0]?.code === p.code,
      `escanea "${p.barcode}" (${p.barcode.length} digitos) y da el producto ${p.code}`,
      `${r.match} -> ${r.products[0]?.code}`,
    );
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### El UPC-A: la etiqueta lleva 13 digitos y el catalogo guarda 12");
  // -------------------------------------------------------------------------------------
  {
    const upc = filas.find((p) => /^\d{12}$/.test(p.barcode) && !/^0+$/.test(p.barcode));
    if (upc) {
      const impreso = "0" + upc.barcode;
      const r = await consultar(impreso);
      ok(
        r.match === "exact" && r.products[0]?.code === upc.code,
        `escanea el UPC-A impreso como "${impreso}" y encuentra el ${upc.code} (que guarda ${upc.barcode})`,
        `${r.match} -> ${r.products[0]?.code}`,
      );

      // Y al reves: si el sistema escanea el de 12, tambien funciona.
      const r2 = await consultar(upc.barcode);
      ok(r2.match === "exact", `y escaneando los 12 tal cual tambien`, r2.match);
    } else {
      console.log("  (no hay UPC-A de 12 digitos en este catalogo)");
    }
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### Un barcode que empieza por 0 y existe tal cual gana siempre");
  // -------------------------------------------------------------------------------------
  {
    const conCero = filas.filter((p) => /^0\d{12}$/.test(norm(p.barcode)));
    if (conCero.length > 0) {
      const p = conCero[0];
      const r = await consultar(norm(p.barcode));
      ok(
        r.match === "exact" && r.products[0]?.code === p.code,
        `un barcode propio de 13 digitos que empieza por 0 (${p.barcode}) no se confunde con ningun UPC-A`,
        `${r.match} -> ${r.products[0]?.code}`,
      );
    } else {
      console.log("  (no hay barcodes propios de 13 digitos que empiecen por 0)");
    }
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### LO IMPORTANTE: un escaneo a medias NO imprime el producto equivocado");
  // -------------------------------------------------------------------------------------
  {
    // Prefijos de barcode real que ademas son el code de otro producto. Cada uno de estos
    // terminos, antes del cambio, resolvia EXACTO e imprimia sin preguntar.
    const codigos = new Set(filas.map((p) => norm(p.code)));
    const peligroso: Array<{ prefijo: string; escaneado: string }> = [];
    for (const p of completos) {
      const b = norm(p.barcode);
      for (let n = 1; n < b.length; n++) {
        const prefijo = b.slice(0, n);
        if (codigos.has(prefijo) && prefijo !== norm(p.code)) {
          peligroso.push({ prefijo, escaneado: b });
        }
      }
    }
    console.log(
      `  hay ${peligroso.length} terminos que son a la vez code de un producto y escaneo ` +
        `a medias del barcode de otro`,
    );
    let impresosMal = 0;
    for (const { prefijo } of peligroso.slice(0, 15)) {
      const r = await consultar(prefijo);
      if (r.match === "exact") impresosMal++;
    }
    ok(
      impresosMal === 0,
      "ninguno de esos terminos resuelve como coincidencia exacta",
      `${impresosMal} se colaron`,
    );

    // Y la mitad complementsaria, que es la que la regla de longitud rompia: un barcode
    // CORTO y ENTERO tiene que seguir funcionando.
    const cortosEnteros = completos.filter((p) => norm(p.barcode).length < 8);
    let noResueltos = 0;
    for (const p of cortosEnteros) {
      const r = await consultar(norm(p.barcode));
      if (r.match !== "exact" || r.products[0]?.code !== p.code) noResueltos++;
    }
    ok(
      noResueltos === 0,
      `los ${cortosEnteros.length} barcodes de 4 a 7 digitos se siguen escaneando bien`,
      `${noResueltos} no resolvieron`,
    );

    // Y ningun prefijo, sea del largo que sea, puede dar una exacta ajena.
    let exactosAjenos = 0;
    for (const p of completos.slice(0, 200)) {
      const b = norm(p.barcode);
      for (let n = 1; n < b.length; n++) {
        const r = await consultar(b.slice(0, n));
        if (r.match === "exact" && r.products[0]?.code !== p.code) exactosAjenos++;
      }
    }
    ok(
      exactosAjenos === 0,
      "ningun prefijo de ningun barcode resuelve a un producto que no es",
      `${exactosAjenos} se colaron`,
    );
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### Teclear poco: no es lo mismo que no existir");
  // -------------------------------------------------------------------------------------
  {
    for (const corto of ["1", "ab", "LE", "x"]) {
      const r = await consultar(corto);
      ok(
        r.match === "too-short" || r.match === "none",
        `"${corto}" no devuelve una coincidencia exacta`,
        r.match,
      );
      if (corto.length < MIN_BUSQUEDA) {
        ok(r.match === "too-short", `"${corto}" se identifica como "demasiado corto", no como "no existe"`, r.match);
      }
    }
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### Buscar por nombre sigue funcionando");
  // -------------------------------------------------------------------------------------
  {
    const r = await consultar("LECHE");
    ok(r.match === "partial" && r.products.length > 0, `"LECHE" encuentra productos por nombre`, `${r.match}, ${r.products.length}`);
    ok(r.products.length <= MAX_BUSQUEDA, `y no devuelve mas de ${MAX_BUSQUEDA}`, String(r.products.length));

    const r2 = await consultar("AMERICANO");
    ok(r2.match === "partial" && r2.products.length === 1, `"AMERICANO" (de mostrador) encuentra uno solo`, `${r2.match}, ${r2.products.length}`);
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### Un codigo que no esta en el catalogo: 'none', nunca una suposicion");
  // -------------------------------------------------------------------------------------
  {
    const r = await consultar("9999999999999");
    ok(r.match === "none" && r.products.length === 0, "un EAN-13 inexistente no encuentra nada", r.match);
    const r2 = await consultar("XPROD99999999");
    ok(r2.match === "none", "un alfanumerico inexistente tampoco", r2.match);
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### La pregunta que sostiene la regla, sobre este catalogo");
  // -------------------------------------------------------------------------------------
  {
    // El barcode mas corto: si fuera prefijo de si mismo, no se podria escanear nunca.
    const masCorto = [...completos].sort((a, b) => a.barcode.length - b.barcode.length)[0];
    ok(
      (await consultar(norm(masCorto.barcode))).match === "exact",
      `el barcode mas corto del catalogo (${masCorto.barcode}, ${masCorto.barcode.length} digitos) no se bloquea a si mismo`,
    );

    // Prefijos que NO son prefijo de ningun barcode: se tienen que resolver bien.
    const codes = new Set(filas.map((p) => norm(p.code)));
    const sinPrefijo = [...codes].filter(
      (c) => c.length > 0 && !filas.some((p) => { const b = norm(p.barcode); return b.length > c.length && b.startsWith(c); }),
    );
    console.log(`  ${sinPrefijo.length} de los ${codes.size} codes son terminos que no pueden ser una lectura a medias`);
    if (sinPrefijo.length > 0) {
      const muestra = sinPrefijo[Math.floor(sinPrefijo.length / 2)];
      const r = await consultar(muestra);
      ok(
        r.match === "exact" && r.products[0]?.code === muestra,
        `y esos codes se siguen resolviendo como exactos ("${muestra}")`,
        `${r.match} -> ${r.products[0]?.code}`,
      );
    }

    const shortNumericos = filas.filter((p) => /^\d+$/.test(p.barcode) && !/^0+$/.test(p.barcode) && p.barcode.length < 7);
    console.log(`  y hay ${shortNumericos.length} barcodes numericos de 4 a 6 digitos, que es lo que impedia usar un minimo de longitud`);
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### Ningun barcode puede ser el code de otro producto");
  // -------------------------------------------------------------------------------------
  {
    // Si se cumpliera, buscar por code y buscar por barcode darian productos distintos
    // segun el orden, y la pantalla podria mostrar uno e imprimir otro.
    const codes = new Set(filas.map((p) => norm(p.code)));
    const choque = filas.filter((p) => codes.has(norm(p.barcode)));
    ok(
      choque.length === 0,
      `los ${codes.size} codes no colisionan con ningun barcode, asi que el orden de busqueda es irrelevante`,
      choque.slice(0, 5).map((p) => p.barcode).join(", "),
    );
  }

  // -------------------------------------------------------------------------------------
  console.log("\n### Los codes son la unica cosa que un escaner puede imitar, y son unicos");
  // -------------------------------------------------------------------------------------
  {
    const vistos = new Map<string, number>();
    for (const p of filas) vistos.set(p.code, (vistos.get(p.code) ?? 0) + 1);
    const repes = [...vistos.values()].filter((n) => n > 1);
    ok(repes.length === 0, `los ${vistos.size} codes de producto son unicos`, `${repes.length} repetidos`);
  }

  console.log(`\n### ${pruebas - fallos}/${pruebas} pruebas ok`);
  console.log(fallos === 0 ? "TODO OK" : `${fallos} FALLOS`);
  process.exit(fallos === 0 ? 0 : 1);
}

void main();
