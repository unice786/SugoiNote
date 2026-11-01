// ─────────────────────────────────────────────────────────────
// Reemplaza la portada del PDF generado por la portada oficial del equipo.
//
// La portada vive en artifacts/Reporte de Ejecucion de Pruebas nueva portada.pdf
// (una sola pagina A4). Se copia tal cual al PDF final y se descarta la portada
// generada, de modo que la numeracion del indice no cambia.
//
// Uso:
//   node pruebas/informes/unir-portada.mjs
// ─────────────────────────────────────────────────────────────
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const artefactos = join(raiz, 'artifacts');

const rutaModulo = process.env.PDF_LIB ?? join(process.env.TEMP ?? '', 'opencode', 'pdfgen', 'node_modules', 'pdf-lib', 'cjs', 'index.js');
const { PDFDocument } = await import(pathToFileURL(rutaModulo).href).then((m) => m.default ?? m);

const final = join(artefactos, 'Reporte-Ejecucion-Pruebas-SugoiNote.pdf');
const portada =
  process.argv[2] ??
  join(
    artefactos,
    readdirSync(artefactos).find((f) => /nueva portada\.pdf$/i.test(f)) ?? '',
  );

if (!existsSync(final)) {
  console.error(`No existe ${final}. Ejecuta primero generar-pdf.mjs.`);
  process.exit(1);
}
if (!portada || !existsSync(portada)) {
  console.error('No se encontro la portada oficial en artifacts/.');
  process.exit(1);
}

const documento = await PDFDocument.load(readFileSync(final));
const portadaDoc = await PDFDocument.load(readFileSync(portada));

const paginasAntes = documento.getPageCount();
const [paginaPortada] = await documento.copyPages(portadaDoc, [0]);

documento.removePage(0);
documento.insertPage(0, paginaPortada);

documento.setTitle('Reporte de Ejecucion de Pruebas - SugoiNote');
documento.setSubject('PDCE - Testeo de Software - Ciclo 02/2026');
documento.setAuthor('Michael Sanchez, Samuel Mendoza, Iliana Melgar, Manuel Carias, Maria Guadalupe Sion');
documento.setCreator('SugoiNote');
documento.setProducer('SugoiNote');

const bytes = await documento.save();
writeFileSync(final, bytes);

const kb = Math.round(bytes.length / 1024);
console.log(`Portada: ${portada}`);
console.log(`PDF final: ${final} (${documento.getPageCount()} paginas, ${kb} KB; antes ${paginasAntes})`);
