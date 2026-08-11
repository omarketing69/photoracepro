---
name: Facial recognition system
description: How selfie-based photo search works and what was needed to make it functional.
---

## Key facts

- Google Vision returns landmark types as **strings** ("LEFT_EYE", not numeric 1) via the Node.js client. Added numeric→string mapping anyway as defense-in-depth for gRPC edge cases.
- `extractLandmarkVector` in `server/google-vision-ocr.ts` generates a 14-dim cosine-comparable vector. Confirmed working: selfie detection produces a valid vector.
- **Root cause of 0 search results**: stored photos (events 6, 10) were processed with old code that stored bounding boxes only — no `landmarkVector`. Search at `/api/free-events/:id/search-by-face` compares selfie vector against stored `landmarkVector`.
- Events 6 and 10: user does NOT want OCR/face re-processing. Leave their faces with bounding-box-only data.
- Event 1 reprocessing (triggered during fix): photos are being re-processed with the fixed code, so event 1 will accumulate `landmarkVector` data over time.
- Cosine similarity threshold: 0.70 (normal), 0.55 (relaxed). Pass `?relaxed=true` to lower the bar.

**Why:** Without `landmarkVector` on stored photos, selfie search always returns 0 results even when selfie detection succeeds.

**How to apply:** For new events to have working selfie search, their photos must go through the async processor (`async-photo-processor.ts`) which calls `detectFacesFromBuffer` and stores full face data including `landmarkVector`.
