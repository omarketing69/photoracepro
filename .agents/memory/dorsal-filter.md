---
name: Dorsal number filtering
description: Valid dorsal range for this platform and what was done to clean invalid data.
---

## Rule

All events on this platform use dorsal numbers **1–1600** maximum. Any number outside this range is NOT a valid bib number — it is likely a year stamp (2024, 2025), timestamp fragment, banner text, or image metadata artefact.

**Why:** The OCR code previously accepted 4-digit numbers up to 9999 (excluding calendar years), which let through numbers like 1606, 2025, 2029, 2800, 9799 as "dorsals". Event 1 alone had 2,997 photos with invalid dorsals.

**How to apply:** `extractDorsalNumbersFromText()` in `server/google-vision-ocr.ts` now enforces `MAX_DORSAL = 1600` as a hard limit. Do not raise this unless a future event genuinely has more than 1600 participants — and if so, make the limit configurable per event.

## What was cleaned

- 3,160 photos across events 1, 4, 5, 6, 11 had detected_dorsals arrays filtered in-place (kept only values 1–1600). Photos were not deleted, only metadata corrected.
- Event 10: not cleaned via SQL (user restriction), but the OCR code fix applies to all future processing.

## Edge case: Event 5 anomaly

Event 5 (Carrera de la Rama Judicial) had dorsals like 190436–190551 — clearly not race numbers. These were added by an older code version and have been cleaned.
