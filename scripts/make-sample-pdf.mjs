// Generates the sample lab report shipped in public/.
//
// A real text-layer PDF is deliberate: pdfjs reads it in milliseconds, so the
// demo never depends on the OCR language packs downloading over venue Wi-Fi.
// It still exercises the whole pipeline: text layer -> rule parser -> review
// form -> duplicate-test guard.
//
// Run: node scripts/make-sample-pdf.mjs
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', 'public', 'sample-lab-report.pdf')

const PAGE = [
  ['H', 18, 72, 'CityCare Diagnostics'],
  ['H', 12, 92, 'Unit II, Anna Salai, Chennai 600002'],
  ['R', 10, 112, ''],
  ['R', 11, 132, 'Patient: Meera Krishnan'],
  ['R', 11, 148, 'Age / Sex: 52 / Female     Ref: MT-2026-44812'],
  ['R', 11, 164, 'Collected: 28-Sep-2026     Reported: 29-Sep-2026'],
  ['R', 10, 184, ''],
  ['H', 11, 206, 'TEST NAME            RESULT      UNIT       REFERENCE RANGE'],
  ['R', 10, 224, 'Haemoglobin (Hb)     11.4        g/dL       12.0 - 15.0'],
  ['R', 10, 238, 'Fasting Glucose      142        mg/dL      70 - 100'],
  ['R', 10, 252, 'HbA1c                7.4        %          Below 5.7'],
  ['R', 10, 266, 'Creatinine           1.0        mg/dL      0.6 - 1.1'],
  ['R', 10, 280, 'LDL Cholesterol      118        mg/dL      Below 100'],
  ['R', 10, 294, 'HDL Cholesterol      41         mg/dL      Above 40'],
  ['R', 10, 308, 'TSH                  2.4        mIU/L      0.4 - 4.0'],
  ['R', 10, 326, ''],
  ['H', 11, 350, 'Interpretation'],
  ['R', 10, 366, 'Glycemic control has improved. Continue current therapy.'],
  ['R', 10, 380, 'Repeat HbA1c after 3 months.'],
  ['R', 10, 400, ''],
  ['R', 9, 420, 'Verified by: Dr. S. Rao, MD (Pathology)'],
  ['R', 9, 434, 'This is a computer-generated report.']
]

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const FONT = { H: '/F2', R: '/F1' }
const SIZE = { H: 18, R: 10 }

let content = ''
for (const [kind, size, y, text] of PAGE) {
  if (!text) { content += '0 - 8 Td\n'; continue }
  content += `${FONT[kind]} ${kind === 'H' ? size : size} Tf 1 0 0 1 60 ${792 - y} Tm (${esc(text)}) Tj\n`
}
// use absolute positioning instead of relative, simpler and safer
content = ''
for (const [kind, size, y, text] of PAGE) {
  if (!text) continue
  content += `BT ${FONT[kind]} ${SIZE[kind]} Tf 60 ${792 - y} Td (${esc(text)}) Tj ET\n`
}

const objs = [
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R/F2 5 0 R>>>>/Contents 6 0 R>>',
  '<</Type/Font/Subtype/Type1/BaseFont/Courier>>',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>',
  `<</Length ${content.length}>>\nstream\n${content}endstream`
]

let pdf = '%PDF-1.4\n%âãÏÓ\n'
const offsets = []
objs.forEach((o, i) => {
  offsets.push(pdf.length)
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
})
const xrefPos = pdf.length
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`
pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, Buffer.from(pdf, 'binary'))
console.log(`wrote ${OUT} (${Buffer.byteLength(pdf)} bytes, ${PAGE.length} lines)`)