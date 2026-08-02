# stamps (발도장) 설계

## 엔티티

| 엔티티 | 필드 | 소유자 |
|---|---|---|
| StampEntry | name(시군구), sido(short), firstMonth | kv `stampsCollected` |
| StampId | `${sido}/${name}` | 맵 키 (중구 충돌 방지) |
| StampsUnseen | stampId[] | kv `stampsUnseen` — 탭 배지 |
| CitiesIndex | sido → city → units[] | `assets/geo/cities-by-sido.json` |

VisitPlace는 photos feature 소유. 발도장은 `gu ?? city` / `province`만 소비.
Grain = **시군구** (서울·광역 구, 도 시·군, 일반구 시 → 구만; 부모 시 이름 수집 금지).

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| collected / unseen | sqlite kv + useSyncExternalStore | useCurrentMonth 패턴 |
| 시·도·시 선택, 축하 오버레이 | 화면 로컬 | |
| 방문지 → 도장 sync (이번 달) | MonthlyMapScreen | 지도가 이미 resolve한 places |
| **전체 라이브러리 sync** | StampScreen 진입마다 | lifetime 누적. 월 스코프 아님 |

## 내비

시·도 칩 → **한 페이지**에서 시별 구역.
- 일반구 시(창원 등): 섹션 헤더 + 구 도장들
- 구 없는 시·군(진주·거창 등): 헤더 없이 도장만 이어서 표시

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| 총량 = districts + dong-gu 일반구 + municipalities 시 + KOSTAT 군 | 전체 행정구역 재수집 | 시군구 grain | 2026-08-01 |
| 저장 키 = `sido/name` | 시군구명만 | 중구 등 동명 구 충돌 | 2026-08-01 |
| 인사이트 탭 → 발도장 교체 | 새 탭 | 프롬프트. useIsPro 등은 유지 | 2026-08-01 |
| 시·도 칩 전체 노출 | 방문분만 | 프롬프트 기본 | 2026-08-01 |
| 내비 = 시·도 한 페이지 + 시 구역 | 시 목록 드릴 | 사용자 피드백 | 2026-08-01 |
| 과거 백필 = 라이브러리 전체 1회 silent | 달 열 때마다 | 사용자 Q1=A + 빠른 체감 | 2026-08-01 |
| **StampScreen 진입마다 전체 라이브러리 sync** | 1회 플래그 / 이번 달만 | 누적이 월에 묶이던 버그 | 2026-08-02 |
| 라이브러리 sync = 실앨범(`forceRealLibrary`) + 권한 ready 후 + GPS 배치마다 점진 반영 | __DEV__ 더미 / 권한 전 시작 / 전부 끝난 뒤 1회 write | 더미·레이스로 과거 도장 누락 | 2026-08-02 |
| 일반구 모시(용인시) 단독 도장 금지 | 시+구 둘 다 | 이중 수집 버그 | 2026-08-01 |
| 진입 연출 = unseen 팝업 id당 1회. 탭 슬램 재생은 유지. 라이브러리 sync silent | 전체 sync도 팝업 | 새 방문만 축하 + 탭 재미 | 2026-08-02 |

## 경계

- 의존: photos(VisitPlace, useMonthJourney, useMonthlyPhotos, loadAllLocatedPhotos, resolveVisitPlaces), lib/storage, theme, PinGlyph 언어
- 피의존: HomeNavBar badge, MonthlyMapScreen sync, app/stamps

## 범위 제외

- 지도 위 도장 누적 표시
- 온보딩 마스코트 재사용
- 인사이트 화면 파일 삭제(라우트만 제거)
- 백필 OS background-fetch
