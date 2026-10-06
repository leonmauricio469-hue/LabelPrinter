"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_TEMPLATE, MM_TO_DOTS, dotsFromMm } from "@/lib/labels/label.template";
import {
  ASIDERES,
  TITULO_ASIDERA,
  ejesRedimensionables,
  redimensionar,
  type Asider,
} from "@/lib/labels/label.resize";
import { graphicDots, scaleGraphic } from "@/lib/labels/gf-graphic";
import { buscarProblemas } from "@/lib/labels/label-solapes";
import { buttonGhost, buttonPrimary, buttonQuiet, card, h2, h3, input } from "@/components/ui";
import type { LabelZone } from "@/lib/labels/label.template";

/**
 * Editor visual de la plantilla.
 *
 * QUE ES Y QUE NO ES
 *
 * Es para decidir la geometria mirando, no para editar el codigo. El boton de abajo saca un
 * bloque de TypeScript con los valores finales, que es lo que se pega en `label.template.ts`.
 * Deliberadamente NO escribe el fichero desde el navegador: un POST que reescribe codigo
 * fuente es la clase de cosa que un dia se come una plantilla sin avisar.
 *
 * POR QUE EL DIBUJO VIENE DEL SERVIDOR
 *
 * El PNG lo pinta `renderLabel()`, que dibuja el ZPL de `buildZpl()`, que es el mismo que
 * va a la impresora. Dibujando en el navegador el editor ensenaria una geometria y la
 * impresora sacaria otra.
 */

type AnyZone = Record<string, unknown> & { kind: string };

interface Caja {
  etiqueta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  texto?: string;
  /** Texto completo del `^FD` del que viene esta caja. Ver `RenderedZone.origen`. */
  origen?: string;
  alto?: number;
  anchoUsado?: number;
}

interface Preview {
  png: string;
  cajas: Caja[];
  resueltos: { indice: number; texto: string | null; alto: number; ancho: number }[];
  informe: string[];
  symbology: string | null;
  datosImpresos: string | null;
  anchoSimbolo: number;
  zonaQuieta: number;
}

const MM = (dots: number) => dots / MM_TO_DOTS;
const DOTS = (mm: number) => Math.round(mm * MM_TO_DOTS);

/** Donde va cada asa, en tanto por ciento de la caja. */
const POS_ASIDERA: Record<Asider, { x: number; y: number }> = {
  nw: { x: 0, y: 0 },
  n: { x: 0.5, y: 0 },
  ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 },
  se: { x: 1, y: 1 },
  s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 },
  w: { x: 0, y: 0.5 },
};

/** El cursor de cada asa. Da la pista de que se puede arrastrar sin tener que leer el titulo. */
const CURSA_ASIDERA: Record<Asider, string> = {
  nw: "cursor-nwse-resize",
  n: "cursor-ns-resize",
  ne: "cursor-nesw-resize",
  e: "cursor-ew-resize",
  se: "cursor-nwse-resize",
  s: "cursor-ns-resize",
  sw: "cursor-nesw-resize",
  w: "cursor-ew-resize",
};

/**
 * Ancho en dots de la caja de texto de una zona, tal y como la ha dibujado el servidor.
 *
 * Sale del render y no de la zona porque, sin `maxWidthDots`, `emit()` no escribe `^FB`: la caja
 * no existe como dato y su ancho es el que ocupa el texto, que cambia con cada producto. Para
 * ensanchar esa caja hay que empezar por la medida que se ve, no por un supuesto.
 */
function anchoCajaDeTexto(
  indice: number,
  preview: Preview | null,
  pegables: number[],
): number | undefined {
  if (!preview) return undefined;
  const caja = preview.cajas[pegables.indexOf(indice)];
  if (!caja) return undefined;
  return Math.max(1, caja.x1 - caja.x0);
}

/**
 * Las zonas que se pueden mover y redimensionar arrastrando.
 *
 * El marco NO esta, y es lo unico que se ha sacado de aqui.
 *
 * En v1.6 se dejo que los cuatro tipos se movieran, con la razon de que "si el marco va a
 * 2 mm del borde, eso se decide mirando la etiqueta, y mirar exige poder arrastrarlo". La
 * razon era buena y la conclusion estaba equivocada: lo que se decide mirando la etiqueta
 * es el ancho del rollo, que es lo de `/settings`, no la posicion del marco.
 *
 * El marco es el margen fisico del papel. Si el borde queda a 0,4 mm del canto, la impresora
 * lo corta y la etiqueta sale con un lado comido, y eso no se arregla ni con ZPL ni con
 * arrastre. Es ademas la unica zona cuya medida se deduce sola de la plantilla
 * (`ANCHO_DOTS` menos el margen), de modo que si se pudiera mover, `label.template.ts` y lo
 * guardado en `data/plantilla-override.json` dirian dos cosas distintas y no habria forma de
 * saber cual manda.
 *
 * Sigue apareciendo en la lista, en gris y con "(fija)", y sigue dibujandose en la
 * previsualizacion: quitado del editor no es quitado de la etiqueta. Lo que se quita es el
 * tirador, que es lo que invita a moverlo.
 */
const EDITABLES = new Set(["text", "barcode", "graphic"]);

const TITULOS: Record<string, string> = {
  productName: "descripcion",
  price: "precio",
  referenceLabel: "REF:",
  reference: "referencia",
  barcode: "codigo de barras",
};

/** Los identificadores de las zonas fijas, para que la lista no diga "zona 0". */
const FIJAS: Record<string, string> = {
  shape: "marco",
  graphic: "logo",
};

function etiquetaDe(z: AnyZone, i: number): string {
  if (z.kind === "barcode") return "codigo de barras";
  if (FIJAS[z.kind]) return FIJAS[z.kind];
  const src = String(z.source ?? "");
  return TITULOS[src] ?? `zona ${i}`;
}

/**
 * La primera zona que se puede tocar.
 *
 * El marco es la primera zona de la plantilla, y ya no es editable, asi que sin esto el editor
 * abriria con el marco seleccionado y sin ningun panel que enseñe. Empieza en la siguiente.
 */
function primeraEditable(zonas: AnyZone[]): number {
  const i = zonas.findIndex((z) => EDITABLES.has(z.kind));
  return i < 0 ? 0 : i;
}

/**
 * Que zona de la plantilla corresponde a cada caja dibujada.
 *
 * NO es el mismo indice. `label.render.ts` saca las cajas del ZPL, asi que van en el orden en
 * que `emit()` las escribe, y ese orden no coincide con el del array `zones` (las zonas fijas
 * no se dibujan y el logo va el primero aunque sea la tercera zona).
 *
 * El emparejamiento va por el texto del `^FD` completo (`origen`), no por el trozo de la
 * linea: un nombre plegado en dos lineas sale en dos cajas con dos trozos distintos, y
 * emparejar por trozo devolvia `-1` y dejaba la zona sin caja arrastrable. Con `origen` las
 * cajas de un mismo plegado apuntan todas a su zona, y una zona de una sola linea sigue
 * emparejando por su texto entero, que es el mismo que su `origen`.
 *
 * Las barras son la unica zona de tipo `barcode` y el logo la unica de tipo `graphic`, asi
 * que esos dos van directos.
 *
 * Devuelve `-1` en las cajas que no corresponden a ninguna zona editable, que es como se sabe
 * que ese elemento no se debe mover.
 */
function mapearCajas(
  cajas: Caja[],
  zones: AnyZone[],
  resueltos: { indice: number; texto: string | null }[],
): number[] {
  const usados = new Set<number>();
  const map: number[] = cajas.map(() => -1);
  // Zona de la caja de texto anterior: decide si el siguiente trozo CONTINUA el mismo
  // plegado o empieza la caja de otra zona.
  let anterior = -1;

  cajas.forEach((c, i) => {
    // El marco no tiene texto, asi que sin emparejarlo por tipo se quedaba sin caja
    // asociada: era la razon de que no se pudiera mover. Por tipo funciona porque solo hay
    // una zona de cada uno de estos tres tipos.
    if (c.etiqueta === "barras" || c.etiqueta === "logo" || c.etiqueta === "marco") {
      const kind =
        c.etiqueta === "barras" ? "barcode" : c.etiqueta === "logo" ? "graphic" : "shape";
      const j = zones.findIndex((z) => z.kind === kind);
      map[i] = j;
      // Se guarda el INDICE DE ZONA, porque `usados` se compara contra `resueltos`, que va
      // por zona. Guardar el indice de caja ahi hacia que dos numeros distintos se
      // compararan como si fueran el mismo, y tumbaba el emparejamiento de las siguientes
      // cajas de texto.
      if (j >= 0) usados.add(j);
      anterior = -1;
      return;
    }
    if (!c.texto) return;
    const origen = c.origen ?? c.texto;

    // Continuidad de linea: mismo `^FD` que la caja anterior y texto de zona mas largo que
    // el trozo (la zona esta plegada). Solo asi se reutiliza una zona ya usada. Si el texto
    // de la zona fuera igual al trozo, seria una zona de una sola linea robando las cajas de
    // otra con el mismo texto, y ahi manda el `usados` de abajo.
    if (anterior >= 0) {
      const r = resueltos[anterior];
      if (r && r.texto === origen && r.texto !== c.texto) {
        map[i] = anterior;
        return;
      }
    }

    // Primero una zona sin usar, para que dos zonas con el mismo texto no acaben las dos
    // colgando de la primera; si no queda ninguna, se reutiliza la que tenga ese texto
    // (es la identidad exacta del `^FD`, asi que o es una linea mas del plegado o hay dos
    // zonas con texto identico y no hay ninguna senal que las desdiferencie).
    const j =
      resueltos.find((r) => r.texto === origen && !usados.has(r.indice))?.indice ??
      resueltos.find((r) => r.texto === origen)?.indice ??
      -1;
    map[i] = j;
    if (j >= 0) usados.add(j);
    anterior = j;
  });

  return map;
}

export default function EditorPage() {
  const [zones, setZones] = useState<AnyZone[]>(
    structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[],
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<number>(() =>
    primeraEditable(structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[]),
  );
  const [nombre, setNombre] = useState("BADIA JALAPEÑO 2 OZ");
  const [barcode, setBarcode] = useState("033844007522");
  const [precio, setPrecio] = useState(5.68);
  const [zoom, setZoom] = useState(3);
  const [mostrarCajas, setMostrarCajas] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [aplicado, setAplicado] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [rechazoDetalle, setRechazoDetalle] = useState<string[]>([]);
  const [hayOverride, setHayOverride] = useState(false);
  const [guardado, setGuardado] = useState<{ savedAt: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Carga el estado guardado al abrir.
   *
   * Sin esto, recargar la pagina con un override activo ensenaria la plantilla del `.ts` y
   * pareceria que el boton no ha hecho nada, cuando en realidad se sigue imprimiendo con lo
   * guardado. La pantalla tiene que abrir en lo que de verdad se usa.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/editor/apply");
        const j = await r.json();
        if (!vivo) return;
        setHayOverride(Boolean(j.activo));
        setGuardado(j.activo ? { savedAt: j.savedAt } : null);

        if (!j.activo || !Array.isArray(j.zones)) return;
        const cargadas = structuredClone(j.zones) as unknown as AnyZone[];
        setZones(cargadas);
        setSel(primeraEditable(cargadas));
        setAplicado(
          `Cargado lo que hay guardado (${j.savedAt}). Estos son los valores con los que se ` +
            `esta imprimiendo, no los del codigo.`,
        );
      } catch {
        // Si el estado guardado no se puede leer, la pantalla arranca con la del codigo. Es
        // mejor que quedarse en blanco: el preview se dibuja igual y se ve en que plantilla.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Guarda la geometria en `data/plantilla-override.json`.
   *
   * El servidor vuelve a renderizar antes de escribir y devuelve 422 con el detalle si las
   * zonas se pisan o se salen del rollo, asi que el boton no guarda nunca una plantilla rota.
   * Ahi se pierde el cambio, pero no el papel.
   */
  async function aplicar() {
    setAplicando(true);
    setRechazo(null);
    setRechazoDetalle([]);
    try {
      const res = await fetch("/api/editor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: DEFAULT_TEMPLATE.id,
          zones,
          zonesWithoutBarcode: DEFAULT_TEMPLATE.zonesWithoutBarcode,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAplicado(null);
        setRechazo(j.error ?? "no se ha podido guardar");
        setRechazoDetalle(Array.isArray(j.detalles) ? j.detalles : []);
        return;
      }
      setAplicado(j.aviso ?? "Guardado.");
      setHayOverride(true);
      setGuardado({ savedAt: new Date().toISOString() });
    } catch (e) {
      setAplicado(null);
      setRechazo((e as Error).message);
    } finally {
      setAplicando(false);
    }
  }

  /** Borra el override. A partir de aqui se imprime con la plantilla del codigo. */
  async function descartar() {
    setAplicando(true);
    try {
      const res = await fetch("/api/editor/apply", { method: "DELETE" });
      if (!res.ok) {
        setRechazo("No se ha podido descartar.");
        return;
      }
      setHayOverride(false);
      setGuardado(null);
      setAplicado("Descartado. Se vuelve a la plantilla del codigo.");
      setZones(structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[]);
      setSel(primeraEditable(structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[]));
    } catch (e) {
      setRechazo((e as Error).message);
    } finally {
      setAplicando(false);
    }
  }

  const pedir = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zones,
          data: {
            productName: nombre,
            barcode,
            price: precio,
            reference: "RETAIL",
            businessName: "PA PICAR",
          },
          scale: zoom,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "fallo desconocido");
        return;
      }
      setPreview(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [zones, nombre, barcode, precio, zoom]);

  // Cada cambio agenda una peticion. El retardo agrupa el tecleo rapido en una sola llamada.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(pedir, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pedir]);

  function editar(i: number, cambio: Record<string, unknown>) {
    setZones((prev) => prev.map((z, j) => (j === i ? { ...z, ...cambio } : z)));
  }

  function editarAutoFit(i: number, cambio: Record<string, number>) {
    setZones((prev) => prev.map((z, j) => (j === i ? conAutoFit(z, cambio) : z)));
  }

  function editarFuente(i: number, mm: number) {
    setZones((prev) => prev.map((z, j) => (j === i ? conAltoDeFuente(z, mm) : z)));
  }

  function editarFuenteAncho(i: number, mm: number) {
    setZones((prev) => prev.map((z, j) => (j === i ? conAnchoDeFuente(z, mm) : z)));
  }

  /**
   * Cambia el ancho o el alto del logo reescalando el `^GFA`.
   *
   * Se pasa por `redimensionar()` en vez de calcular el factor aqui, para que el campo numerico
   * y el tirador den EXACTAMENTE el mismo resultado. Si cada uno calculara su propia
   * proporcion, pondrias 30,0 mm en el campo y 31,0 mm desde la esquina, y no sabrias cual de
   * los dos manda.
   *
   * `ancho` o `alto` a `null` significa "no lo toques", que es como se reescala manteniendo la
   * proporcion: se cambia un lado y el otro le sigue.
   */
  function editarLogo(i: number, anchoMm: number | null, altoMm: number | null) {
    setZones((prev) =>
      prev.map((z, j) => {
        if (j !== i) return z;
        const gf = String(z.gf ?? "");
        const actual = graphicDots(gf).dots;
        if (!actual) return z;
        const wObjetivo = anchoMm === null ? actual.w : DOTS(anchoMm);
        const hObjetivo = altoMm === null ? actual.h : DOTS(altoMm);
        const r = scaleGraphic(gf, wObjetivo, hObjetivo);
        // Un fallo aqui (medida demasiado pequena, o un `^GF` ilegible) NO se guarda: dejar la
        // zona con un `gf` a medio cambiar dejaria el logo en blanco sin decir por que.
        return "error" in r ? z : { ...z, gf: r.gf };
      }),
    );
  }

  const zona = zones[sel];

  /** Que ejes se pueden estirar en la zona seleccionada, y el aviso de lo que no se puede. */
  const zonaEjes = useMemo(
    () => (zona ? ejesRedimensionables(zona as unknown as LabelZone) : null),
    [zona],
  );

  /**
   * Lo que se imprime de verdad en la zona seleccionada, con el nombre de prueba actual.
   *
   * El campo de arriba ("alto letra") es el techo del `autoFit` cuando la zona lo tiene. Este
   * es el alto que ha salido de ajustar ese nombre al ancho de caja. Con un nombre corto
   * coinciden; con uno de 50 caracteres el ajuste baja la letra y los dos numeros ya no son
   * el mismo, que es justo lo que hay que ver para decidir el techo.
   */
  const resuelto = preview?.resueltos.find((r) => r.indice === sel) ?? null;

  /**
   * Por que se ha bajado la letra del techo, en una frase.
   *
   * Antes de v1.8 solo habia una razon posible: el texto no cabia en UNA linea del ancho de
   * caja. Ahora hay dos, y se confunden: con `maxLines: 2` y `maxBlockDots`, un nombre puede
   * caber de sobra en una linea y estar bajadísimo porque el hueco que le queda hasta las
   * barras no da para dos lineas grandes. Decirle al usuario "no cabe a 56 dots" cuando lo
   * que pasa es que no cabe en 88 de bloque lo manda a subir `maxHeight`, que no es el
   * mando que sirve, y a bajar `minHeight`, que empeora el resultado.
   *
   * Se decide mirando la RAMA que `resolveAutoFit()` eligió de verdad, no una hipotesis. El
   * algoritmo prueba primero "cabe en una linea" bajando el alto, y solo si eso no sale por
   * abajo prueba a repartir en varias. Asi que un nombre que sale en UNA linea a 55 dots esta
   * limitado por el ancho y nada mas, aunque a 56 dots el hueco tampoco dejaria entrar el bloque
   * de dos lineas: ese segundo limite nunca llego a mandar porque el algoritmo
   * ya habia encontrado la solucion de una linea. Decir "el tope lo pone el hueco" ahi
   * manda a mover el hueco cuando el ancho es lo unico que aprieta.
   */
  const porQueSeBajo = useMemo((): string | null => {
    const af = zona?.autoFit as Record<string, number> | undefined;
    if (!af || !resuelto || resuelto.alto >= af.maxHeight || !zona || zona.kind !== "text") {
      return null;
    }
    // `caja`, `maxLineas` y `anchoTecho` salen de la zona con `as number`: `zona` es la union
    // de todas las zonas editables y `maxWidthDots` solo existe en las de texto, asi que el
    // tipo del union no lo afina solo. Ya se ha comprobado antes que `zona.kind === "text"`.
    const chars = resuelto.texto?.length ?? 0;
    const caja = (zona.maxWidthDots as number | undefined) ?? 0;
    const maxLineas = (zona.maxLines as number | undefined) ?? 1;
    const anchoTecho = Math.max(1, Math.round(af.maxHeight * af.widthRatio));
    const salidaEnUnaLinea = chars * resuelto.ancho <= caja;
    const topeBloque = af.maxBlockDots as number | undefined;

    const razones: string[] = [];
    if (salidaEnUnaLinea) {
      // Rama de una linea: el unico tope posible es el ancho, y solo si a la altura elegida el
      // bloque de una linea ya no cupiera (o sea, un `maxBlockDots` menor que el alto).
      razones.push(
        `no caben ${chars} caracteres en una linea de ${caja} dots a ${anchoTecho} de celda`,
      );
      if (topeBloque !== undefined && resuelto.alto > topeBloque) {
        razones.push(`una sola linea de ${resuelto.alto} ya no cabe en el hueco de ${topeBloque}`);
      }
      return (
        `Bajado del techo a ${resuelto.alto} dots: ${razones.join("; ")}. ` +
        `Cabe en una sola linea, asi que para mas alto hay que ensanchar la caja.`
      );
    }

    // Rama de varias lineas: aqui el ancho no es el problema (si lo fuera, no habria salida) y
    // el limite que manda es el alto total del bloque, que es lo que impide dos lineas grandes.
    const lineas = Math.min(
      Math.ceil(chars / Math.max(1, Math.floor(caja / Math.max(1, resuelto.ancho)))),
      maxLineas,
    );
    razones.push(`sale en ${lineas} ${lineas === 1 ? "linea" : "lineas"} de ${resuelto.alto} dots`);
    if (topeBloque !== undefined) {
      const bloque = (2 * lineas - 1) * af.maxHeight;
      razones.push(
        `y a ${af.maxHeight} dots de alto el bloque ocuparia ${bloque}, con un hueco de ${topeBloque}`,
      );
      return `Bajado del techo a ${resuelto.alto} dots: ${razones.join("; ")}. ` +
        `Subir el alto no ayuda: el tope lo pone el hueco hasta las barras, no el ancho.`;
    }
    return `Bajado del techo a ${resuelto.alto} dots: ${razones.join("; ")}.`;
  }, [zona, resuelto]);

  const pegables = useMemo(
    () => (preview ? mapearCajas(preview.cajas, zones, preview.resueltos) : []),
    [preview, zones],
  );

  // Arrastre: se guarda de donde se cogio (en dots) y el punto de origen de la zona, para que
  // el elemento no salte bajo el cursor.
  //
  // Va en un REF y no en estado a proposito. El manejador de `mousemove` esta registrado en la
  // ventana desde el principio, asi que no depende de que React haya pintado nada: en un
  // arrastre real el `mousemove` siguiente llega a veces en el mismo tick que el `mousedown`,
  // y con estado ese movimiento se perdia. Ademas el arrastre no necesita re-renderizar nada:
  // el PNG llega por el preview de todos modos.
  const lienzoRef = useRef<HTMLDivElement | null>(null);
  const arrastre = useRef<{
    indice: number;
    /** `null` = mover la zona entera. Con nombre = redimensionar por esa arista. */
    asidera: Asider | null;
    tomaX: number;
    tomaY: number;
    origen: LabelZone;
  } | null>(null);

  /** Posicion del puntero sobre la etiqueta, en dots. */
  const dotsDelPuntero = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const el = lienzoRef.current;
      if (!el) return { dx: 0, dy: 0 };
      const r = el.getBoundingClientRect();
      // El `p-2` del contenedor son 8 px de marco que hay que restar antes de dividir.
      return {
        dx: (e.clientX - r.left - 8) / zoom,
        dy: (e.clientY - r.top - 8) / zoom,
      };
    },
    [zoom],
  );

  const empezarArrastre = useCallback(
    (e: React.MouseEvent) => {
      const objetivo = e.target as HTMLElement;
      // El asa se mira ANTES que la caja: el asa esta DENTRO de la caja, asi que si se
      // buscase la caja primero, tirar de una esquina moveria la zona en vez de estirarla.
      const asa = objetivo.closest<HTMLElement>("[data-asidera]");
      if (asa) {
        const caja = asa.closest<HTMLElement>("[data-caja]");
        if (!caja) return;
        const i = Number(caja.dataset.caja);
        const indice = pegables[i];
        if (indice < 0 || indice !== sel) return;
        e.preventDefault();
        e.stopPropagation();
        const { dx, dy } = dotsDelPuntero(e);
        arrastre.current = {
          indice,
          asidera: asa.dataset.asidera as Asider,
          tomaX: dx,
          tomaY: dy,
          origen: structuredClone(zones[indice]) as unknown as LabelZone,
        };
        return;
      }

      const caja = objetivo.closest<HTMLElement>("[data-caja]");
      if (!caja) return;
      const i = Number(caja.dataset.caja);
      const indice = pegables[i];
      if (indice < 0 || indice !== sel) return;
      e.preventDefault();
      const { dx, dy } = dotsDelPuntero(e);
      arrastre.current = {
        indice,
        asidera: null,
        tomaX: dx,
        tomaY: dy,
        origen: structuredClone(zones[indice]) as unknown as LabelZone,
      };
    },
    [pegables, sel, zones, dotsDelPuntero],
  );

  /**
   * Modulos del simbolo que hay en pantalla ahora mismo.
   *
   * El ancho de las barras es un escalon de `modulos` dots, y cuantos hay lo decide el servidor
   * al elegir la symbologia. Sin este numero, `redimensionar()` no puede pasar de "el rato se
   * ha movido 40 dots" a "`moduleWidth` 4".
   *
   * Se deduce del ancho de simbolo que ya devuelve el preview: `modulos = ancho / moduleWidth`.
   * No hace falta pedirlo aparte, y sale del mismo numero que se ve en el informe.
   */
  const modulosActuales = useMemo(() => {
    if (!preview || preview.anchoSimbolo <= 0) return 0;
    const bz = zones.find((z) => z.kind === "barcode");
    const mw = Number((bz as { moduleWidth?: number } | undefined)?.moduleWidth ?? 0);
    if (mw <= 0) return 0;
    return Math.max(1, Math.round(preview.anchoSimbolo / mw));
  }, [preview, zones]);

  useEffect(() => {
    const mover = (e: MouseEvent) => {
      const a = arrastre.current;
      if (!a) return;
      const { dx, dy } = dotsDelPuntero(e);
      // El desplazamiento se mide en dots y se redondea al dot entero mas cercano: es la
      // unidad que entiende la impresora, y dejar fracciones solo produciria ruido.
      const ex = Math.round(dx - a.tomaX);
      const ey = Math.round(dy - a.tomaY);

      if (a.asidera === null) {
        const x = Math.max(0, a.origen.x + ex);
        const y = Math.max(0, a.origen.y + ey);
        setZones((prev) => prev.map((z, i) => (i === a.indice ? { ...z, x, y } : z)));
        return;
      }

      const nueva = redimensionar(a.origen, a.asidera, ex, ey, {
        modulos: modulosActuales,
        anchoCajaTexto: anchoCajaDeTexto(sel, preview, pegables),
      });
      setZones((prev) => prev.map((z, i) => (i === a.indice ? (nueva as unknown as AnyZone) : z)));
    };
    const soltar = () => {
      arrastre.current = null;
    };
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    return () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    };
  }, [dotsDelPuntero, modulosActuales, sel, preview, pegables]);

  /**
   * La zona seleccionada como bloque de TypeScript para `label.template.ts`.
   *
   * El logo no sale aqui. Su tamano va DENTRO del `^GFA` y no en un campo de la zona, asi que
   * el reescalado produce un bitmap distinto y no un numero que pegar. Se dice en su lugar, con
   * la medida nueva, para que quede claro que el cambio no cabe en un objeto literal y hay que
   * regenerar el dato o usar el boton de aplicar.
   */
  const codigo = useMemo(() => {
    if (!zona) return "";
    const l: string[] = [];
    l.push(`    // ${etiquetaDe(zona, sel)}`);
    if (zona.kind === "shape") {
      l.push(
        `    { kind: "shape", x: ${zona.x}, y: ${zona.y}, widthDots: ${zona.widthDots}, ` +
          `heightDots: ${zona.heightDots}, thicknessDots: ${zona.thicknessDots}` +
          `${zona.radiusDots ? `, radiusDots: ${zona.radiusDots}` : ""} },`,
      );
    } else if (zona.kind === "graphic") {
      const d = graphicDots(String(zona.gf));
      l.push(`    // El logo son ${d.dots?.w ?? 0} x ${d.dots?.h ?? 0} dots ahora mismo.`);
      l.push(`    // Su tamano va dentro del ^GFA, no en la zona, asi que esto no se pega: o se`);
      l.push(`    // regenera con scripts/generate-logo.ps1, o se deja el boton de aplicar, que`);
      l.push(`    // guarda el bitmap reescalado entero.`);
      l.push(`    { kind: "graphic", x: ${zona.x}, y: ${zona.y}, gf: LOGO_GF },`);
    } else if (zona.kind === "barcode") {
      l.push(
        `    { kind: "barcode", x: ${zona.x}, y: ${zona.y}, heightDots: ${zona.heightDots},` +
          ` interpretationLine: true, source: "barcode",` +
          ` center: ${zona.center !== false}, moduleWidth: ${zona.moduleWidth}` +
          `${zona.hriHeightDots !== undefined ? `, hriHeightDots: ${zona.hriHeightDots}` : ""} },`,
      );
    } else {
      const af = zona.autoFit as Record<string, number> | undefined;
      const partes = [`kind: "text"`, `x: ${zona.x}`, `y: ${zona.y}`, `format: "${zona.format}"`];
      if (af) {
        // `maxBlockDots` se emite solo si esta, y no siempre. Es opcional a proposito: lo que
        // falta es que se EMITA, porque el boton de aplicar escribe este codigo entero en
        // `label.template.ts`. Si el generador se come un campo, mover una zona en el editor
        // borra ese campo de la plantilla sin que nadie lo note: el nombre volveria a
        // minusculas y perderia el tope de alto del bloque, y el codigo seguiria compilando y
        // la etiqueta seguiria imprimiendose, solo que distinta.
        partes.push(
          `autoFit: { maxHeight: ${af.maxHeight}, minHeight: ${af.minHeight},` +
            ` widthRatio: ${af.widthRatio}` +
            `${af.maxBlockDots !== undefined ? `, maxBlockDots: ${af.maxBlockDots}` : ""} }`,
        );
      } else partes.push(`format: "^A0N${String(zona.format).slice(4)}"`);
      partes.push(`source: "${zona.source}"`);
      l.push(`    { ${partes.join(", ")},`);
      if (zona.prefix) l.push(`      prefix: "${zona.prefix}",`);
      if (zona.uppercase) l.push(`      uppercase: true,`);
      if (zona.maxWidthDots !== undefined) l.push(`      maxWidthDots: ${zona.maxWidthDots},`);
      if (zona.maxLines !== undefined) l.push(`      maxLines: ${zona.maxLines},`);
      if (zona.justify) l.push(`      justify: "${zona.justify}",`);
      l[l.length - 1] = l[l.length - 1].replace(/,$/, " },");
      l[l.length - 1] = l[l.length - 1].replace(/,\s*},$/, " },");
    }
    return l.join("\n");
  }, [zona, sel]);

  // La misma regla que usa el endpoint de guardar, desde el mismo modulo. Si aqui se aceptara
  // algo que el servidor luego rechaza con un 422, el boton de aplicar pareceria roto sin que
  // hubiera forma de saber cual de los dos se equivoca.
  const solapes = useMemo(
    () =>
      preview
        ? buscarProblemas(preview.cajas, DEFAULT_TEMPLATE.widthDots, DEFAULT_TEMPLATE.heightDots)
        : [],
    [preview],
  );

  /**
   * Lineas del informe que describen algo que NO se ha dibujado.
   *
   * El render puede salir bien y aun asi no haber pintado una zona: un `^GFA` que no llega al
   * ZPL, un bitmap vacio, una medida que no se puede leer. La etiqueta se ve medio en blanco y
   * el informe lo dice en una linea de texto pequeno, que es justo el sitio donde no se lee
   * nada. Por eso se sacan aparte.
   */
  const avisos = useMemo(() => {
    if (!preview) return [];
    return preview.informe.filter((l) => /\bNO\b|EN BLANCO/.test(l));
  }, [preview]);

  return (
    <main className="flex flex-col gap-6">
      <section className={card + " p-5"}>
        <h2 className={h2}>Editor de plantilla</h2>
        <p className="mt-1 text-sm text-ink-soft">
          El dibujo sale del mismo codigo que genera el ZPL, asi que lo que ves aqui es lo que
          se imprime. Todo se mueve y se redimensiona arrastrando. Con el boton de{" "}
          <strong>Aplicar cambios</strong> el cambio vale para imprimir al instante; el bloque de
          TypeScript de abajo es para llevarlo al codigo.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
        {/* ------------------------------------------------------------- controles */}
        <section className="flex flex-col gap-4">
          <div className={card + " p-4"}>
            <h3 className={`mb-2 ${h3}`}>Zonas</h3>
            <div className="flex flex-col gap-1">
              {zones.map((z, i) => {
                const activa = i === sel;
                const editable = EDITABLES.has(z.kind);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!editable}
                    onClick={() => setSel(i)}
                    className={`rounded px-2 py-1.5 text-left text-sm ${
                      activa
                        ? "bg-brand text-white"
                        : editable
                          ? "bg-surface-sunken text-ink hover:bg-line"
                          : "bg-surface text-ink-mute"
                    }`}
                  >
                    {etiquetaDe(z, i)}
                  </button>
                );
              })}
            </div>
          </div>

          {zona && EDITABLES.has(zona.kind) && (
            <div className={card + " p-4"}>
              <h3 className={`mb-3 ${h3}`}>
                {etiquetaDe(zona, sel)}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Num
                  label="X (mm)"
                  value={MM(Number(zona.x))}
                  onChange={(v) => editar(sel, { x: DOTS(v) })}
                />
                <Num
                  label="Y (mm)"
                  value={MM(Number(zona.y))}
                  onChange={(v) => editar(sel, { y: DOTS(v) })}
                />
              </div>

              {/* El marco (`kind: "shape"`) no tiene panel, y no es un olvido: ya no es
                  editable. Tenia sus numeros de ancho, alto, grosor y esquina, y se han
                  quitado con el resto. Su medida sale de la plantilla, asi que un panel de
                  esos seria un formulario para desincronizar el marco de lo que se imprime. */}

              {zona.kind === "graphic" && (
                <>
                  {(() => {
                    const d = graphicDots(String(zona.gf));
                    return (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Num
                          label="ancho logo (mm)"
                          value={MM(d.dots?.w ?? 0)}
                          onChange={(v) => editarLogo(sel, v, null)}
                        />
                        <Num
                          label="alto logo (mm)"
                          value={MM(d.dots?.h ?? 0)}
                          onChange={(v) => editarLogo(sel, null, v)}
                        />
                      </div>
                    );
                  })()}
                  <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                    El logo es un bitmap dentro del <code>^GFA</code>, no una imagen con tamano
                    aparte: el ancho se ajusta al multiplo de 8 mas cercano porque cada byte son 8
                    dots. Al cambiarlo se reescala manteniendo la proporcion, con vecino mas
                    proximo y sin suavizado, que es lo unico que una impresora termica de 203 dpi
                    sabe hacer.
                  </p>
                </>
              )}

              {zona.kind === "barcode" ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Num
                      label="alto barra (mm)"
                      step={0.5}
                      value={MM(Number(zona.heightDots))}
                      onChange={(v) => editar(sel, { heightDots: DOTS(v) })}
                    />
                    <Num
                      label="linea bajo (mm)"
                      step={0.25}
                      value={MM(Number(zona.hriHeightDots ?? 14))}
                      onChange={(v) => editar(sel, { hriHeightDots: DOTS(v) })}
                    />
                  </div>
                  <Num
                    label="ancho de modulo (dots)"
                    step={1}
                    value={Number(zona.moduleWidth)}
                    onChange={(v) => editar(sel, { moduleWidth: v })}
                  />
                  <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                    El minimo de ISO/IEC 15420 son 0,264 mm: 3 dots son 0,375 mm y 2 dots son
                    0,250 mm, por debajo. Con 2 hay que leer en fisico antes de dejarlo.
                  </p>
                </>
              ) : zona.kind === "text" ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Num
                      label="alto letra (mm)"
                      step={0.25}
                      value={altoDeFuente(zona)}
                      onChange={(v) => editarFuente(sel, v)}
                    />
                    <Num
                      label="ancho letra (mm)"
                      step={0.25}
                      value={anchoDeFuente(zona)}
                      onChange={(v) => editarFuenteAncho(sel, v)}
                    />
                  </div>
                  {zona.autoFit ? (
                    <>
                      {resuelto && resuelto.texto !== null && (
                        <div className="mt-3 rounded-md border border-ok-line bg-ok-soft px-3 py-2">
                          <p className="text-xs font-semibold text-ok">
                            Con este nombre sale asi
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-ok">
                            {resuelto.texto}
                          </p>
                          <p className="mt-1 text-xs text-ok">
                            alto {MM(resuelto.alto).toFixed(2)} mm ({resuelto.alto} dots), ancho
                            de letra {MM(resuelto.ancho).toFixed(2)} mm ({resuelto.ancho} dots)
                          </p>
                          {porQueSeBajo && (
                            <p className="mt-1 text-xs text-ok">{porQueSeBajo}</p>
                          )}
                        </div>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Num
                          label="alto maximo (mm)"
                          step={0.25}
                          value={MM((zona.autoFit as Record<string, number>).maxHeight)}
                          onChange={(v) => editarAutoFit(sel, { maxHeight: DOTS(v) })}
                        />
                      <Num
                          label="alto minimo (mm)"
                          step={0.25}
                          value={MM((zona.autoFit as Record<string, number>).minHeight)}
                          onChange={(v) => editarAutoFit(sel, { minHeight: DOTS(v) })}
                        />
                      <Num
                          label="condensado (widthRatio)"
                          step={0.01}
                          value={(zona.autoFit as Record<string, number>).widthRatio}
                          onChange={(v) => editarAutoFit(sel, { widthRatio: v })}
                        />
                      </div>
                      {(zona.autoFit as Record<string, number>).maxBlockDots !== undefined && (
                        <Num
                          label="alto del bloque (mm)"
                          step={0.25}
                          value={MM((zona.autoFit as Record<string, number>).maxBlockDots!)}
                          onChange={(v) => editarAutoFit(sel, { maxBlockDots: DOTS(v) })}
                        />
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-warn">
                      Esta zona no tiene autoFit: el alto de letra es el que pongas, fijo.
                    </p>
                  )}
                  <Num
                    label="ancho de caja (mm)"
                    step={0.5}
                    value={zona.maxWidthDots === undefined ? 0 : MM(Number(zona.maxWidthDots))}
                    onChange={(v) =>
                      editar(sel, { maxWidthDots: v > 0 ? DOTS(v) : undefined })
                    }
                  />
                </>
              ) : null}

              {/* Lo que las asas hacen de verdad en ESTA zona. Sin esto, tirar de un tirador y
                  que no pase nada parece un fallo del editor, y en el codigo de barras y en el
                  logo es justo lo que pasa a proposito. */}
              {zonaEjes?.nota && (
                <p className="mt-3 rounded-md border border-warn-line bg-warn-soft px-2 py-1.5 text-[11px] text-warn">
                  {zonaEjes.nota}
                </p>
              )}
            </div>
          )}

          {/* ------------------------------------------------------ datos de prueba */}
          <div className={card + " p-4"}>
            <h3 className={`mb-3 ${h3}`}>Datos de prueba</h3>
            <label className="mb-1 block text-xs text-ink-soft">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={input}
            />
            <label className="mb-1 mt-2 block text-xs text-ink-soft">Codigo de barras</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className={input}
            />
            <label className="mb-1 mt-2 block text-xs text-ink-soft">Precio</label>
            <input
              type="number"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(Number(e.target.value))}
              className={input}
            />
            <p className="mt-2 text-xs leading-relaxed text-ink-mute">
              Prueba con un nombre corto y con uno de 50 caracteres. El alto de letra sale
              distinto en cada caso: esa es la gracia del autoFit.
            </p>
          </div>

          {/* ------------------------------------------------------------ aplicar */}
          <div className={card + " border-2 border-brand-ink/20 p-4"}>
            <h3 className={`mb-2 ${h3}`}>Aplicar</h3>
            <p className="mb-3 text-xs leading-relaxed text-ink-soft">
              Guarda estos valores y a partir de ya imprimen. No toca{" "}
              <code>label.template.ts</code>: se guardan en{" "}
              <code>data/plantilla-override.json</code>, que se aplica encima de la plantilla del
              codigo. Borrar ese archivo, o el boton de abajo, vuelve a como estaba.
            </p>

            {aplicado && (
              <div className="mb-3 rounded-md border border-ok-line bg-ok-soft px-3 py-2">
                <p className="text-xs font-semibold text-ok">{aplicado}</p>
                {guardado && (
                  <p className="mt-0.5 font-mono text-[11px] text-ok">
                    data/plantilla-override.json · {guardado.savedAt}
                  </p>
                )}
              </div>
            )}
            {rechazo && (
              <div className="mb-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2">
                <p className="text-xs font-semibold text-danger">{rechazo}</p>
                {rechazoDetalle.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-danger">
                    {rechazoDetalle.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={aplicar}
              disabled={aplicando}
              className={`${buttonPrimary} w-full`}
            >
              {aplicando ? "guardando..." : "Aplicar cambios"}
            </button>

            {hayOverride && (
              <button
                type="button"
                onClick={descartar}
                disabled={aplicando}
                className={`${buttonQuiet} mt-2 w-full`}
              >
                Descartar y volver al codigo
              </button>
            )}

            {hayOverride && !aplicado && (
              <p className="mt-2 text-[11px] text-warn">
                Hay cambios guardados que todavia no has aplicado en pantalla. Si aplicas ahora,
                se reemplazan.
              </p>
            )}
          </div>

          {/* ------------------------------------------------------------ salida */}
          <div className={card + " p-4"}>
            <h3 className={`mb-2 ${h3}`}>
              Valor para label.template.ts
            </h3>
            <textarea
              readOnly
              value={codigo}
              rows={8}
              className="w-full rounded-md border border-line bg-surface-sunken p-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(codigo)}
              className={`${buttonGhost} mt-2 w-full`}
            >
              Copiar
            </button>
            <p className="mt-2 text-xs leading-relaxed text-ink-mute">
              Pega esto en el <code>zones</code> de <code>label.template.ts</code>, en el
              lugar de la zona que estes moviendo.
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------------- dibujo */}
        <section className="flex flex-col gap-3">
          <div className={card + " flex items-center gap-4 px-4 py-2"}>
            <label className="text-xs text-ink-soft">
              Zoom
              <input
                type="range"
                min={1}
                max={6}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="ml-2"
              />
              <span className="ml-1">{zoom}x</span>
            </label>
            <label className="text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={mostrarCajas}
                onChange={(e) => setMostrarCajas(e.target.checked)}
                className="mr-1"
              />
              ver cajas
            </label>
            <span className="text-xs text-ink-mute">
              Elige una zona, arrastra su caja para moverla y tira de los puntos blancos de las
              esquinas o los bordes para cambiarle el tamano. Vale para el logo, los textos y
              las barras. <strong>El marco no</strong>: es el margen del papel y se calcula
              solo desde el ancho de la etiqueta.
            </span>
            <span className="text-xs text-ink-mute">
              {DEFAULT_TEMPLATE.widthMm} x {DEFAULT_TEMPLATE.heightMm} mm ={" "}
              {DEFAULT_TEMPLATE.widthDots} x {DEFAULT_TEMPLATE.heightDots} dots
            </span>
            {busy && <span className="text-xs text-brand">calculando...</span>}
          </div>

          {error && (
            <p className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {solapes.length > 0 && (
            <div className="rounded-md border border-warn-line bg-warn-soft px-3 py-2">
              <p className="text-sm font-semibold text-warn">
                Con estos valores algo se pisa o se sale de la etiqueta
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs text-warn">
                {solapes.map((s, i) => (
                  <li key={i}>{s.mensaje}</li>
                ))}
              </ul>
            </div>
          )}

          {preview && (
            <div
              ref={lienzoRef}
              className="relative inline-block select-none rounded-lg border border-line-strong bg-white p-2 shadow-card"
              onMouseDown={empezarArrastre}
            >
              <img
                src={`data:image/png;base64,${preview.png}`}
                width={DEFAULT_TEMPLATE.widthDots * zoom}
                height={DEFAULT_TEMPLATE.heightDots * zoom}
                alt="Previsualizacion de la etiqueta"
                draggable={false}
              />
              {mostrarCajas &&
                preview.cajas.map((c, i) => {
                  // Solo se puede arrastrar la caja que corresponde a la zona seleccionada, y
                  // solo si esa zona es editable.
                  const pegable = pegables[i] === sel;
                  const nota = pegable && zona ? ejesRedimensionables(zona as unknown as LabelZone) : null;
                  // Las asas de un eje que la zona no admite no se dibujan. Un tirador que no
                  // hace nada parece un fallo del editor, y para el codigo de barras hay una
                  // razon de peso: el ancho del simbolo lo fijan los modulos de la
                  // simbologia (95 en EAN-13) por el ancho de modulo, que es un numero entero,
                  // asi que un tirador de ancho solo podria ofrecer 190 o 285 dots y nada en
                  // medio.
                  const asas: Asider[] = !nota
                    ? []
                    : ASIDERES.filter((a) => {
                        const horizontal = a === "e" || a === "w";
                        const vertical = a === "n" || a === "s";
                        const esquina = !horizontal && !vertical;
                        // Una esquina arrastra los dos ejes a la vez. Si la zona no admite uno,
                        // la esquina no se ofrece: estirarla solo deformaria el elemento.
                        if (esquina) return nota.x && nota.y;
                        return horizontal ? nota.x : nota.y;
                      });
                  return (
                    <div
                      key={i}
                      data-caja={i}
                      className={
                        pegable
                          ? "absolute cursor-move border-2 border-dashed border-brand"
                          : "pointer-events-none absolute border border-dashed border-brand/55"
                      }
                      style={{
                        left: `${c.x0 * zoom + 8}px`,
                        top: `${c.y0 * zoom + 8}px`,
                        width: `${(c.x1 - c.x0) * zoom}px`,
                        height: `${(c.y1 - c.y0) * zoom}px`,
                      }}
                    >
                      <span
                        className={`absolute -top-4 left-0 whitespace-nowrap px-1 text-[10px] text-white ${
                          pegable ? "bg-brand" : "bg-brand/70"
                        }`}
                      >
                        {c.texto ?? c.etiqueta} · x{c.x0}-{c.x1} y{c.y0}-{c.y1}
                        {pegable && (asas.length > 0 ? " · arrastra o estira" : " · arrastra")}
                      </span>
                      {asas.map((a) => (
                        <div
                          key={a}
                          data-asidera={a}
                          title={TITULO_ASIDERA[a]}
                          className={`absolute h-3 w-3 rounded-sm border border-brand bg-white ${
                            CURSA_ASIDERA[a]
                          }`}
                          style={{
                            left: `${POS_ASIDERA[a].x * 100}%`,
                            top: `${POS_ASIDERA[a].y * 100}%`,
                            // El asa va ENCIMA del borde, no pegada dentro: tiene que caer justo
                            // sobre la linea que estira, que es donde el raton ya esta.
                            marginLeft: -6,
                            marginTop: -6,
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
            </div>
          )}

          {preview && (
            <div className={card + " p-4"}>
              <h3 className={`mb-2 ${h3}`}>Informe</h3>

              {/* Fallos de dibujado, arriba y en grande.
                  Lo que dice "NO" o "EN BLANCO" significa que hay algo que NO se ha pintado en
                  la pantalla, y por lo tanto esta differente de lo que va a salir. Abajo, en el
                  `<pre>`, esa linea se leeria como un dato mas entre otros, y justo estos son
                  los que no se pueden perder de vista. */}
              {avisos.length > 0 && (
                <ul className="mb-3 list-disc space-y-1 rounded-md border border-danger-line bg-danger-soft px-3 py-2 pl-6 text-xs text-danger">
                  {avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              )}

              <pre className="whitespace-pre-wrap font-mono text-xs text-ink-soft">
                {[
                  `symbologia: ${preview.symbology ?? "-"}`,
                  `datos impresos: ${preview.datosImpresos ?? "-"}`,
                  `ancho del simbolo: ${preview.anchoSimbolo} dots (${MM(preview.anchoSimbolo).toFixed(1)} mm)`,
                  `zona quieta: ${preview.zonaQuieta} dots`,
                  "",
                  ...preview.informe,
                ].join("\n")}
              </pre>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function altoDeFuente(z: AnyZone): number {
  if (z.autoFit) return MM((z.autoFit as Record<string, number>).maxHeight);
  const m = String(z.format ?? "").match(/\^A0N,(\d+),/);
  return m ? MM(Number(m[1])) : 0;
}

function anchoDeFuente(z: AnyZone): number {
  if (z.autoFit) return MM(Math.round(altoDeFuente(z) * MM_TO_DOTS * Number((z.autoFit as Record<string, number>).widthRatio)));
  const m = String(z.format ?? "").match(/\^A0N,(\d+),(\d+)/);
  return m ? MM(Number(m[2])) : 0;
}

/** Cambia el alto de fuente. Con `autoFit` manda sobre `format`; sin el, cambia `format`. */
function conAltoDeFuente(z: AnyZone, mm: number): AnyZone {
  const alto = DOTS(mm);
  if (z.autoFit) {
    const af = z.autoFit as Record<string, number>;
    const ancho = Math.max(1, Math.round(alto * af.widthRatio));
    return { ...z, autoFit: { ...af, maxHeight: alto }, format: `^A0N,${alto},${ancho}` };
  }
  const actualAncho = Number(String(z.format ?? "").match(/\^A0N,(\d+),(\d+)/)?.[2] ?? 1);
  const actualAlto = Number(String(z.format ?? "").match(/\^A0N,(\d+),/)?.[1] ?? 1);
  // El ancho de caracter sigue la misma proporcion que el alto, para no deformar la letra.
  const ancho = Math.max(1, Math.round((actualAncho * alto) / Math.max(1, actualAlto)));
  return { ...z, format: `^A0N,${alto},${ancho}` };
}

/** Cambia solo el ancho de caracter, dejando el alto como estaba. */
function conAnchoDeFuente(z: AnyZone, mm: number): AnyZone {
  const ancho = DOTS(mm);
  const alto = Number(String(z.format ?? "").match(/\^A0N,(\d+),/)?.[1] ?? 14);
  return { ...z, format: `^A0N,${alto},${ancho}` };
}

function conAutoFit(z: AnyZone, cambio: Record<string, number>): AnyZone {
  const af = (z.autoFit ?? { maxHeight: 32, minHeight: 13, widthRatio: 0.5 }) as Record<
    string,
    number
  >;
  return { ...z, autoFit: { ...af, ...cambio } };
}

function Num({
  label,
  value,
  onChange,
  step = 0.25,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="mt-2">
      <label className="mb-1 block text-xs text-ink-soft">{label}</label>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={input}
      />
    </div>
  );
}