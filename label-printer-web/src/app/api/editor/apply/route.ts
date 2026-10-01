import { NextResponse } from "next/server";
import {
  DEFAULT_TEMPLATE,
  templateById,
  type LabelTemplate,
} from "@/lib/labels/label.template";
import { renderLabel } from "@/lib/labels/label.render";
import { resolveZoneText } from "@/lib/labels/zpl.builder";
import type { TextZone } from "@/lib/labels/label.template";
import type { LabelData } from "@/lib/labels/label.types";
import { applyBodySchema } from "@/lib/labels/label-zones.schema";
import { writeOverride, clearOverride, readOverride } from "@/lib/labels/label-override.store";

/**
 * `POST /api/editor/apply` guarda la geometria; `DELETE` la descarta.
 *
 * QUE ES Y QUE NO ES
 *
 * NO reescribe `label.template.ts`. Lo que hace es guardar las zonas en
 * `data/plantilla-override.json`, una capa que `templateForPrint()` aplica encima de la
 * plantilla del codigo al imprimir. El codigo sigue siendo la verdad por defecto y basta con
 * borrar ese archivo para volver atras, sin recompilar y sin git.
 *
 * Esa es la razon de que el boton sea seguro de pulsar: antes, tocar el `.ts` era irreversible
 * sin git, y un POST que reescribe codigo fuente desde el navegador es la clase de cosa que un
 * dia se come una plantilla sin avisar.
 *
 * POR QUE SE COMPRUEBA ANTES DE GUARDAR
 *
 * Se vuelve a renderizar con las zonas propuestas y se rechazan los solapes y las cajas que se
 * salen del rollo. Guardar una plantilla que se pisa a si misma imprimiria etiquetas con el
 * precio encima del nombre, y eso no se ve hasta que gastas papel. Se avisa en pantalla y el
 * boton dice que no.
 *
 * La comprobacion es la MISMA que hace el preview, porque las dos salen de `renderLabel()`.
 */
interface Caja {
  etiqueta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  texto?: string;
}

/**
 * Solapes y salidas de rollo.
 *
 * Va en el servidor y no solo en el navegador a proposito: el boton escribe en disco, y lo que
 * se decide antes de escribir tiene que depender solo del servidor. Si la comprobacion viviera
 * en el cliente, un `POST` a mano saltarsela entero, que es justo lo que pasa cuando el que
 * prueba ya no es el navegador.
 */
function problemas(
  cajas: Caja[],
  ancho: number,
  alto: number,
): string[] {
  const fuera: string[] = [];
  for (const c of cajas) {
    const que = c.texto ?? c.etiqueta;
    if (c.x0 < 0 || c.y0 < 0) {
      fuera.push(`"${que}" se sale por la izquierda o por arriba (${c.x0},${c.y0})`);
    }
    if (c.x1 > ancho) {
      fuera.push(
        `"${que}" se sale por la derecha: llega a ${c.x1} y el rollo acaba en ${ancho} dots`,
      );
    }
    if (c.y1 > alto) {
      fuera.push(
        `"${que}" se sale por abajo: llega a ${c.y1} y el rollo acaba en ${alto} dots`,
      );
    }
  }
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i];
      const b = cajas[j];
      const encima = a.x1 > b.x0 && b.x1 > a.x0 && a.y1 > b.y0 && b.y1 > a.y0;
      if (encima) {
        fuera.push(`"${a.texto ?? a.etiqueta}" pisa a "${b.texto ?? b.etiqueta}"`);
      }
    }
  }
  return fuera;
}

/**
 * Estado guardado, con las zonas.
 *
 * Las zonas se devuelven porque la pantalla tiene que ABRIR en lo que se esta usando de
 * verdad: si recarga con un override activo y le pinta la del codigo, parece que el boton no
 * hizo nada cuando en realidad se sigue imprimiendo con lo guardado.
 */
export async function GET() {
  const o = await readOverride();
  return NextResponse.json({
    activo: o !== null,
    templateId: o?.templateId ?? null,
    savedAt: o?.savedAt ?? null,
    zones: o?.zones ?? null,
    zonesWithoutBarcode: o?.zonesWithoutBarcode ?? null,
  });
}

/** Descarta el override y vuelve a la plantilla del codigo. */
export async function DELETE() {
  await clearOverride();
  return NextResponse.json({ ok: true, activo: false });
}

export async function POST(req: Request) {
  let parsed: ReturnType<typeof applyBodySchema.parse>;
  try {
    parsed = applyBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: `zonas invalidas: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const base = templateById(parsed.templateId);
  const template: LabelTemplate = {
    ...base,
    zones: parsed.zones,
    zonesWithoutBarcode: parsed.zonesWithoutBarcode ?? base.zonesWithoutBarcode,
  };

  // Un codigo que no cabe no es motivo para rechazar la plantilla: `planBarcode()` ya avisa de
  // eso por separado y la etiqueta sale sin barras a proposito. Lo que se rechaza aqui es solo
  // la geometria rota.
  const pruebas: LabelData[] = [
    {
      productName: "BADIA JALAPEÑO 2 OZ",
      barcode: "033844007522",
      price: 5.68,
      reference: "RETAIL",
      businessName: "PA PICAR",
    },
    // El nombre mas largo del catalogo, que es donde el `autoFit` baja la letra hasta el suelo
    // y donde suelen aparecer los choques. Con un nombre corto una plantilla puede parecer
    // buena y solo fallar con el producto mas largo.
    {
      productName: "BOMBONES RICOS ARANDANO Y FRESA PACO 100G",
      barcode: "0412222222222",
      price: 24.99,
      reference: "RETAIL",
      businessName: "PA PICAR",
    },
  ];

  const fallos: string[] = [];
  for (const data of pruebas) {
    const r = renderLabel(template, data, { scale: 1, grid: false });
    fallos.push(
      ...problemas(r.cajas, template.widthDots, template.heightDots).map(
        (p) => `"${data.productName}": ${p}`,
      ),
    );
    // Un texto que se sale del rollo por la derecha sale ya en `informe`, pero se recoge aqui
    // para no depender de un texto que puede cambiar de redaccion.
    for (const linea of r.informe) {
      if (linea.includes("SE PASA")) fallos.push(`"${data.productName}": ${linea}`);
    }
  }

  if (fallos.length > 0) {
    return NextResponse.json(
      {
        error:
          "No se ha guardado: con estos valores la etiqueta se imprime encima de si misma " +
          "o se sale del rollo.",
        detalles: [...new Set(fallos)],
        aplicado: false,
      },
      { status: 422 },
    );
  }

  try {
    await writeOverride({
      templateId: template.id,
      zones: template.zones,
      zonesWithoutBarcode: template.zonesWithoutBarcode,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  // El alto y ancho resueltos por zona, para que la pantalla pueda confirmar lo que se ha
  // guardado con los mismos numeros que se ven en el preview.
  const resueltos = template.zones.map((z, i) => {
    if (z.kind !== "text") return { indice: i, texto: null, alto: 0, ancho: 0 };
    const res = resolveZoneText(template, z as TextZone, pruebas[0]);
    return res
      ? { indice: i, texto: res.text, alto: res.alto, ancho: res.ancho }
      : { indice: i, texto: null, alto: 0, ancho: 0 };
  });

  return NextResponse.json({
    ok: true,
    aplicado: true,
    templateId: template.id,
    nombre: DEFAULT_TEMPLATE.name,
    zonas: template.zones.length,
    resueltos,
    aviso:
      "Guardado en data/plantilla-override.json. El cambio ya vale para imprimir sin " +
      "reiniciar; el codigo de label.template.ts no se ha tocado.",
  });
}
