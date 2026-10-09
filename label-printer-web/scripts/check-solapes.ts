// Comprueba la regla de solapes de las cajas de la etiqueta.
//
//   tsc -p tsconfig.preview.json
//   node .preview-build/scripts/check-solapes.js
//
// POR QUE ESTA SEPARADO
//
// Esta regla la usan tres: la pantalla del editor, el endpoint que guarda y el script de zonas.
// Si se copia tres veces, un dia el editor dice "no hay choques" con una cuenta y el servidor
// responde 422 con otra, y el boton de aplicar parece roto sin saber cual de los dos miente.
//
// Y YA HA PASADO UNA VEZ, con este caso: al anadir el marco a las cajas (para que se pudiera
// arrastrar, que antes no se podia), el texto que va DENTRO del marco salio como "pisa a". El
// marco contiene al texto, no lo pisa. Una plantilla que lleva v1.0 dibuja el marco rodeando
// todo lo demas, asi que el aviso salia siempre, en todas las etiquetas, y era mentira.
import { buscarProblemas, contiene, intersectan } from "../src/lib/labels/label-solapes";
import type { Caja } from "../src/lib/labels/label-solapes";
import { renderLabel } from "../src/lib/labels/label.render";
import { DEFAULT_TEMPLATE } from "../src/lib/labels/label.template";

let pruebas = 0;
let fallos = 0;

function ok(nombre: string, cond: boolean, detalle = ""): void {
  pruebas++;
  if (cond) return;
  fallos++;
  console.log(`  FALLA  ${nombre}${detalle ? `  ->  ${detalle}` : ""}`);
}

function eq(nombre: string, obtenido: unknown, esperado: unknown): void {
  ok(
    nombre,
    obtenido === esperado,
    `obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)}`,
  );
}

const caja = (
  etiqueta: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  extra: Partial<Caja> = {},
): Caja => ({ etiqueta, x0, y0, x1, y1, ...extra });

/** Marco de 59 x 35 mm con 1 dot de grosor, como el de la plantilla (`thicknessDots: 1`). */
const MARCO = caja("marco", 8, 8, 464, 272, { grosorDots: 1 });

// ------------------------------------------------------------------- predicados sueltos

console.log("Predicados");
{
  const grande = caja("marco", 0, 0, 100, 100);
  const dentro = caja("texto", 10, 10, 50, 50);
  const cruzado = caja("barras", 90, 40, 200, 60);
  const aparte = caja("precio", 200, 200, 300, 220);

  ok("dos rectangulos juntos se tocan", intersectan(grande, dentro));
  ok("uno dentro del otro se contiene", contiene(grande, dentro));
  ok("al reves no", !contiene(dentro, grande));

  // `intersectan()` no perdona la contencion, y a proposito: entre contenido, un texto
  // metido dentro de las barras esta ENCIMA de las barras. Que lo salto esto fue un fallo de
  // la regla, no un caso raro.
  eq("dentro de las barras sigue siendo solape", intersectan(grande, dentro), true);
  eq("cruzar si es solape", intersectan(grande, cruzado), true);
  eq("separados no se tocan", intersectan(grande, aparte), false);

  // Solo tocarse por un punto no es solape: no hay area comun. Un texto pegado al borde del
  // marco por un unico dot no se pisa con el, y avisar de eso haria que no se pudiera colocar
  // nada pegado al borde, que es justo lo que se quiere poder hacer.
  const pegado = caja("texto", 100, 10, 150, 50);
  eq("tocarse en un punto no es solape", intersectan(grande, pegado), false);

  // Un texto pegado por un dot de SOLAPO si es solape, y con razon: ese dot se imprime dos
  // veces.
  const rozando = caja("texto", 99, 10, 150, 50);
  eq("un dot de solape si cuenta", intersectan(grande, rozando), true);
}

// ---------------------------------------------------------------- el caso que se rompio

console.log("El contenido dentro del marco no es un choque");
{
  // Geometria de la plantilla tal cual, toda dentro del marco (8,20..464,272, hueco 3 dots mas
  // dentro). No puede haber ni un aviso: si lo hay, es que se esta avisando de una plantilla
  // que lleva v1.0 en la pared.
  const cajas = [
    MARCO,
    caja("logo", 136, 20, 336, 87),
    caja("texto", 64, 92, 406, 128, { texto: "BADIA JALAPENO 2 OZ" }),
    caja("barras", 94, 150, 379, 228),
    caja("texto", 240, 236, 276, 254, { texto: "REF:" }),
    caja("texto", 288, 230, 373, 260, { texto: "$5.68" }),
  ];
  const p = buscarProblemas(cajas, 472, 280);
  eq("la plantilla de serie no da ni un aviso", p.length, 0);

  // Y con el texto largo, que es el caso que mas alto de letra pide.
  const largo = buscarProblemas(
    [
      MARCO,
      caja("logo", 136, 20, 336, 87),
      caja("texto", 64, 92, 406, 146, { texto: "PECHUGA DE POLLO CON AJO Y CEBOLLA FRITA" }),
      caja("barras", 94, 150, 379, 228),
    ],
    472,
    280,
  );
  eq("con nombre de 40 caracteres tampoco", largo.length, 0);

  // El marco de verdad va en 8,8, no en 8,20: el logo arranca en 20 porque esta dentro, no
  // porque el marco este ahi. Con el marco bien puesto, todo el contenido cabe por dentro.
  const p2 = buscarProblemas(
    [
      MARCO,
      caja("logo", 136, 20, 336, 87),
      caja("texto", 64, 92, 406, 128, { texto: "ACEITE" }),
      caja("barras", 94, 150, 379, 228),
      caja("texto", 240, 236, 276, 254, { texto: "REF:" }),
      caja("texto", 288, 230, 373, 260, { texto: "$5.68" }),
    ],
    472,
    280,
  );
  eq("la geometria exacta del render tampoco da avisos", p2.length, 0, );
}

// ------------------------------------------------------------------------- choques reales

console.log("Los choques de verdad se siguen viendo");
{
  // Texto encima de las barras: el fallo clasico, el precio sobre el nombre.
  const p = buscarProblemas(
    [MARCO, caja("barras", 94, 150, 379, 228), caja("texto", 100, 160, 300, 200, { texto: "$5.68" })],
    472,
    280,
  );
  ok("texto encima de las barras se avisa", p.some((x) => x.tipo === "solape"), JSON.stringify(p.map((x) => x.mensaje)));

  // Y el caso que hizo cambiar la regla: un texto COMPLETAMENTE dentro de las barras, sin
  // salirse por ningun lado. Antes esto se callaba, porque la regla de contencion se aplicaba a
  // todo. Es el peor de los dos fallos: el precio metido entre las barras no se ve mirando la
  // caja, sale en el papel encima del codigo y el codigo ya no escanea.
  const dentroDeLasBarras = buscarProblemas(
    [MARCO, caja("barras", 94, 150, 379, 228), caja("texto", 180, 180, 260, 200, { texto: "$5.68" })],
    472,
    280,
  );
  ok("texto metido entre las barras se avisa", dentroDeLasBarras.some((x) => x.tipo === "solape"), JSON.stringify(dentroDeLasBarras.map((x) => x.mensaje)));

  // Logo encima del marco: se sale por arriba del todo.
  const fueraArriba = buscarProblemas([MARCO, caja("logo", 100, 2, 300, 69)], 472, 280);
  ok("logo que se sale por arriba se avisa", fueraArriba.length > 0);

  // Una zona que se sale del rollo por la derecha.
  const derecha = buscarProblemas([MARCO, caja("texto", 400, 100, 500, 130, { texto: "$5.68" })], 472, 280);
  ok("zona fuera del rollo se avisa", derecha.some((x) => x.tipo === "fuera"), JSON.stringify(derecha.map((x) => x.mensaje)));

  // Posicion negativa: se sale por la izquierda, que es lo que pasa al arrastrar a un borde.
  const izquierda = buscarProblemas([MARCO, caja("texto", -5, 100, 200, 130, { texto: "X" })], 472, 280);
  ok("zona a la izquierda del rollo se avisa", izquierda.some((x) => x.tipo === "fuera"));
}

// ----------------------------------------------------------------------- el marco suelto

console.log("Un marco desplazado se nota");
{
  // El marco se ha movido y el contenido se ha quedado donde estaba: no hay cruce, hay una
  // zona que se ha quedado fuera del todo. Con la regla de "solo se avisan los cruces", esto
  // pasaria, que es una plantilla que no vale y no dice nada.
  const fueraDelMarco = buscarProblemas(
    [caja("marco", 8, 8, 140, 140, { grosorDots: 1 }), caja("texto", 200, 100, 400, 140, { texto: "$5.68" })],
    472,
    280,
  );
  ok("contenido fuera del marco se avisa", fueraDelMarco.some((x) => x.tipo === "marco"), JSON.stringify(fueraDelMarco.map((x) => x.mensaje)));

  // Y el caso de verdad grave: texto tumbado encima del BORDE. Contra el rectangulo entero
  // parece que esta dentro; contra el hueco, que es lo que se imprime, se sale. Con el grosor
  // real de la plantilla, que es de 1 dot, el error es de un solo dot y no se ve de ninguna
  // manera en la pantalla. Por eso el grosor va en la caja.
  const sobreElBorde = buscarProblemas(
    [caja("marco", 8, 8, 464, 272, { grosorDots: 1 }), caja("texto", 8, 100, 200, 130, { texto: "$5.68" })],
    472,
    280,
  );
  ok("texto tumbado en el borde se avisa", sobreElBorde.some((x) => x.tipo === "marco"), JSON.stringify(sobreElBorde.map((x) => x.mensaje)));

  // Un texto pegado justo al borde INTERIOR entra: no se sale ni un dot. Este es el caso que
  // hay que dejar pasar, porque poner el contenido pegado al marco es lo que se quiere poder
  // hacer, y con un margen inventado el aviso seria una molestia.
  const justo = buscarProblemas(
    [caja("marco", 8, 8, 464, 272, { grosorDots: 1 }), caja("texto", 9, 100, 200, 130, { texto: "$5.68" })],
    472,
    280,
  );
  eq("pegado al borde interior no se avisa", justo.length, 0);
  const fueraPorUnDot = buscarProblemas(
    [caja("marco", 8, 8, 464, 272, { grosorDots: 1 }), caja("texto", 8, 100, 200, 130, { texto: "$5.68" })],
    472,
    280,
  );
  ok("1 dot antes del borde ya pisa el marco", fueraPorUnDot.some((x) => x.tipo === "marco"));

  // Sin `grosorDots` en la caja no se puede calcular el hueco. Se asume 1 dot, que es lo mas
  // fino posible: asi el marco perdona lo minimo y el error va hacia "avisar de mas", que es
  // el lado que no deja pasar una etiqueta mala.
  const sinGrosor = buscarProblemas(
    [caja("marco", 8, 8, 464, 272), caja("texto", 8, 100, 200, 130, { texto: "$5.68" })],
    472,
    280,
  );
  ok("sin grosor se asume 1 dot y se avisa igual", sinGrosor.some((x) => x.tipo === "marco"));

  // Una zona metida ENTERA en la banda del borde, sin asomar al hueco, tambien se avisa: son
  // unos pocos dots de marco y 300 de texto invisible encima.
  const enLaBanda = buscarProblemas(
    [caja("marco", 8, 8, 464, 272, { grosorDots: 1 }), caja("texto", 8, 8, 200, 8, { texto: "X" })],
    472,
    280,
  );
  ok("zona metida en el borde se avisa", enLaBanda.some((x) => x.tipo === "marco"));
}

// ----------------------------------------------------------------- sin marco en la plantilla

console.log("Plantillas sin marco");
{
  // Si no hay marco, el contenido se comprueba solo contra si mismo y contra el rollo. Nada
  // de "fuera del marco", porque no hay marco: esa comprobacion no puede inventarse.
  const p = buscarProblemas(
    [caja("texto", 64, 92, 406, 128, { texto: "PRODUCTO" }), caja("barras", 94, 150, 379, 228)],
    472,
    280,
  );
  eq("sin marco, dos zonas separadas no dan aviso", p.length, 0);
  const cruzado = buscarProblemas(
    [caja("texto", 64, 92, 406, 128, { texto: "PRODUCTO" }), caja("barras", 94, 100, 379, 228)],
    472,
    280,
  );
  ok("sin marco, cruzadas si", cruzado.some((x) => x.tipo === "solape"));
}

// --------------------------------------------------------- con el render de verdad de la app

console.log("Con el render real de la plantilla");
{
  // La prueba de que la regla sirve de algo: el render de la plantilla tal cual esta, con los
  // seis nombres representativos del catalogo, no puede dar ni un aviso. Es la garantia de
  // que el boton de aplicar no va a rechazar la plantilla de siempre.
  const NOMBRES = [
    "ACEITE",
    "PECHUGA DE POLLO",
    "JAMON COCIDO 500G PAVO QUINT",
    "YOGURT NATURAL 500ML Y FLAVOR",
    "PECHUGA DE POLLO CON AJO Y CEBOLLA FRITA",
  ];
  for (const nombre of NOMBRES) {
    const r = renderLabel(
      DEFAULT_TEMPLATE,
      {
        productName: nombre,
        barcode: "033844007522",
        price: 5.68,
        reference: "RETAIL",
        businessName: "PA PICAR",
      },
      { scale: 1, grid: false },
    );
    const p = buscarProblemas(r.cajas, DEFAULT_TEMPLATE.widthDots, DEFAULT_TEMPLATE.heightDots);
    eq(`"${nombre}" sin avisos`, p.length, 0);
  }

  // Y que el marco salga de verdad en las cajas del render, con su grosor. Si `grosorDots` no
  // llegara, la regla del interior estaria midiendo contra el rectangulo entero y aceptando
  // texto tumbado en el borde, que es justo el fallo que se quiere cazar.
  const r = renderLabel(
    DEFAULT_TEMPLATE,
    { productName: "ACEITE", barcode: "033844007522", price: 5.68, reference: "RETAIL", businessName: "PA PICAR" },
    { scale: 1, grid: false },
  );
  const marco = r.cajas.find((c) => c.etiqueta === "marco");
  ok("el marco sale en las cajas del render", marco !== undefined);
  ok("y trae su grosor", typeof marco?.grosorDots === "number" && (marco?.grosorDots ?? 0) > 0, `${marco?.grosorDots}`);
}

console.log(`\n${pruebas} comprobaciones, ${fallos} fallos`);
if (fallos > 0) {
  console.log("HAY FALLOS");
  process.exit(1);
}
console.log("Contener no es pisar, y lo que de verdad se pisa se sigue viendo.");
