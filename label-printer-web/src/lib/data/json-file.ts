/**
 * Lectura de archivos de datos de la app.
 *
 * Existe por un motivo concreto y medido: `settings.json` y `catalog.json` los edita gente
 * desde Windows, y cualquier editor de los habituales (PowerShell con
 * `-Encoding UTF8`, Notepad en algunos Windows, Excel) escribe un **BOM** UTF-8 al
 * principio. `JSON.parse` no lo acepta y revienta con
 *
 *     Unexpected token '﻿', "﻿{"a":1}" is not valid JSON
 *
 * que no dice nada util. Sin este arreglo, un archivo bien formado deja la app entera sin
 * configuracion, y lo que se ve en pantalla es un error 500 sin relacion aparente con haber
 * tocado nada.
 *
 * Ojo: `String.prototype.trim()` **si** quita el BOM, asi que los archivos que ya se leen
 * linea a linea (el historial) no tienen este problema.
 */

/** Marca de orden de bytes UTF-8, tal y como la decodifica Node: U+FEFF. */
const BOM = "﻿";

/** Quita el BOM inicial si lo hay. Si no lo hay, devuelve el texto tal cual. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Message para explicar un JSON invalido sin culpar a la sintaxis a ciegas. */
export function describeJsonError(file: string, raw: string, err: unknown): string {
  const motivo = (err as Error).message;
  if (raw.charCodeAt(0) === 0xfeff) {
    return `${file} tiene una marca BOM (UTF-8 con BOM) al principio y JSON no la entiende. ` +
      `Guardalo sin BOM: en PowerShell, [IO.File]::WriteAllText($ruta, $texto, (New-Object Text.UTF8Encoding $false))`;
  }
  return `${file} no es JSON valido: ${motivo}`;
}
