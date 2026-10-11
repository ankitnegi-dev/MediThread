# 🧵 MediThread: Own Your Health History

> **Hackathon:** 24-Hour Web Development Hackathon · IIITDM Kancheepuram
> **Domain:** HealthTech · **Problem:** *Lost in Transit: Fragmented Medical Records and Repeated Care Across Providers*

| | |
|---|---|
| **Live demo** | https://medi-thread-five.vercel.app |
| **Demo video** | [Watch the 2–5 min walkthrough](https://drive.google.com/drive/folders/1-Cv-x50zltGIfTR45hnLoFrwb1lZxzLn?usp=drive_link) |
| **Source code** | https://github.com/ankitnegi-dev/MediThread |
| **Team** | XYZ |

### Judge quick-start
1. Open the live demo (no login or setup needed).
2. Patient tab → Sharing → create a 24h link → open it in the Doctor tab or on another device.
3. Emergency tab → PIN `2481`.

---

## 1. Problem → Solution mapping

| Brief challenge | MediThread answer |
|---|---|
| **Scattered records** (prescriptions, labs, scans in different places/formats) | Unified searchable timeline, newest-first, filter by type/provider/condition. Real client-side upload: drag in a PDF/JPG/PNG/WEBP, text is read from the PDF text layer or via OCR, then a rule-based parser pre-fills an **editable review form**. Nothing is saved until the patient confirms. |
| **Unreliable recall** (allergies, meds, doses forgotten in short consults) | Always-on patient summary: conditions, current meds with doses, allergies, blood group, emergency contact. Doctor sees it before asking. |
| **Repeated tests + conflicting treatment** | Duplicate-test guard (HbA1c 90d, Creatinine 60d, LDL 120d…) nudges “view prior result instead of repeating”. Curated interaction engine flags e.g. Telmisartan + Ibuprofen *before* you take it. |
| **Insecure, difficult sharing** | Consent-based expiring links: pick records → 1h/24h/7d expiry → token URL (`#/shared/:token`) → revoke anytime → every view logged in audit trail. No chat forwards. |
| **Broken continuity** (new city / new doctor / ER starts from scratch) | Doctor portal writes back to the *same* timeline. ER PIN-gated view + QR works with no login when the patient can't speak. JSON export for moving cities. |

Demo persona: **Meera Krishnan, 52** — Type 2 Diabetes + Hypertension + Hypothyroidism, moved Chennai → Bengaluru, 10 scattered records (2022–2026) including the cautionary 2023 Ibuprofen-without-history visit and the 2025 ER “started from scratch” episode.

## 2. Key features (judge click-path, ~4 min)

1. **📜 Timeline + trends** — search “HbA1c”, filter Labs, open any record. HbA1c 8.1 → 6.8 and Creatinine SVG trend charts prove control without repeating tests.
2. **📤 Upload** — drop in a lab PDF or a photo of a prescription → *Read this document* → text PDFs come off their text layer, photos/scans go through OCR (English + हिन्दी + தமிழி, downloaded once) → a rule-based parser fills type, date, provider, lab values and medicines into an **editable review form** → the duplicate-test guard and interaction checker run → *Save*. The original is kept in IndexedDB and gets a *View document* / *Download* button in the timeline.
3. **💊 Meds & Safety** — try adding `Ibuprofen` → HIGH-RISK Telmisartan interaction blocks with explanation + safer alternative. Try `Paracetamol` → green ✅.
4. **🔗 Share** — select 3 records → 24h link → copy `…#/shared/<token>` → **open the link on your phone over mobile data** (or a second browser with no MediThread data): the records still render, because they travel inside the link. Revoke → the UI states plainly that revocation is enforced locally in this demo. The access log records every open.
5. **🩺 Doctor** (`#/doctor`) — paste the share code → sees *only* the shared records, plus the patient's summary carried in the link → builds a **note code** → sends it to the patient, who pastes it into their timeline (continuity, not scratch).
6. **🚨 Emergency** (`#/emergency`, PIN `2481`) — allergies + meds + blood group + last 5 records, QR printable for wallet/phone. One medicine per line, allergies marked in red, and a bilingual English/हिन्दी/தமிழ்/ಕನ್ನಡ toggle. Export **and** import JSON; print a one-page clinician summary.
7. **🗣️ Language** — switch to हिन्दी / தமிழ் / ಕನ್ನಡ in the header. The whole interface and the emergency card follow; the choice survives a reload.

## 3. Tech & architecture

- **Frontend-only static app** — React 18 + Vite 5 + React Router (HashRouter so `dist/index.html` works on any host without rewrites) + `qrcode.react`. No backend → zero setup for judges, local-first privacy story.
- **Persistence:** `localStorage` (`medithread:v1`) — patient, records, shares, audit. Reset button restores seeded demo. **Attachments go to IndexedDB**, not localStorage — localStorage caps at ~5 MB and is synchronous, which would freeze the UI. Records keep only a `fileId` pointer.
- **Document upload (real, client-side):** drag-and-drop accepts PDF/JPG/PNG/WEBP up to 10 MB with explicit errors for the wrong type or size. Text PDFs are read via **pdfjs-dist** text layer; photos and scanned pages fall back to **tesseract.js** OCR in `eng+hin+tam`, loaded on demand with a progress indicator. A rule-based parser pulls lab values (HbA1c, glucose, LDL, HDL, creatinine, TSH, urea, vitamin D, Hb), medicines with dose/frequency, the date and the provider. Output is a **draft for review** — never auto-saved.
- **Sharing attachments:** the original file travels inside the link only when it is under 200 KB. Above that the extracted values are shared and the record says *"original file not included."*
- **Share tokens (cross-device):** v2 token is `lz-string(deflate)` over JSON carrying the patient summary **and the selected record payloads**, so a link opens on any device with an empty localStorage. Validated for expiry, malformed input and local revocation. The emergency PIN is deliberately never embedded in a link.
- **Revocation — honest limit:** there is no server, so there is no central consent registry. Revoking blocks the link **in the browser that issued it**; until the link expires on its own, it will still open elsewhere. Production uses a server-side consent registry.
- **Doctor → patient continuity:** with no backend a doctor cannot write into the patient's chart. The Doctor view produces an `mtn1:` **note code**; the patient pastes it under *Sharing → Receive a note* and it joins the timeline.
- **Clinical rules:** `src/utils/medSafety.js` — curated interaction pairs + per-test repeat windows, with a drug-name alias table so “iodinated contrast” and “calcium carbonate” hit the right rule. Illustrative, not medical advice; production would plug DrugBank / CDS Hooks + FHIR.
- **Languages:** English, हिन्दी, தமிழ், ಕನ್ನಡ. JSON dictionaries in `src/i18n/` behind a small `useT()` hook — no i18n framework. The choice persists and sets `<html lang>`. Drug names, lab test names, units and numbers stay in English so a prescription is never ambiguous; only the labels around them are translated. The emergency card has a bilingual toggle so a responder who reads only one of the two still gets the allergies.
- **Accessibility:** all small text meets WCAG AA contrast (measured 4.67:1+), 44px tap targets on mobile, real `tablist` semantics, visible focus rings, and a keyboard-operable file drop (the input covers the dropzone, so it is focusable and Enter/Space opens the picker).
- **Tests:** `npm test` — 86 Vitest cases covering share-token encode/decode/expiry/malformed/revoked, the document parser, the interaction rules and duplicate-test windows, and a completeness check that all four dictionaries match the English key set.
- **Charts:** hand-rolled SVG (zero chart deps) — deliberate for offline reliability.

```
src/
  App.jsx                 shell + HashRouter + sidebar
  pages/Patient.jsx       timeline / upload / meds / share / emergency tabs
  pages/Clinical.jsx      Doctor + Shared (token) + Emergency (PIN) views
  components/ui.jsx       TimelineItem, TypeBadge, LabChart
  data/seed.js            10-record scattered demo history
  utils/store.js          localStorage CRUD + audit
  utils/blobStore.js      IndexedDB attachment store
  utils/extract.js        file validation, OCR/PDF text, rule-based parser
  utils/medSafety.js      interactions + duplicate-test windows
  utils/share.js          v2 self-contained token encode / validate + note codes
  i18n/                   en / hi / ta / kn dictionaries + useT() hook
  components/EmergencyCard.jsx     printed, bilingual ER card
  components/ClinicianSummary.jsx  one-page printable clinician summary
```

## 4. Setup & run

```bash
# prerequisites: Node 18+
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/ (deploy this folder)
npm run preview  # serve dist locally
npm test         # Vitest — share-token encode/decode/expiry/malformed/revoked
```

**Deploy (any one):**
- *Vercel:* `vercel --prod` or drag `dist/` in dashboard → framework: Vite.
- *Netlify:* `netlify deploy --prod --dir dist` or drag-drop `dist/`.
- *GitHub Pages:* push, then Actions → “Deploy static content” with `dist/` as artifact. Hash routing needs no `_redirects`.

## 5. Open-source disclosure

React, React-DOM, React-Router-DOM, Vite, @vitejs/plugin-react, qrcode.react, **lz-string** (share-token deflate compression, MIT), **Vitest** (test runner, MIT), **pdfjs-dist** (PDF text extraction, Apache-2.0), **tesseract.js** (client-side OCR, Apache-2.0) — all MIT/standard OSS. No hospital systems integrated (per brief: simulated/public data only). No real patient data; all records fictional.

OCR downloads its language packs (English, हिन्दी, தமிழி) from the Tesseract CDN on first use and caches them; after that it works offline. tesseract.js and pdfjs-dist are dynamically imported, so neither is in the initial bundle.

## 6. Evaluation lens

- **Innovation:** patient-owned thread + revocable minimal-share + ER-QR + guardrails in one loop; distinct from PHR lockers that just store PDFs.
- **Technical:** normalized data model, token lifecycle, rule engine, audit, offline-first, responsive, edge cases (expired/revoked/invalid tokens, wrong PIN, empty trends).
- **Feasibility:** static deploy, FHIR/ABDM-ready model (`patient/records/shares` maps to Consent + DocumentReference), Hindi/Tamil i18n + OCR + SMS fallback as next steps.
- **Future:** backend (Supabase/FHIR), e-sign consent, ABDM Health ID link, lab API ingestion, multilingual voice recall.

## Team <Team name>

| Name | Role | Contribution | GitHub |
|---|---|---|---|
| Ankit Negi (Team Leader) | Full-stack developer | Architecture, sharing flow, deployment | [@ankitnegi-dev](https://github.com/ankitnegi-dev) |
| Prince KUmar | Frontend / UI | Design system, emergency card | [@poddarchhatri-source](https://github.com/poddarchhatri-source) |
| Gopoal Nihal | Clinical logic | Interaction and duplicate-test rules, seed data | [@gopal1nihal](https://github.com/gopal1nihal) |

**Institution:** Indian Institute of Information Technology, Design and Manufacturing, Kancheepuram 

**Contact:** <cs24i1007@iiitdm.ac.in>

---
*Disclaimer: demo clinical rules are illustrative for a hackathon, not medical advice.*
