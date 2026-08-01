# stamps (발도장) 설계

## 엔티티

| 엔티티 | 필드 | 소유자 |
|---|---|---|
| StampEntry | name(시군구), sido(short), firstMonth | kv `stampsCollected` |
| StampId | `${sido}/${name}` | 맵 키 (중구 충돌 방지) |
| StampsUnseen | stampId[] | kv `stampsUnseen` — 탭 배지 |
| SigunguIndex | sido → 시군구[] | `assets/geo/sigungu-by-sido.json` |

VisitPlace는 photos feature 소유. 발도장은 `gu ?? city` / `province`만 소비.
Grain = **시군구** (서울·광역 구, 도 시·군, 일반구 시 → 구).

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| collected / unseen | sqlite kv + useSyncExternalStore | useCurrentMonth 패턴 |
| 시·도 선택, 축하 오버레이 | 화면 로컬 | |
| 방문지 → 도장 sync | MonthlyMapScreen / StampScreen 파생 | geocode 추가 호출 없음 |

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| 총량 = districts + dong-gu 일반구 + municipalities 시 + KOSTAT 군 | 전체 행정구역 재수집 | 시군구 grain | 2026-08-01 |
| 저장 키 = `sido/name` | 시군구명만 | 중구 등 동명 구 충돌 | 2026-08-01 |
| 인사이트 탭 → 발도장 교체 | 새 탭 | 프롬프트. useIsPro 등은 유지 | 2026-08-01 |
| 시·도 칩 전체 노출 | 방문분만 | 프롬프트 기본 | 2026-08-01 |

## 경계

- 의존: photos(VisitPlace, useMonthJourney, useMonthlyPhotos), lib/storage, theme, PinGlyph 언어
- 피의존: HomeNavBar badge, MonthlyMapScreen sync, app/stamps

## 범위 제외

- 지도 위 도장 누적 표시
- 온보딩 마스코트 재사용
- 인사이트 화면 파일 삭제(라우트만 제거)
