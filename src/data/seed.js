// Seeded demo data: Meera Krishnan, 52 - diabetes + hypertension + hypothyroid.
// Records are intentionally scattered across providers to demo unification.
export const DEMO_PATIENT = {
  id: 'pat-meera-01',
  name: 'Meera Krishnan',
  age: 52,
  sex: 'Female',
  bloodGroup: 'B+',
  phone: '+91 98410 22334',
  city: 'Chennai → now Bengaluru',
  conditions: ['Type 2 Diabetes', 'Hypertension', 'Hypothyroidism'],
  allergies: ['Penicillin (rash)', 'Sulfa drugs'],
  emergencyContact: 'Arun Krishnan (spouse) · +91 98410 55667',
  emergencyPin: '2481',
  currentMeds: [
    { name: 'Metformin', dose: '500mg', freq: 'BD after food', since: '2023-04-12' },
    { name: 'Telmisartan', dose: '40mg', freq: 'OD morning', since: '2022-11-03' },
    { name: 'Levothyroxine', dose: '75mcg', freq: 'OD empty stomach', since: '2021-06-20' },
    { name: 'Atorvastatin', dose: '10mg', freq: 'OD night', since: '2024-01-15' }
  ]
}

export const SEED_RECORDS = [
  {
    id: 'rec-001',
    type: 'prescription',
    date: '2022-11-03',
    provider: 'Apollo Clinic, Chennai - Dr. R. Nair',
    title: 'Hypertension diagnosis + Telmisartan start',
    conditions: ['Hypertension'],
    meds: [{ name: 'Telmisartan', dose: '40mg OD' }],
    notes: 'BP 152/96. Lifestyle counselling. Low salt. Review in 1 month.',
    source: 'Paper prescription photo'
  },
  {
    id: 'rec-002',
    type: 'lab',
    date: '2023-04-12',
    provider: 'Dr Lal PathLabs, Chennai',
    title: 'HbA1c 8.1% - Diabetes confirmed',
    conditions: ['Type 2 Diabetes'],
    labs: { HbA1c: 8.1, FastingGlucose: 168, Creatinine: 0.9 },
    notes: 'New diabetes. Started Metformin 500mg BD. Diet chart given.',
    source: 'PDF report'
  },
  {
    id: 'rec-003',
    type: 'prescription',
    date: '2023-08-19',
    provider: 'CityCare Clinic, Chennai - Dr. S. Rao',
    title: 'Fever + body ache - conflicting NSAID',
    conditions: ['Fever'],
    meds: [{ name: 'Ibuprofen', dose: '400mg TDS' }],
    notes: 'Patient did not disclose Telmisartan + diabetes history. NSAID without BP check - classic recall failure.',
    source: 'Paper slip',
    flag: 'Potential interaction: NSAID + Telmisartan → BP/kidney risk'
  },
  {
    id: 'rec-004',
    type: 'lab',
    date: '2024-01-15',
    provider: 'Apollo Labs, Chennai',
    title: 'Lipid profile - LDL 142, started statin',
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    labs: { LDL: 142, HDL: 44, HbA1c: 7.6, Creatinine: 1.0 },
    notes: 'LDL high. Atorvastatin 10mg OD. Repeat HbA1c in 3 months.',
    source: 'PDF report'
  },
  {
    id: 'rec-005',
    type: 'scan',
    date: '2024-06-02',
    provider: 'MIOT Imaging, Chennai',
    title: 'USG Abdomen - fatty liver Grade I',
    conditions: ['Type 2 Diabetes'],
    notes: 'Mild hepatomegaly, fatty infiltration. No focal lesion. Advise weight loss.',
    source: 'Scan + PDF'
  },
  {
    id: 'rec-006',
    type: 'lab',
    date: '2024-09-10',
    provider: 'Orange Health, Bengaluru (after move)',
    title: 'HbA1c 7.2% - improving',
    conditions: ['Type 2 Diabetes'],
    labs: { HbA1c: 7.2, FastingGlucose: 138, Creatinine: 1.0 },
    notes: 'New city, new lab. Doctor had no old reports - patient forwarded PDFs over WhatsApp.',
    source: 'WhatsApp PDF forward'
  },
  {
    id: 'rec-007',
    type: 'discharge',
    date: '2025-02-22',
    provider: 'St. John’s ER, Bengaluru',
    title: 'ER: dizziness - BP dip, dehydration',
    conditions: ['Hypertension'],
    notes: 'Patient unable to recall meds in ER. Attender showed phone photos. Withheld morning Telmisartan, IV fluids. No admission.',
    source: 'Discharge summary',
    flag: 'Continuity break: ER started from scratch'
  },
  {
    id: 'rec-008',
    type: 'lab',
    date: '2025-05-18',
    provider: 'Apollo Labs, Bengaluru',
    title: 'HbA1c 7.0%, Creatinine 1.1',
    conditions: ['Type 2 Diabetes'],
    labs: { HbA1c: 7.0, FastingGlucose: 131, Creatinine: 1.1 },
    notes: 'Stable. eGFR borderline - avoid nephrotoxins. Repeat KFT in 3 months, not next week.',
    source: 'PDF report'
  },
  {
    id: 'rec-009',
    type: 'prescription',
    date: '2026-03-14',
    provider: 'Fortis OPD, Bengaluru - Dr. P. Iyer',
    title: 'Thyroid review - dose steady',
    conditions: ['Hypothyroidism'],
    meds: [{ name: 'Levothyroxine', dose: '75mcg OD' }],
    labs: { TSH: 3.1 },
    notes: 'TSH in range. Continue same dose. Take on empty stomach, no calcium/iron for 4 hrs.',
    source: 'E-prescription'
  },
  {
    id: 'rec-010',
    type: 'lab',
    date: '2026-09-28',
    provider: 'Apollo Labs, Bengaluru',
    title: 'Latest: HbA1c 6.8%, LDL 98',
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    labs: { HbA1c: 6.8, FastingGlucose: 124, LDL: 98, HDL: 48, Creatinine: 1.0 },
    notes: 'Best control yet. Continue all meds. Next HbA1c due Jan 2027 - do NOT repeat earlier.',
    source: 'PDF report'
  }
]

export const KNOWN_DOCTORS = [
  { id: 'doc-iyer', name: 'Dr. P. Iyer', spec: 'Endocrinology, Fortis Bengaluru' },
  { id: 'doc-nair', name: 'Dr. R. Nair', spec: 'Internal Medicine, Apollo Chennai' },
  { id: 'doc-er', name: 'ER Team', spec: 'St. John’s Emergency' }
]
