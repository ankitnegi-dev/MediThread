# 🧵 MediThread — Own Your Health History

> **Hackathon:** 24-Hour Web Development Hackathon · IIITDM Kancheepuram
> **Domain:** HealthTech
> **Problem:** *Lost in Transit: Fragmented Medical Records and Repeated Care Across Providers*

One timeline for your entire health history. Upload once, carry everywhere, share safely — no more folders, WhatsApp forwards, or starting from scratch at every new doctor.

**Live demo:** deploy `dist/` to any static host (Vercel / Netlify / GitHub Pages) — no backend, no login, judges can use instantly.

---

## 1. Problem → Solution mapping

| Brief challenge | MediThread answer |
|---|---|
| **Scattered records** (prescriptions, labs, scans in different places/formats) | Unified searchable timeline, newest-first, filter by type/provider/condition. Simulated AI parse normalises uploads (photo/PDF → typed record). |
| **Unreliable recall** (allergies, meds, doses forgotten in short consults) | Always-on patient summary: conditions, current meds with doses, allergies, blood group, emergency contact. Doctor sees it before asking. |
| **Repeated tests + conflicting treatment** | Duplicate-test guard (HbA1c 90d, Creatinine 60d, LDL 120d…) nudges “view prior result instead of repeating”. Curated interaction engine flags e.g. Telmisartan + Ibuprofen *before* you take it. |
| **Insecure, difficult sharing** | Consent-based expiring links: pick records → 1h/24h/7d expiry → token URL (`#/shared/:token`) → revoke anytime → every view logged in audit trail. No chat forwards. |
| **Broken continuity** (new city / new doctor / ER starts from scratch) | Doctor portal writes back to the *same* timeline. ER PIN-gated view + QR works with no login when the patient can't speak. JSON export for moving cities. |

Demo persona: **Meera Krishnan, 52** — Type 2 Diabetes + Hypertension + Hypothyroidism, moved Chennai → Bengaluru, 10 scattered records (2022–2026) including the cautionary 2023 Ibuprofen-without-history visit and the 2025 ER “started from scratch” episode.

## 2. Key features (judge click-path, ~4 min)

1. **📜 Timeline + trends** — search “HbA1c”, filter Labs, open any record. HbA1c 8.1 → 6.8 and Creatinine SVG trend charts prove control without repeating tests.
2. **📤 Upload** — type a filename like `hba1c-oct.pdf` → *Simulate AI parse* → duplicate guard fires if that test was done recently (“already done 22 days ago — share instead”).
3. **💊 Meds & Safety** — try adding `Ibuprofen` → HIGH-RISK Telmisartan interaction blocks with explanation + safer alternative. Try `Paracetamol` → green ✅.
4. **🔗 Share** — select 3 records → 24h link → copy `…#/shared/<token>` → **open the link on your phone over mobile data** (or a second browser with no MediThread data): the records still render, because they travel inside the link. Revoke → the UI states plainly that revocation is enforced locally in this demo. The access log records every open.
5. **🩺 Doctor** (`#/doctor`) — paste the share code → sees *only* the shared records, plus the patient's summary carried in the link → builds a **note code** → sends it to the patient, who pastes it into their timeline (continuity, not scratch).
6. **🚨 Emergency** (`#/emergency`, PIN `2481`) — allergies + meds + blood group + last 5 records, QR printable for wallet/phone. Export JSON / print summary.

## 3. Tech & architecture

- **Frontend-only static app** — React 18 + Vite 5 + React Router (HashRouter so `dist/index.html` works on any host without rewrites) + `qrcode.react`. No backend → zero setup for judges, local-first privacy story.
- **Persistence:** `localStorage` (`medithread:v1`) — patient, records, shares, audit. Reset button restores seeded demo.
- **Share tokens (cross-device):** v2 token is `lz-string(deflate)` over JSON carrying the patient summary **and the selected record payloads**, so a link opens on any device with an empty localStorage. Validated for expiry, malformed input and local revocation. The emergency PIN is deliberately never embedded in a link.
- **Revocation — honest limit:** there is no server, so there is no central consent registry. Revoking blocks the link **in the browser that issued it**; until the link expires on its own, it will still open elsewhere. Production uses a server-side consent registry.
- **Doctor → patient continuity:** with no backend a doctor cannot write into the patient's chart. The Doctor view produces an `mtn1:` **note code**; the patient pastes it under *Sharing → Receive a note* and it joins the timeline.
- **Clinical rules:** `src/utils/medSafety.js` — curated interaction pairs + per-test repeat windows. Illustrative, not medical advice; production would plug DrugBank / CDS Hooks + FHIR.
- **Charts:** hand-rolled SVG (zero chart deps) — deliberate for offline reliability.

```
src/
  App.jsx                 shell + HashRouter + sidebar
  pages/Patient.jsx       timeline / upload / meds / share / emergency tabs
  pages/Clinical.jsx      Doctor + Shared (token) + Emergency (PIN) views
  components/ui.jsx       TimelineItem, TypeBadge, LabChart
  data/seed.js            10-record scattered demo history
  utils/store.js          localStorage CRUD + audit
  utils/medSafety.js      interactions + duplicate-test + simulated parse
  utils/share.js          v2 self-contained token encode / validate + note codes
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

React, React-DOM, React-Router-DOM, Vite, @vitejs/plugin-react, qrcode.react, **lz-string** (share-token deflate compression, MIT), **Vitest** (test runner, MIT) — all MIT/standard OSS. No hospital systems integrated (per brief: simulated/public data only). No real patient data; all records fictional.

## 6. Evaluation lens

- **Innovation:** patient-owned thread + revocable minimal-share + ER-QR + guardrails in one loop; distinct from PHR lockers that just store PDFs.
- **Technical:** normalized data model, token lifecycle, rule engine, audit, offline-first, responsive, edge cases (expired/revoked/invalid tokens, wrong PIN, empty trends).
- **Feasibility:** static deploy, FHIR/ABDM-ready model (`patient/records/shares` maps to Consent + DocumentReference), Hindi/Tamil i18n + OCR + SMS fallback as next steps.
- **Future:** backend (Supabase/FHIR), e-sign consent, ABDM Health ID link, lab API ingestion, multilingual voice recall.

## 7. Team

_Add names + roles here before submission._ Team leader submits via Google Form before **9:00 PM, 10/10/2026** with repo link + demo video (see `demo-script.md`).

---
*Disclaimer: demo clinical rules are illustrative for a hackathon, not medical advice.*
