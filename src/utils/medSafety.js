// Clinical guardrails: drug interactions + duplicate-test detection.
// Curated, explainable rules — ideal for hackathon demo (not medical advice).

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
    msg: 'Metformin + iodinated contrast: hold metformin per radiology advice, check creatinine/eGFR after scan.'
  },
  {
    pair: ['atorvastatin', 'clarithromycin'],
    level: 'high',
    msg: 'Clarithromycin raises statin levels → muscle injury risk. Use azithromycin instead or pause statin.'
  },
  {
    pair: ['levothyroxine', 'calcium'],
    level: 'medium',
    msg: 'Calcium/iron reduces levothyroxine absorption. Separate by 4 hours, take thyroid pill empty stomach.'
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

const norm = (s) => (s || '').toLowerCase().trim()

export function checkInteractions(currentMeds, newMedName) {
  const cur = currentMeds.map((m) => norm(m.name))
  const nm = norm(newMedName)
  const hits = []
  for (const rule of INTERACTIONS) {
    const [a, b] = rule.pair
    const hasA = cur.includes(a) || nm === a
    const hasB = cur.includes(b) || nm === b
    // Only flag if the new med completes the pair with an existing med
    const newIsPart = nm === a || nm === b
    const otherExists = (nm === a && cur.includes(b)) || (nm === b && cur.includes(a))
    if (newIsPart && otherExists && hasA && hasB) hits.push(rule)
    // Also flag pairs already present in current list
    if (!nm && hasA && hasB) hits.push(rule)
  }
  return hits
}

export function checkExistingCombo(currentMeds) {
  const names = currentMeds.map((m) => norm(m.name))
  const hits = []
  for (const rule of INTERACTIONS) {
    const [a, b] = rule.pair
    if (names.includes(a) && names.includes(b)) hits.push(rule)
  }
  return hits
}

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
    if (r.type !== 'lab' || !r.labs || r.labs[testName] === undefined) continue
    const t = new Date(r.date).getTime()
    const diffDays = Math.round((ref - t) / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays <= windowDays) {
      candidates.push({ record: r, diffDays })
    }
  }
  candidates.sort((x, y) => x.diffDays - y.diffDays)
  return { windowDays, candidates }
}

export function simulateParse(filename, provider) {
  // Simulated AI extraction — deterministic demo logic from filename keywords.
  const f = (filename || '').toLowerCase()
  let type = 'lab'
  if (f.includes('presc') || f.includes('rx')) type = 'prescription'
  else if (f.includes('scan') || f.includes('usg') || f.includes('xray') || f.includes('mri')) type = 'scan'
  else if (f.includes('discharge') || f.includes('summary')) type = 'discharge'
  const today = new Date().toISOString().slice(0, 10)
  return {
    type,
    date: today,
    provider: provider || 'Uploaded by patient',
    confidence: 0.87,
    extracted: type === 'lab'
      ? 'Detected: HbA1c, Fasting Glucose, Creatinine panels'
      : type === 'prescription'
        ? 'Detected: 2 medicines + dosage lines'
        : 'Detected: 1 document, 3 pages'
  }
}
