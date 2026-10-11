// Everything here runs in the browser. No document ever leaves the device.
//
// Pipeline: file -> (pdf text layer | OCR) -> raw text -> rule-based parse
// -> a reviewable draft. Nothing is saved until the patient confirms it.

export const MAX_BYTES = 10 * 1024 * 1024
export const SHARE_ATTACHMENT_LIMIT = 200 * 1024
export const OCR_LANGS = 'eng+hin+tam'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPTED = [...IMAGE_TYPES, 'application/pdf']
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp'

export const acceptAttr = ACCEPT_ATTR
export const acceptedTypes = ACCEPTED

export function validateFile(file) {
  if (!file) return { ok: false, error: 'No file was chosen.' }
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  const looksRight = ACCEPTED.includes(type) || ACCEPT_ATTR.split(',').some((ext) => name.endsWith(ext))
  if (!looksRight) {
    return { ok: false, error: 'That file type is not supported. Use a PDF, JPG, PNG or WEBP.' }
  }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, error: `That file is ${mb} MB. The limit is 10 MB - try a photo instead of a scan.` }
  }
  return { ok: true }
}

export function isPdf(file) {
  return (file.type || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(file.name || '')
}

export function isImage(file) {
  return IMAGE_TYPES.includes((file.type || '').toLowerCase())
}

/* ------------------------------------------------------------------
   Text extraction
   ------------------------------------------------------------------ */

let workerPromise = null

async function getOcrWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker(OCR_LANGS, 1, {
        logger: (m) => {
          if (m.status && typeof m.progress === 'number') onProgress?.(m.status, m.progress)
        }
      })
    })().catch((e) => {
      workerPromise = null
      throw e
    })
  }
  return workerPromise
}

export function terminateOcr() {
  if (!workerPromise) return
  workerPromise.then((w) => w.terminate()).catch(() => {})
  workerPromise = null
}

async function ocrImage(source, onProgress) {
  const worker = await getOcrWorker(onProgress)
  const { data } = await worker.recognize(source)
  return { text: data.text || '', confidence: typeof data.confidence === 'number' ? data.confidence : null }
}

async function pdfText(file, onProgress) {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.('reading pdf', i / doc.numPages)
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // keep line structure - hasEOL marks the end of a printed line
    let line = ''
    for (const item of content.items) {
      line += item.str
      if (item.hasEOL) { text += line + '\n'; line = '' }
    }
    if (line) text += line + '\n'
    text += '\n'
  }
  return { text, pages: doc.numPages }
}

/** Render one PDF page to a canvas so a scanned page can be OCR'd. */
async function pdfPageToImage(file, pageNo, scale = 2) {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const page = await doc.getPage(Math.min(pageNo, doc.numPages))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas
}

/** First page as a data URL - used for the preview thumbnail. */
export async function pdfPreview(file) {
  try {
    const canvas = await pdfPageToImage(file, 1, 1.4)
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch {
    return null
  }
}

/**
 * Pull text out of a file.
 * Text PDFs use their text layer; scanned PDFs and images fall back to OCR.
 * Returns { text, method, pages, confidence, error }.
 */
export async function extractText(file, onProgress) {
  try {
    if (isPdf(file)) {
      let out = null
      try {
        out = await pdfText(file, onProgress)
      } catch {
        out = null
      }
      const usable = out && out.text.replace(/\s+/g, '').length >= 40
      if (usable) {
        return { text: out.text, method: 'pdf-text', pages: out.pages, confidence: null }
      }
      onProgress?.('scanned pdf - running ocr', 0.05)
      const canvas = await pdfPageToImage(file, 1, 2)
      const ocr = await ocrImage(canvas, onProgress)
      return { text: ocr.text, method: 'ocr', pages: out?.pages ?? 1, confidence: ocr.confidence }
    }

    if (isImage(file)) {
      onProgress?.('reading image', 0.05)
      const ocr = await ocrImage(file, onProgress)
      return { text: ocr.text, method: 'ocr', pages: 1, confidence: ocr.confidence }
    }

    return { text: '', method: 'none', pages: 0, confidence: null, error: 'That file type cannot be read.' }
  } catch (e) {
    return {
      text: '',
      method: 'none',
      pages: 0,
      confidence: null,
      error:
        (e && /network|fetch|Failed to load/i.test(String(e.message || e)))
          ? 'Text recognition needs to download its language data once, and it could not reach the network. Fill the form in by hand instead.'
          : 'That file could not be read. Fill the form in by hand instead.'
    }
  }
}

/* ------------------------------------------------------------------
   Rule-based parsing of the extracted text
   ------------------------------------------------------------------ */

const LAB_TESTS = [
  { name: 'HbA1c', label: 'HbA1c', re: /h[\s-]?ba1c|glycated\s*(haemo|hemoglob)/i, units: ['%'] },
  { name: 'FastingGlucose', label: 'Fasting Glucose', re: /fasting\s*(blood\s*)?(glucose|sugar)|\bfbs?\b|\bfbp\b/i, units: ['mg/dL', 'mg/dl', 'mmol/L'] },
  { name: 'LDL', label: 'LDL', re: /\bldl\b|low\s*density\s*lipoprotein/i, units: ['mg/dL', 'mg/dl'] },
  { name: 'HDL', label: 'HDL', re: /\bhdlc?\b|high\s*density\s*lipoprotein/i, units: ['mg/dL', 'mg/dl'] },
  { name: 'Creatinine', label: 'Creatinine', re: /creatinine/i, units: ['mg/dL', 'mg/dl', 'µmol/L', 'umol/L'] },
  { name: 'TSH', label: 'TSH', re: /\btsh\b|thyroid\s*stimulating/i, units: ['mIU/L', 'µIU/mL', 'mIU/L'] },
  { name: 'Urea', label: 'Urea', re: /\burea\b|blood\s*urea/i, units: ['mg/dL', 'mg/dl'] },
  { name: 'VitaminD', label: 'Vitamin D', re: /vitamin\s*-?\s*d\b|25\s*-\s*oh/i, units: ['ng/mL', 'ng/ml'] },
  { name: 'Hb', label: 'Haemoglobin', re: /\bhb\b|haemoglobin|hemoglobin/i, units: ['g/dL', 'g/dl', 'gm/dL'] }
]

const DRUGS = [
  'Metformin', 'Telmisartan', 'Losartan', 'Ramipril', 'Enalapril', 'Amlodipine', 'Olmesartan',
  'Atorvastatin', 'Rosuvastatin', 'Simvastatin', 'Levothyroxine', 'Thyroxine',
  'Aspirin', 'Clopidogrel', 'Ibuprofen', 'Diclofenac', 'Paracetamol', 'Acetaminophen',
  'Omeprazole', 'Pantoprazole', 'Ranitidine', 'Metformin ER', 'Gliclazide', 'Glimepiride',
  'Insulin', 'Prednisolone', 'Montelukast', 'Cetirizine', 'Loratadine', 'Salbutamol',
  'Spironolactone', 'Furosemide', 'Hydrochlorothiazide', 'Allopurinol', 'Levocetirizine'
]

const FREQ = [
  { re: /\bonce\s+daily\b|\bOD\b|\b1\s*-\s*0\s*-\s*0\b/i, label: 'Once daily' },
  { re: /\btwice\s+daily\b|\bBD\b|\b1\s*-\s*0\s*-\s*1\b/i, label: 'Twice daily' },
  { re: /\bthree\s+times\s+a\s+day\b|\bTDS\b|\b1\s*-\s*1\s*-\s*1\b/i, label: 'Three times daily' },
  { re: /\bSOS\b|as\s+needed|\bPRN\b/i, label: 'As needed' },
  { re: /\bat\s+night\b|\bHS\b|\bnocte\b/i, label: 'At night' },
  { re: /\bempty\s+stomach\b|\bbefore\s+breakfast\b/i, label: 'Empty stomach' }
]

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const NUMBER_AFTER = String.raw`([<>~]?\s*\d{1,4}(?:\.\d+)?)`

/**
 * Lab values may be stored as a bare number (8.1) or as a value-with-unit
 * string ("8.1 %"). Anything that charts or compares them must go through here.
 */
export function labNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v === null || v === undefined) return null
  const n = Number.parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function isoFromParts(y, m, d) {
  const yy = Number(y)
  const mm = Number(m)
  const dd = Number(d)
  if (!yy || !mm || !dd || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  if (yy < 100) return null
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

export function parseDate(text) {
  const t = text || ''
  let m = t.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m) {
    const iso = isoFromParts(m[1], m[2], m[3])
    if (iso) return iso
  }
  m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/)
  if (m) {
    const iso = isoFromParts(m[3], m[2], m[1])
    if (iso) return iso
  }
  m = t.match(/\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})\b/)
  if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) {
    const iso = isoFromParts(m[3], String(MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1), m[1])
    if (iso) return iso
  }
  m = t.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/)
  if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) {
    const iso = isoFromParts(m[3], String(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1), m[2])
    if (iso) return iso
  }
  return null
}

export function detectProvider(text) {
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const re = /(hospital|clinic|labs?|laborator|diagnostic|medical|health\s*care|centre|center|polyclinic|nursing\s*home)/i
  for (const l of lines.slice(0, 25)) {
    if (l.length < 90 && re.test(l)) return l
  }
  // The whole page came back as one line - cut a window around the first
  // institutional keyword instead of giving up.
  const flat = lines.join(' ')
  const m = flat.match(new RegExp(`[^|\\n]{0,40}${re.source}[^|\\n]{0,45}`, 'i'))
  if (m) return m[0].trim()
  return ''
}

export function detectType(text, fileName = '') {
  const t = `${text || ''} ${fileName || ''}`
  if (/discharge\s*(summary|sheet)?|admission\s*summary/i.test(t)) return 'discharge'
  if (/\b(usg|ct|mri|x[\s-]?ray|ultrasound|sonograph|radiolog|imaging|scan\s*report)\b/i.test(t)) return 'scan'

  // Lab signals win over prescription signals: a lab report full of "mg/dL"
  // must not be mistaken for an Rx just because it mentions a dose unit.
  const labWords = /reference\s*(range|value)|normal\s*range|specimen|test\s*name|investigation/i.test(text || '')
  if (labWords || LAB_TESTS.some((x) => x.re.test(text || ''))) return 'lab'

  const rxForm = /(^|\s)rx\b|^\s*tab\.?\s|\btab\.?\b|\bcap\.?\b|\bdose\b|\bsos\b|\bqd\.?\b/i.test(text || '')
  if (rxForm) return 'prescription'

  return 'note'
}

export function parseLabs(text) {
  const t = text || ''
  const out = {}
  for (const test of LAB_TESTS) {
    const m = t.match(test.re)
    if (!m) continue
    // start after the label itself - labels like "HbA1c" contain their own digits
    const after = m.index + m[0].length
    const window = t.slice(after, after + 140)
    const val = window.match(NUMBER_AFTER)
    if (!val) continue
    const num = Number(String(val[1]).replace(/[^0-9.]/g, ''))
    if (!Number.isFinite(num) || num <= 0) continue
    const unitMatch = window.match(/(%|mg\s*\/\s*d[lL]|g\s*\/\s*d[lL]|gm\s*\/\s*d[lL]|mIU\s*\/\s*L|mIU\/L|µ?IU\/mL|ng\s*\/\s*m[lL]|mmol\s*\/\s*L)/i)
    out[test.name] = unitMatch ? `${num} ${unitMatch[1].replace(/\s+/g, '')}` : num
  }
  return out
}

export function parseMedicines(text) {
  const t = text || ''
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const found = []
  const seen = new Set()

  for (const line of lines) {
    for (const drug of DRUGS) {
      const re = new RegExp(`\\b${drug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (!re.test(line) || seen.has(drug)) continue
      seen.add(drug)
      const doseMatch = line.match(/\b(\d{1,4}(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|%)\b/i)
      const freq = FREQ.find((f) => f.re.test(line))
      found.push({
        name: drug,
        dose: doseMatch ? `${doseMatch[1]}${doseMatch[2].toLowerCase()}` : '-',
        freq: freq ? freq.label : 'as advised'
      })
    }
  }
  return found
}

/** Build a reviewable draft. The patient confirms before anything is saved. */
export function parseDocument(text, fileName = '') {
  const clean = (text || '').replace(/[ \t]+/g, ' ').trim()
  const labs = parseLabs(clean)
  const meds = parseMedicines(clean)
  const date = parseDate(clean)
  const provider = detectProvider(clean)
  const type = detectType(clean, fileName)

  const found = Object.keys(labs).length + meds.length + (date ? 1 : 0)
  const today = new Date().toISOString().slice(0, 10)

  return {
    ok: found > 0,
    type,
    date: date || today,
    provider: provider || '',
    title: buildTitle(type, labs, meds, fileName),
    labs,
    meds,
    notes: clean ? clean.slice(0, 600) : '',
    found
  }
}

function buildTitle(type, labs, meds, fileName) {
  const labKeys = Object.keys(labs)
  if (type === 'lab' && labKeys.length) {
    const first = labKeys.slice(0, 3).map((k) => `${k} ${labs[k]}`).join(', ')
    return labKeys.length > 3 ? `${first} +${labKeys.length - 3} more` : first
  }
  if (meds.length) return meds.map((m) => `${m.name} ${m.dose}`).join(', ')
  const base = (fileName || '').replace(/\.[^.]+$/, '')
  return base || 'Added record'
}