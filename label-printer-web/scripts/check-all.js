#!/usr/bin/env node
// Corre TODAS las comprobaciones del proyecto en el orden correcto y en un solo comando.
//
//   npm run check
//
// Hace falta, y no es por comodidad:
//
//   1. Borra `.preview-build` ANTES de compilar. Sin esto el runner puede ejecutar un `.js`
//      viejo: el directorio es un artefacto de salida que nadie borra, y tsc solo reescribe
//      los ficheros que cambian. Un `.js` de una version anterior del `.ts` da un verde que
//      no corresponde con el fuente. Esto ya paso: `check-zonas.js` de las 16:22 daba verde
//      mientras `check-zonas.ts` de las 16:26 ya no compilaba.
//
//   2. Compila con `tsc -p tsconfig.preview.json` y para si falla. Un check que no compila
//      no es un check que pasa: es un check que no existe, y sin este paso el runner lo
//      contaria como verde.
//
//   3. Se queda en la raiz del proyecto, porque `check-zonas.ts` lee su propio arbol de
//      fuentes con una ruta relativa (`src/lib/labels/label-zones.schema.ts`). Correrlo
//      desde otro directorio lo rompe sin avisar.
//
//   4. Sale con codigo 1 si algo falla, para que un `pre-commit` o un CI pueda decidir.
//
// Los ficheros `ver-*.ts` quedan fuera a proposito: son herramientas de mirar, no
// comprobaciones, y no deciden nada. `ver-layout.ts` lo dice en su propio comentario.
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");
const BUILD = path.join(RAIZ, ".preview-build");

process.chdir(RAIZ);

const CABECERA = (nombre) =>
  ["", "=".repeat(74), `  ${nombre}`, "=".repeat(74)].join("\n");

const NODO = process.execPath;

// El compilador se invoca con `node <typescript>/lib/tsc.js`, no con `npx tsc` ni con
// `node_modules/.bin/tsc`.
//
//   - `npx.cmd` con `shell: true` parte la linea en los espacios del proyecto: "Default
//     Project" se convertia en dos argumentos y node buscaba un modulo llamado "Default".
//   - `spawnSync` de un `.cmd` sin shell da EINVAL en Windows, porque no es un PE.
//   - `.bin/tsc` sin extension es un sh Unix: no existe en una instalacion de Windows.
//
// `require.resolve` lo busca en el arbol de este mismo modulo, asi que no depende del cwd.
let TSC;
try {
  TSC = require.resolve("typescript/lib/tsc.js");
} catch {
  console.error("\nNo encuentro typescript. Ejecuta `npm install` antes de `npm run check`.");
  process.exit(127);
}

/** Corre un comando y devuelve su exit code. */
function correr(programa, args) {
  const r = spawnSync(programa, args, { cwd: RAIZ, stdio: "inherit" });
  if (r.error) {
    console.error(`No se pudo lanzar ${programa}: ${r.error.message}`);
    return 127;
  }
  return r.status === null ? 1 : r.status;
}

/** Nombres de las comprobaciones, en orden alfabetico, para que el orden sea estable. */
function comprobaciones() {
  const dir = path.join(RAIZ, "scripts");
  return fs
    .readdirSync(dir)
    .filter((f) => /^check-.*\.ts$/.test(f))
    .map((f) => path.join(BUILD, "scripts", f.replace(/\.ts$/, ".js")))
    .filter((f) => fs.existsSync(f))
    .sort();
}

console.log(CABECERA("Limpiando .preview-build"));
fs.rmSync(BUILD, { recursive: true, force: true });

console.log(CABECERA("Compilando scripts (tsc -p tsconfig.preview.json)"));
if (correr(NODO, [TSC, "-p", "tsconfig.preview.json"]) !== 0) {
  console.error(
    "\nLa compilacion de los scripts ha fallado. Sin `.preview-build` al dia no se ejecuta\n" +
      "ninguna comprobacion: correrlas sobre un build viejo daria un verde falso.\n" +
      "Arregla los errores de arriba y vuelve a lanzar esto.",
  );
  process.exit(1);
}

const checks = comprobaciones();
if (checks.length === 0) {
  console.error("\nNo hay ninguna comprobacion en scripts/check-*.ts");
  process.exit(1);
}

const resultados = [];
for (const js of checks) {
  const nombre = path.basename(js, ".js");
  console.log(CABECERA(nombre));
  resultados.push({ nombre, code: correr(NODO, [js]) });
}

const fallidos = resultados.filter((r) => r.code !== 0);
const nuevos = resultados.filter((r) => r.code === 1);
const rotos = resultados.filter((r) => r.code > 1);

console.log(CABECERA("Resumen"));
for (const { nombre, code } of resultados) {
  console.log(`  ${code === 0 ? "OK   " : "FALLA"}  ${nombre}${code > 1 ? `  (crash, codigo ${code})` : ""}`);
}
console.log("");
console.log(`  ${resultados.length - fallidos.length}/${resultados.length} comprobaciones en verde.`);

if (fallidos.length) {
  console.log(
    `\n  ${nuevos.length} con comprobaciones fallidas` +
      (rotos.length ? `, ${rotos.length} que ni siquiera terminaron.\n` : ".\n"),
  );
  console.log("  Mira arriba el detalle. Cada `ok()` imprime el valor que recibio.");
  process.exit(1);
}

console.log("\n  Todas en verde. Esto sustituye a mirar la etiqueta, no a imprimirla.");
process.exit(0);