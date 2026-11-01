// Genera una copia de la portada oficial con el titulo y la fecha del reporte
// de avance. Solo se tapan esas dos lineas y se redibujan centradas; los
// logotipos y el resto del diseno quedan intactos.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = resolve('C:/Users/unice/proyectos/SugoiNote');
const base = join(process.env.TEMP ?? '', 'opencode', 'pdfgen', 'node_modules');
const { PDFDocument, StandardFonts, rgb } = await import(pathToFileURL(join(base, 'pdf-lib', 'cjs', 'index.js')).href).then(
  (m) => m.default ?? m,
);

const ORIGEN = join(raiz, 'artifacts', 'Reporte de Ejecución de Pruebas nueva portada.pdf');
const SALIDA = join(raiz, 'artifacts', 'portada-avance.pdf');

const TITULO_VIEJO = 'Reporte de Ejecución de Pruebas';
const TITULO_NUEVO = 'Reporte de Avance de Proyecto Integrador';
const FECHA_VIEJA = '30/10/26';
const FECHA_NUEVA = '13/10/26';

const doc = await PDFDocument.load(readFileSync(ORIGEN));
const hoja = doc.getPage(0);
const { width, height } = hoja.getSize();
const fuente = await doc.embedFont(StandardFonts.Helvetica);

// Se calcula el tamano con el que el texto viejo ocupa el ancho medido en el PDF.
const anchoTituloViejo = 176;
const anchoFechaVieja = 47;
const tamTitulo = (anchoTituloViejo / fuente.widthOfTextAtSize(TITULO_VIEJO, 100)) * 100;
const tamFecha = (anchoFechaVieja / fuente.widthOfTextAtSize(FECHA_VIEJA, 100)) * 100;

function tapar(x, y, ancho, alto) {
  hoja.drawRectangle({ x, y, width: ancho, height: alto, color: rgb(1, 1, 1) });
}

function centrar(texto, tamano, lineaBase) {
  const ancho = fuente.widthOfTextAtSize(texto, tamano);
  hoja.drawText(texto, {
    x: (width - ancho) / 2,
    y: lineaBase,
    size: tamano,
    font: fuente,
    color: rgb(0, 0, 0),
  });
  return ancho;
}

// Titulo: se borra la linea anterior y se escribe la nueva en el mismo renglon.
tapar(100, 440, 400, 22);
const anchoNuevo = centrar(TITULO_NUEVO, tamTitulo, 450);
console.log(`titulo: tamano ${tamTitulo.toFixed(1)}, ancho ${anchoNuevo.toFixed(0)} de ${width.toFixed(0)}`);

// Fecha: misma operacion sobre "30/10/26".
tapar(288, 213, 70, 17);
centrar(FECHA_NUEVA, tamFecha, 220);

writeFileSync(SALIDA, await doc.save());
console.log(`portada: ${SALIDA}`);
