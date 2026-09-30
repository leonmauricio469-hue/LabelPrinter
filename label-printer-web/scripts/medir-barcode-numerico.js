// Medida de una vez, no forma parte de la app: responde "¿cual es el barcode numerico mas
// corto del catalogo real?", que es el dato del que depende MIN_DIGITOS_CODIGO.
const fs = require("node:fs");
const filas = JSON.parse(
  fs.readFileSync("data/catalog.json", "utf8").replace(/^﻿/, ""),
);

// "Solo digitos" se decide sobre el barcode CRUDO, sin normalizar: `02-012` lleva guion y un
// escaner lo lee como 6 caracteres, pero NO es una secuencia numerica de 5.
const num = filas.filter((p) => /^[0-9]+$/.test(p.barcode) && !/^0+$/.test(p.barcode));

const porLong = new Map();
for (const p of num) {
  const L = p.barcode.length;
  if (!porLong.has(L)) porLong.set(L, []);
  porLong.get(L).push(p);
}

console.log("### Barcodes de SOLO digitos, por longitud (crudo)");
for (const L of [...porLong.keys()].sort((a, b) => a - b)) {
  const g = porLong.get(L);
  const ej = g.slice(0, 3).map((p) => p.barcode + "=" + p.name).join("  |  ");
  console.log("  " + String(L).padStart(2) + " digitos: " + String(g.length).padStart(4) + "   " + ej);
}

const codes = new Set(filas.map((p) => p.code));

console.log("");
console.log("### Barcodes numericos cortos que ademas son el code de otro producto");
const largos = [...porLong.keys()].filter((L) => L >= 7);
const minLargo = largos.length ? Math.min(...largos) : Infinity;
console.log("  el barcode numerico mas largo-fijo seria " + minLargo + " digitos");
let n = 0;
const ej = [];
for (const L of [...porLong.keys()].sort((a, b) => a - b)) {
  if (L >= minLargo) break;
  for (const p of porLong.get(L)) {
    if (codes.has(p.barcode)) {
      n++;
      if (ej.length < 8) ej.push(p.barcode + "  code=" + p.code + "  " + p.name);
    }
  }
}
console.log("  de menos de " + minLargo + " digitos, " + n + " colisionan con un code");
ej.forEach((e) => console.log("    " + e));

console.log("");
console.log("### Prefijos de barcode numerico corto que son code de otro producto");
let prefijos = 0;
const ejPref = [];
for (const L of [...porLong.keys()].sort((a, b) => a - b)) {
  if (L >= minLargo) break;
  for (const p of porLong.get(L)) {
    for (let k = 1; k < L; k++) {
      const pre = p.barcode.slice(0, k);
      if (codes.has(pre)) {
        prefijos++;
        if (ejPref.length < 8) {
          ejPref.push(
            "prefijo " + pre + " (code del producto " + pre + ")  ->  barcode real " + p.barcode + " = " + p.name,
          );
        }
      }
    }
  }
}
console.log("  " + prefijos + " prefijos peligrosos");
ejPref.forEach((e) => console.log("    " + e));
