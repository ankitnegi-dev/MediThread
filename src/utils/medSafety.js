// Clinical guardrails: drug interactions + duplicate-test detection.
// Curated, explainable rules - ideal for hackathon demo (not medical advice).
import { labNumber } from './extract.js'

const INTERACTIONS = [
  {
    pair: ['telmisartan', 'ibuprofen'],
    level: 'high',
    msg: 'NSAID + ARB (Telmisartan): can raise BP, reduce kidney function, raise potassium. Avoid regular use; prefer paracetamol + monitor BP/creatinine.'
  },
  {
    pair: ['telmisartan', 'diclofenac'],
    level: 'high',
    msg: 'NSAID + ARB: same kidney/BP risk as ibuprofen. Avoid.'
  },
  {
    pair: ['metformin', 'contrast'],
    level: 'high',
    msg: 'Metformin + iodinated contrast dye: hold metformin per radiology advice, check creatinine/eGFR after the scan. Contrast can push the combination towards lactic acidosis.'
  },
  {
    pair: ['atorvastatin', 'clarithromycin'],
    level: 'high',
    msg: 'Clarithromycin raises statin levels → muscle injury risk. Use azithromycin instead or pause statin.'
  },
  {
    pair: ['spironolactone', 'telmisartan'],
    level: 'high',
    msg: 'Potassium-sparing diuretic + ACE inhibitor/ARB: both raise potassium. Check potassium and creatinine before and after starting the second drug.'
  },
  {
    pair: ['amlodipine', 'spironolactone'],
    level: 'medium',
    msg: 'Calcium-channel blocker + potassium-sparing diuretic: additive potassium retention. Check electrolytes instead of leaving it to chance.'
  },
  {
    pair: ['metformin', 'spironolactone'],
    level: 'medium',
    msg: 'Spironolactone can reduce kidney clearance of metformin. Check creatinine and watch for lactic acidosis symptoms if both continue.'
  },
  {
    pair: ['levothyroxine', 'calcium'],
    level: 'medium',
    msg: 'Calcium reduces levothyroxine absorption. Separate by 4 hours, take the thyroid pill empty stomach.'
  },
  {
    pair: ['levothyroxine', 'iron'],
    level: 'medium',
    msg: 'Iron reduces levothyroxine absorption. Separate by 4 hours.'
  },
  {
    pair: ['metformin', 'alcohol'],
    level: 'medium',
    msg: 'Heavy alcohol + metformin raises lactic acidosis risk. Limit intake.'
  },
  {
    pair: ['aspirin', 'ibuprofen'],
    level: 'medium',
    msg: 'Ibuprofen can blunt low-dose aspirin’s heart protection. Space doses or use paracetamol.'
  }
]

// A prescription can name the same drug differently. Fold the common ones into
// one key so "iodinated contrast" and "contrast media" hit the same rule, and
// "calcium carbonate" hits the calcium rule.
const ALIASES = {
  'iodinated contrast': 'contrast',
  'contrast media': 'contrast',
  'iodinated contrast dye': 'contrast',
  'calcium carbonate': 'calcium',
  'ferrous sulphate': 'iron',
  'ferrous sulfate': 'iron',
  'acetaminophen': 'paracetamol',
  'thyroxine': 'levothyroxine',
  'glibenclamide': 'glimepiride'
}

const norm = (s) => {
  const k = (s || '').toLowerCase().trim()
  return ALIASES[k] || k
}

/**
 * Flag a rule when the medicine being added completes the pair with something
 * already on the list. Every other member of a rule must already be present.
 */
export function checkInteractions(currentMeds, newMedName) {
  const cur = currentMeds.map((m) => norm(m.name))
  const nm = norm(newMedName)
  if (!nm) return []
  const hits = []
  for (const rule of INTERACTIONS) {
    if (!rule.pair.includes(nm)) continue
    const others = rule.pair.filter((x) => x !== nm)
    if (others.length && others.every((o) => cur.includes(o))) hits.push(rule)
  }
  return hits
}

export function checkExistingCombo(currentMeds) {
  const names = currentMeds.map((m) => norm(m.name))
  const hits = []
  for (const rule of INTERACTIONS) {
    if (rule.pair.every((x) => names.includes(x))) hits.push(rule)
  }
  return hits
}

export const RULES = INTERACTIONS

// Duplicate-test guard: same lab name within `windowDays` → warn against repeat.
const TEST_WINDOWS = {
  HbA1c: 90,
  TSH: 60,
  LDL: 120,
  Creatinine: 60,
  FastingGlucose: 14,
  default: 45
}

export function findRecentSameTest(records, testName, refDateISO) {
  const windowDays = TEST_WINDOWS[testName] ?? TEST_WINDOWS.default
  const ref = new Date(refDateISO).getTime()
  const candidates = []
  for (const r of records) {
    if (r.type !== 'lab' || !r.labs || labNumber(r.labs[testName]) === null) continue
    const t = new Date(r.date).getTime()
    const diffDays = Math.round((ref - t) / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays <= windowDays) {
      candidates.push({ record: r, diffDays })
    }
  }
  candidates.sort((x, y) => x.diffDays - y.diffDays)
  return { windowDays, candidates }
}