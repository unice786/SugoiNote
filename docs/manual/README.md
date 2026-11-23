# SugoiNote — Manual del sistema web (English B1)

Manual en inglés nivel B1 sobre el sistema web de SugoiNote. Está dividido en **5 partes**, una por persona, y cada parte se puede imprimir y estudiar por separado.

Cada parte incluye: objetivos, vocabulario técnico, explicación, pasos de secuencia (*First → Next → Then → After that → Finally*), preguntas WH-, sección **Did you…?**, recomendaciones **You should / You shouldn’t**, una nota de gramática B1 y un repaso con respuestas.

## Archivos

| Archivo | Contenido |
|---|---|
| `SugoiNote-Manual-EN-B1.pdf` | Manual completo (22 páginas) |
| `partes/SugoiNote-Manual-EN-B1-Parte-1.pdf` | Persona 1 — cuenta, login e Inicio (4 páginas) |
| `partes/SugoiNote-Manual-EN-B1-Parte-2.pdf` | Persona 2 — apuntes y editor (4 páginas) |
| `partes/SugoiNote-Manual-EN-B1-Parte-3.pdf` | Persona 3 — resúmenes y exámenes con IA (4 páginas) |
| `partes/SugoiNote-Manual-EN-B1-Parte-4.pdf` | Persona 4 — Chat IA y comunidad (5 páginas) |
| `partes/SugoiNote-Manual-EN-B1-Parte-5.pdf` | Persona 5 — perfil, estadísticas y ayuda (5 páginas) |

## Fuente y regeneración

- `manual-en-b1.html` es la fuente editable (HTML + CSS de impresión).
- `build-pdf.ps1` genera el PDF completo y los 5 PDFs individuales con Microsoft Edge en modo headless.

Para regenerar todo:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-pdf.ps1
```

> Requiere Microsoft Edge instalado. Si Edge está en otra ruta, edita `$edgeCandidates` al inicio del script.
