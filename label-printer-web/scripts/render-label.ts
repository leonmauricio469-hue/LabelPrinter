// Render the label that buildZpl() produces into a PNG at the printer's own
// resolution, so the geometry can be inspected without spending a label.
//
// This is the command-line face of `src/lib/labels/label.render.ts`. The editor at `/editor`
// uses the same function, on purpose: if this script drew its own copy of the geometry, the
// PNG you check here and the one on screen could disagree, and then neither is worth looking
// at.
//
// Usage (after `tsc -p tsconfig.preview.json`):
//   node .preview-build/scripts/render-label.js [barcode]
//   SCALE=4 node .preview-build/scripts/render-label.js        (px per dot)
//   TEMPLATE=papicar-59x35 node .preview-build/scripts/render-label.js
//   NOMBRE="BADIA JALAPEÑO 2 OZ" node .preview-build/scripts/render-label.js
//
// Output: preview/label-<id>.png
import { writeFileSync, mkdirSync } from "node:fs";
import { templateById } from "../src/lib/labels/label.template";
import { renderLabel } from "../src/lib/labels/label.render";
import type { LabelData } from "../src/lib/labels/label.types";

const scale = Number.parseInt(process.env.SCALE ?? "3", 10);
const barcode = process.argv[2] ?? "7591234567801";
const template = templateById(process.env.TEMPLATE);
const productName = process.env.NOMBRE ?? "CAFE AMANECER DE 500GR";

const data: LabelData = {
  productName,
  barcode,
  price: 7.8,
  reference: "0001",
  businessName: "PA PICAR",
};

console.log(
  `Plantilla ${template.id}  ${template.widthMm} x ${template.heightMm} mm  =  ` +
    `${template.widthDots} x ${template.heightDots} dots @ 203 dpi`,
);
console.log(`Barcode "${barcode}"   Nombre "${productName}"\n`);

const r = renderLabel(template, data, { scale });

console.log("Cajas dibujadas (dots):");
for (const c of r.cajas) {
  const t = c.texto ?? c.etiqueta;
  const alto = c.alto !== undefined ? ` alto ${c.alto} ancho ${c.anchoUsado}` : "";
  console.log(`  ${String(c.x0).padStart(3)}..${String(c.x1).padEnd(3)} x ${String(c.y0).padStart(3)}..${String(c.y1).padEnd(3)}  "${t}"${alto}`);
}

console.log("\nInforme del render:");
for (const l of r.informe) console.log(`  ${l}`);

mkdirSync("preview", { recursive: true });
const salida = `preview/label-${template.id}.png`;
writeFileSync(salida, r.png);
console.log(`\n  -> ${salida}`);