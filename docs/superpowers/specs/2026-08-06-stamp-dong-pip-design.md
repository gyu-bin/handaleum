# 발도장 동네 정리 = 로컬 동 PIP (2026-08-06)

상태: 승인 (사용자 — 발도장 인덱싱 「동네 정리」만 빠르게)

## 목표

앨범 GPS 이후 「동네 정리」단계에서 Apple reverse-geocode를 쓰지 않고,
이미 번들된 `assets/geo/dongs.json` 폴리곤으로 좌표→행정동을 매칭해 발도장을 채운다.

## 비목표

- 지도 칩 / 시트 / 몰아보기 로컬화 (placeResolve·CLGeocoder 유지)
- 새 geo 다운로드·서버
- 읍·면 슬롯

## 흐름

1. GPS 스캔 (기존, 스냅샷 resume 유지)
2. 「동네 정리」= 국내 사진(또는 ~110m 버킷)마다 `dongLookup(lat,lng)` → VisitPlace → `syncStampsFromVisits`
3. 배너 % = 처리한 버킷 / 전체
4. 완료 후 `stampsLibrarySyncAt` (기존 쿨다운)

Pass A/B CLGeocoder 경로는 발도장 sync에서 제거한다.

## 구성

| 모듈 | 책임 |
|---|---|
| `dongLookup.ts` | dongs.json bbox 그리드 인덱스 + `lookupDong(lat,lng)` |
| `stampBackfill.ts` | geocode Pass A/B → local match pass |
| `stampMapIndex` / `dongs.json` | 데이터 소스 공유 (읽기) |

## 성공 기준

- [x] 발도장 sync 「동네 정리」에 CLGeocoder 호출 없음 (코드)
- [ ] 기기: 배너가 GPS 이후 상대적으로 빨리 끝남
- [ ] 기기: 발도장에 동 체크가 쌓임
- [x] 지도 칩 경로 미변경 (코드)

## 리스크

- 간소화 폴리곤·행정동 vs 사진 법정동 불일치 → 경계 오탐 가능
