# 발도장 동 사진 — 크게 보기 + 빠른 오픈

상태: 승인 (사용자 2026-08-09, 옵션 1)

## 목표

- 동 탭 → 그리드가 **바로** 보임 (빈 스피너로 막지 않음)
- 썸네일 탭 → 같은 모달 안 **전체화면** 크게 보기, 좌우 스와이프로 같은 동 사진 넘김
- 닫기 → 그리드 복귀

## 결정

| 항목 | 동작 |
|------|------|
| 크게 보기 | 옵션 1 — in-modal horizontal pager |
| 빠른 오픈 | 인덱스 peek 즉시 그리드; miss만 async. 첫 배치 thumb warm 즉시 |
| 히어로 URI | 128 warm 아닌 full (`imageSize` 1080 / `ph://`) |
| 비범위 | 핀치 줌, 공유, 커버 설정 |

## 파일

- `StampDongPhotosModal.tsx` (주)
- `stampDongPhotos.ts` — `peekPhotosForStampLeaf`
- `strings.ts` — a11y/닫기 라벨
