# Stamp geocode 2-pass Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fast coarse (~1km) stamp geocode with banner, then silent ~110m catch-up.

**Architecture:** Thin photos to coarse cells for Pass A; reuse `resolveVisitPlaces` + `syncStampsFromVisits`. Persist `stampsCoarseGeocodeAt`. Pass B clears banner and finishes `stampsLibrarySyncAt`.

**Tech stack:** Existing placeResolve / stampBackfill / storage kv.

---

### Task 1: Coarse thin helper + check

**Files:**
- Create: `src/features/stamps/services/stampCoarseBuckets.ts`
- Create: `src/features/stamps/services/stampCoarseBuckets.check.ts`

**Step:** Pure `thinPhotosToCoarseBuckets(photos)` — Korea filter optional at call site; key `toFixed(2)`; keep earliest `takenAt` photo’s real coords.

**Check:** `npx tsx src/features/stamps/services/stampCoarseBuckets.check.ts`

### Task 2: Storage coarse timestamp

**Files:**
- Modify: `src/lib/storage.ts` — `get/setStampsCoarseGeocodeAt`

### Task 3: stampBackfill two-pass

**Files:**
- Modify: `src/features/stamps/services/stampBackfill.ts`
- Modify: `src/features/stamps/services/stampLibrarySyncRunner.ts` — clear coarse on user force; resume skip coarse when `librarySyncAt < coarseAt`
- Modify: `src/features/stamps/services/stampSyncResume.ts` + check — `shouldSkipCoarseGeocode`

**Flow after GPS:** Pass A (banner) → set coarseAt → progress done → Pass B (idle banner, chunked fine) → return.

### Task 4: Docs

**Files:**
- Modify: `src/features/stamps/ARCHITECTURE.md` decision row

### Task 5: Verify

- Run checks + `tsc --noEmit`
- definition-of-done
