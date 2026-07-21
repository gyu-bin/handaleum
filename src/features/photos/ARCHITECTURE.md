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
| 줌 선명도: **정착 시 재투영(rebase)** — `utils/rebase.ts` 순수 수학 + `useMapProjection(baseBBox)` + settle 오케스트레이션. 카메라 정착 시 보이는 영역×2(headroom)로 base를 갈아끼우고 카메라를 {scale:2,0,0}으로 리셋 (당시엔 오버샘플 병행했으나 07-21에 제거 — 아래 항목) | 래스터 오버샘플만 (배율 제곱 메모리, 상한 3 이상 흐림) / 타일링 | Mercator가 (radLng, mercY)에서 아핀이라 swap이 항등 (수치검증: 200 랜덤 카메라 드리프트 5.7e-11px, 5연쇄 누적 없음). zoom-toolkit이 minScale<1을 throw하므로 줌아웃은 headroom으로 해결. 유효 배율 상한 18은 base별 동적 maxScale로 보존 | 2026-07-20 |
| 오버샘플 **제거** (SVG 1:1 렌더) + 기본 줌 상향 (fit 1.6–5) | 오버샘플 4배 | 오버샘플(SVG를 N배로 그린 뒤 레이어 transform으로 1/N 축소)은 이 react-native-svg 버전에서 **역효과** — 축소 다운샘플이 오히려 흐리게 만듦. 1:1 네이티브 크롭 A/B로 확정(oversample=1이 =4보다 확연히 선명). 선명도는 rebase가 카메라 배율을 낮게(≤headroom) 유지하는 것만으로 충분. react-native-svg는 낮은 합성 배율에서 벡터를 매번 선명하게 재래스터함 | 2026-07-21 |
| 팬/줌 부드러움: ① 핀 `MapAnchor`를 `left/top`→`transform`(레이아웃 패스 제거) ② 제스처 중 지도 레이어 `shouldRasterizeIOS`/`renderToHardwareTextureAndroid` 토글 | 아무 것도 안 함 / 상시 래스터화 | 프레임당 핀 레이아웃 스래싱이 끊김 주원인. 래스터화는 제스처 동안만 켜 벡터맵을 비트맵 캐시(핀치 중 약간 흐림은 감수, settle rebase가 선명 복원). 상시 켜면 정지 상태도 흐려짐 | 2026-07-21 |

## 경계

- 이 feature가 의존하는 것: expo-media-library, expo-location, react-native-svg, react-native-zoom-toolkit, react-native-gesture-handler, react-native-reanimated, assets/geo/korea.json, lib/storage, shared/constants
- 이 feature에 의존하는 것: cards (photoRefSchema, useMonthlyPhotos, useCurrentMonth를 import)

## 범위 제외

- 사진 편집, 동영상, 위치 없는 사진의 지도/카드 노출
- MapLibre / 실제 타일 지도
- 구 경계 geojson 신규 (서울 구는 geocode)
- 몰아보기 자동 재생 (1차 릴리즈)
- 카드 플로우 전면 개편
