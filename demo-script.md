# 🎬 Demo video script (2-5 min) - record this flow, keep repo link + video in submission

> Target: 3:30. One narrator, one screen recording, no edits needed. Show the *problem moment* then the fix.

**0:00-0:25 - Hook (problem)**
- “Meera, 52, diabetes + BP, moved Chennai → Bengaluru. Her history is 10 PDFs across 6 providers + WhatsApp forwards.”
- Show scattered: paper slip photo, two lab PDFs, ER discharge. “New doctor? Start from scratch.”

**0:25-1:10 - Unified timeline (scattered → sorted)**
- Open app → Patient view. Scroll timeline newest-first.
- Search “HbA1c”, filter Labs. Open 2023 record.
- Show trend charts: “HbA1c 8.1 → 6.8. No repeat needed - just share the trend.”

**1:10-1:50 - Guardrails (money + safety)**
- Upload tab: filename `hba1c-oct.pdf` → Simulate AI parse → duplicate alert: “done 22 days ago, window 90 days - share instead.”
- Meds tab: type `Ibuprofen` → red HIGH-RISK (Telmisartan interaction, kidney/BP). Type `Paracetamol` → green safe.

**1:50-2:40 - Secure sharing (no WhatsApp)**
- Share tab: select 3 records → label “Dr. Iyer review” → 24h → Generate link → copy.
- Open link in incognito → doctor sees *only* those 3, with expiry banner.
- Back in app: Revoke → reload incognito → “revoked, request new one.” Point at audit log.

**2:40-3:10 - Doctor writes back + ER**
- Doctor portal: paste code → add “Paracetamol 650mg SOS” note → show it in patient timeline. “Continuity, not scratch.”
- Emergency: open `#/emergency`, PIN 2481 → allergies + meds + blood group + QR. “When the patient can't speak.” Show Export JSON.

**3:10-3:30 - Close**
- “MediThread: one timeline, safe shares, no repeats. Static deploy, local-first, ABDM/FHIR-ready.”
- Show README setup + live public link. End card: team names + repo URL.

**Recording tips:** 1080p, 1.25x for scrolling, zoom to 125%, mute notifications, use fresh “Reset demo” state at start so token/audit timestamps look clean.
