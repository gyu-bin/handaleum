# photos 설계

## 엔티티

- 사진참조 PhotoRef: assetId, takenAt, lat, lng (전부 필수)
- 월별사진 MonthlyPhotos: month, photos[], noLocationCount
- 월요약 MonthSummary: month, totalCount
- 장소클러스터 PlaceCluster: 파생 데이터. 조회 시 계산, 절대 저장하지 않음
- 핀대표사진 PinCover: month + placeKey(~110m 버킷) + assetId — kv 저장
- 지도테마 MapThemeId: dawn | ink | warm — kv 저장
- 방문지 VisitPlace: 파생(geocode). province/city/dong + journey label

원본 사진은 카메라롤에 있고 앱은 assetId 참조만 다룬다.

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| 월별 사진 목록 | TanStack Query (`photosQueryKeys.monthly`) | 소스는 expo-media-library. 서버 데이터 취급 |
| 월별 카운트 | TanStack Query (`photosQueryKeys.summaries`) | 동일 |
| 지도 뷰포트, 시간 슬라이더, 선택 핀, map scale | 화면 로컬 useState | 탐색 중 상태. 공유 불필요 |
| 마지막 조회 월 | sqlite kv + `useCurrentMonth` | 화면마다 useState면 월 선택이 지도에 반영 안 됨 |
| 지도 팔레트 | sqlite kv + `useMapTheme` | 앱 설정. Zustand 대신 kv (기존 month 패턴) |
| 핀 대표 사진 | sqlite kv + `usePinCovers(month)` | 월별 설정. 클러스터 id는 줌에 따라 변하므로 placeKey 사용 |
| 방문지 목록 | 화면 파생 (`useMonthJourney`) | geocode 결과. 저장 안 함 |

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| GPS 없는 사진 완전 제외, 카운트만 표시 | lat/lng optional로 카드 포함 허용 | 사용자 결정. "위치 있는 사진만 표시" 안내로 처리 | 2026-07-17 |
| 몰아보기 수동 스와이프 우선 | 자동 재생 | 가정. 자동 재생은 이후 추가 비용이 쌈 | 2026-07-17 |
| 클러스터링은 순수 함수 (services/cluster.ts) | 지도 라이브러리 내장 클러스터 | 저장 금지 원칙 + 테스트 용이 | 2026-07-17 |
| 지도: **SVG 종이지도 인포그래픽** (`MapSvg` + `ResumableZoom`). 도 경계 + 시 라벨 + 사진 핀 | MapLibre / react-native-maps | 사용자 확정: 네비게이션이 아닌 인포그래픽 | 2026-07-18 |
| 지도 줌: `react-native-zoom-toolkit` `ResumableZoom`. 자동 프레임은 사진 assetId 집합 변경 시에만 | 직접 제스처 / viewBox 애니메이션 | Fabric 크래시·손 뗄 때 튐 회피 | 2026-07-18 |
| 시 라벨: `KOREA_CITIES` + SVG. 여정 문구는 `expo-location` reverse geocode | 시 중심점 근접 매칭 | 근접 매칭 오탐 | 2026-07-18 |
| 점선 발자취: 미표시 | Catmull-Rom 연결 | 사용자 요청으로 제거 | 2026-07-18 |
| 시 경계선: `municipalities.json`에서 이름 끝이 `시`인 것만 | 전체 시군구 / 도만 | 확대 시 구·군 선이 깨져 보임 | 2026-07-18 |
| 대표 사진: **핀(장소 버킷) 단위** | 월 1장 히어로만 | Discovery 1-B | 2026-07-18 |
| 지도 테마: **종이 팔레트 3종** (dawn/ink/warm). SVG 유지 | MapLibre 타일 / 테마 1개 고정 | Discovery 2-A. 이전 "프리셋 1개" 결정 갱신 | 2026-07-18 |
| 하단 방문지: 줌에 따라 **도→시→동** | 고정 시 목록 / 헤더만 | Discovery 3-B | 2026-07-18 |
| 테마·커버 저장: sqlite kv + useSyncExternalStore | Zustand | 기존 month 패턴 재사용. Zustand 미도입 | 2026-07-18 |
| 지도 테마: **dawn 단일** (ink/warm 제거, 스키마 `z.enum(['dawn'])`) | 3종 유지 | 사용자 결정. 정체성 단일화 + 팔레트 유지비 절감. 구조는 유지해 테마팩 복원 여지 | 2026-07-20 |
| 줌 선명도: **정착 시 재투영(rebase)** — `utils/rebase.ts` 순수 수학 + `useMapProjection(baseBBox)` + settle 오케스트레이션. 카메라 정착 시 보이는 영역×2(headroom)로 base를 갈아끼우고 카메라를 {scale:2,0,0}으로 리셋. SVG는 headroom배 오버샘플이라 정착 화면은 네이티브 해상도 | 래스터 오버샘플만 (배율 제곱 메모리, 상한 3 이상 흐림) / 타일링 | Mercator가 (radLng, mercY)에서 아핀이라 swap이 항등 (수치검증: 200 랜덤 카메라 드리프트 5.7e-11px, 5연쇄 누적 없음). zoom-toolkit이 minScale<1을 throw하므로 줌아웃은 headroom으로 해결. 유효 배율 상한 18은 base별 동적 maxScale로 보존 | 2026-07-20 |
| 제스처 체감: **panMode=friction · scaleMode=bounce · decay**, settle는 가장자리/줌 이탈 시에만 rebase (중간 패닝은 SVG 재빌드 생략) | 매 제스처 종료마다 rebase / clamp | 플링 끝 hitch 제거 | 2026-07-23 |
| 하단 방문지 바 제거, 친숙 라벨을 **상단 헤더 칩**으로 | 줌 스코프 바(도→시→동) 유지 | 헤더가 이미 방문지를 보여줘 중복. `VisitScopeBar`/`visitScope` 삭제 | 2026-07-22 |
| 서울 **구** 표시: `dong-gu.json` **법정동→구 테이블**로 복구 | iOS geocode에 의존 / 구 경계 geojson + point-in-polygon | 실기기 진단으로 iOS가 서울에 법정동만 주고 구는 어떤 필드에도 안 줌을 확인. 동은 신뢰 가능 → 테이블이 좌표 계산보다 단순·정확. 이전 "서울 구는 geocode" 결정 갱신 | 2026-07-22 |
| 구 테이블 **전국 일반구 시로 확장** (서울 자치구 + 성남·수원·고양·용인·안양·안산·전주·창원·천안·청주·포항). `{시:{동:구}}` 시-스코프 키. journeyLabel에 구 포함해 구별 칩 분리 | 서울만 / 동 이름 단일 키(전국 충돌) | 비용 동일하고 일관. 시-스코프로 전국 동명 충돌 회피, 시내 충돌 8개(창원7·천안1)는 생략→시 폴백 | 2026-07-22 |
| 클러스터링: **공간 그리드 O(n)** + **줌별 핀 상한** (넘치면 셀 확대). 개요≈30핀, 확대 시 증가 | 시드+haversine O(n²) / 상한 없음 | 대량·전국 산포 시 핀 카펫·튕김 방지 | 2026-07-23 |
| __DEV__ 더미: 고정 ~18핀(도시 허브). 수백~수천 스트레스 더미는 제거 | 대량 랜덤 | 시뮬 확인용만 | 2026-07-23 |
| 유료: 계획=무료 3개월 / 프로 전체·₩3,990. **지금은 `IS_MONETIZATION_LIVE=false`로 전부 개방** | 출시 전 결제 강제 | 도그푸드·출시 우선 | 2026-07-23 |
| 월 GPS 로드: **캐시 히트 즉시 맵 + 배치 점진 갱신**; 다른 달은 현재 월 완료 후 **인접→나머지** 워밍업. 백그라운드면 배치 사이 일시정지, 복귀 시 재개 (`assetLoc` 유지). OS 백그라운드 페치 미도입 | 완료 전 전면 로딩 / OS background-fetch | 첫 페인트 체감 + 라이브러리 없이 재개 | 2026-07-23 |

## 경계

- 이 feature가 의존하는 것: expo-media-library, expo-location, react-native-svg, react-native-zoom-toolkit, react-native-gesture-handler, react-native-reanimated, assets/geo/korea.json, assets/geo/dong-gu.json, lib/storage, shared/constants
- 이 feature에 의존하는 것: cards (photoRefSchema, useMonthlyPhotos, useCurrentMonth를 import)

## 범위 제외

- 사진 편집, 동영상, 위치 없는 사진의 지도/카드 노출
- MapLibre / 실제 타일 지도
- 구 경계 geojson / point-in-polygon (구는 `dong-gu.json` 법정동→구 테이블로 복구)
- 광역시 자치구 표시 (부산 해운대구 등 — iOS 동작 미확인, extractGu 폴백에 의존)
- 몰아보기 자동 재생 (1차 릴리즈)
- 카드 플로우 전면 개편
