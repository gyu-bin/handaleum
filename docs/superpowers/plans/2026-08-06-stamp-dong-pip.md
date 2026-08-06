# Stamp dong PIP Implementation Plan

**Goal:** Replace stamp 「동네 정리」 CLGeocoder with local `dongs.json` PIP.

**Done:**
- `dongLookup.ts` + check
- `stampBackfill` GPS → PIP → stamps
- Runner simplified; `STAMPS_PLACE_PARSE_REV = 14`
- Spec + ARCHITECTURE

**Verify:** `npx tsx src/features/stamps/services/dongLookup.check.ts`, `tsc`, device banner timing.
