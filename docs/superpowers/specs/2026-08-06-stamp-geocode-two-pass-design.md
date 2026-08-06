# 발도장 geocode 2-pass (빠른 1차 + 조용한 보충)

날짜: 2026-08-06  
상태: 승인 (사용자 B + 점진 보완)

## 목표

전체 앨범 「동네 정리」가 ~110m 격자마다 CLGeocoder를 호출해 하루 종일 걸리던 체감을 줄인다.  
발도장은 **동 grain**만 필요하므로 1차는 거친 표본으로 빠르게 보여주고, 빠진 동은 2차에서 채운다.

## 비목표

- 오프라인 행정구역 polygon
- background geocode 간격(500ms) 공격적 단축 (Apple 스로틀)
- 이번 달 지도 칩/시트/몰아보기 라벨 경로 변경 (계속 ~110m)

## 동작

### Pass A — 거친 geocode (배너 O)

- 국내 GPS 사진을 **~1km 격자**(lat/lng `toFixed(2)`)당 대표 1장으로 축소
- 그 목록만 `resolveVisitPlaces` (background) → `syncStampsFromVisits`
- 홈 배너 「동네 정리」% = 이 거친 버킷 기준
- 끝나면 `stampsCoarseGeocodeAt` 저장, 배너 done

### Pass B — 미세 보충 (배너 X)

- 같은 sync 실행(또는 resume)에서 전체 사진을 ~110m로 geocode (기존과 동일)
- 홈 배너 다시 띄우지 않음 (`phase: idle` 또는 done 후 idle)
- 새 동 발견 시에만 발도장 notify
- 전부 끝나면 `stampsLibrarySyncAt` (기존 쿨다운)

### Resume (기존 GPS 스냅샷과 조합)

| 상태 | 동작 |
|---|---|
| GPS만 끝 | 스냅샷 → Pass A(배너) → Pass B(무배너) |
| Pass A까지 끝 | 스냅샷 → Pass A 스킵(또는 캐시 즉시) → Pass B |
| Pass B까지 끝 | 6h 쿨다운 스킵 |

설정 **강제 재스캔**: GPS·coarse·스냅샷 초기화 후 A→B.

## 성공 기준

- [x] 구현: Pass A 거친 버킷 + 배너, Pass B 무배너 (코드)
- [ ] 기기: 첫 「동네 정리」가 이전보다 빨리 끝남
- [ ] 기기: 배너 종료 직후 발도장에 동 상당수 표시
- [ ] 기기: Pass B 중 홈 배너가 다시 장시간 안 뜸
- [x] 지도 칩 경로(~110m) 미변경 (코드 분리)

## 위험

- Pass A만으로 이웃 동 누락 → Pass B가 채움 (의도된 B 트레이드오프)
- Pass B는 여전히 길 수 있음 — UI만 막지 않음
