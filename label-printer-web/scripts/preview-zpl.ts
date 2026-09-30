// Preview the ZPL that buildZpl() produces, without touching the printer.
// Handy to check the geometry of a label before spending one on the roll.
//
// Usage (after `tsc -p tsconfig.preview.json`):
//   node .preview-build/scripts/preview-zpl.js [cantidad]
//
// The second argument is the label quantity: it checks that buildZplBatch() emits
// exactly that many ^XA...^XZ blocks, which is what the printer counts as labels.
import { buildZpl, buildZplBatch } from "../src/lib/labels/zpl.builder";
import { DEFAULT_TEMPLATE } from "../src/lib/labels/label.template";
import type { LabelData } from "../src/lib/labels/label.types";

const template = DEFAULT_TEMPLATE;
const qty = Number.parseInt(process.argv[2] ?? "1", 10) || 1;

const data: LabelData = {
  productName: "CAFE AMANECER DE 500GR",
  barcode: "7591234567801",
  price: 7.8,
  reference: "0001",
  businessName: "PA PICAR",
};

console.log(
  `plantilla: ${template.widthDots} x ${template.heightDots} dots ` +
    `(${template.widthDots / 8} x ${template.heightDots / 8} mm)\n`,
);

const zpl = buildZplBatch(template, data, qty);

const blocks = (zpl.match(/\^XA/g) ?? []).length;
const ends = (zpl.match(/\^XZ/g) ?? []).length;
console.log(`cantidad pedida: ${qty}`);
console.log(`bloques ^XA: ${blocks}   bloques ^XZ: ${ends}`);
if (blocks !== qty || ends !== qty) {
  console.log(`\nERROR: se esperaban ${qty} bloques ^XA/^XZ`);
  process.exitCode = 1;
}

// El ^GFA del logo ocupa 1675 bytes y solo se ve una vez: se muestra completo solo
// con qty = 1, y en los lotes solo se anuncia su tamano.
if (qty === 1) {
  for (const line of zpl.split("\n")) {
    console.log("  " + (line.length > 88 ? `${line.slice(0, 88)} ...(${line.length})` : line));
  }
} else {
  console.log(`\nZPL del lote: ${zpl.length} bytes (${blocks} etiquetas)`);
}
