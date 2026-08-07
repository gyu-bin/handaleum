# photos 설계

## 엔티티

- 사진참조 PhotoRef: assetId, takenAt, lat, lng (전부 필수)
- 월별사진 MonthlyPhotos: month, photos[], noLocationCount
- 월요약 MonthSummary: month, totalCount
- 장소클러스터 PlaceCluster: 파생 데이터. 조회 시 계산, 절대 저장하지 않음
- 핀대표사진 PinCover: month + placeKey(~110m 버킷) + assetId — kv 저장
- 지도테마 MapThemeId: dawn | ink | warm — kv 저장
- 방문지 VisitPlace / ResolvedPlace: 파생(geocode). `placeResolve`가 단일 소스

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
| 방문지 / 장소 라벨 | `placeCache` 메모리+디스크 (`placeRes:`) → `placeResolve` → `useMonthJourney` hydrate | GPS는 assetLoc. 이름은 geocode 후 디스크에 남겨 콜드스타트 칩 즉시 표시 |

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| **UI=Dawn Survey / Plan A** (크림 + 단일 ink·serif 히어로만) / **Map=dawn-blue** (land/water/accent·핀 유지). `terracotta` 토큰은 ink alias. 맵 팔레트 교체 금지 | 전면 저널 맵 리틴트 / UI terracotta 복귀 | 사용자 A안 2026-08-05. philosophy 정렬 | 2026-08-05 |
| 월 선택 = **저널 UI: 연도 스테퍼 + 1–12월 2열** (0장 비활성) | 전체 월 스크롤 / 연도 칩 | 사용자 시안(옵션 C) | 2026-08-02 |
| GPS 없는 사진 완전 제외, 카운트만 표시 | lat/lng optional로 카드 포함 허용 | 사용자 결정. "위치 있는 사진만 표시" 안내로 처리 | 2026-07-17 |
| 몰아보기 = **장소 페이지** (히어로+그리드). 자동재생 없음. 순서=첫 사진 takenAt 오름차순(달 초→말). 지도 연동 비범위 | 지도 이동형 / ▶ 자동 스와이프 | 2026-08-07 A 정리 | 2026-08-07 |
| 몰아보기 수동 스와이프만 | 자동 재생 | 자동재생 무의미 판정 | 2026-08-07 |
| 클러스터링은 순수 함수 (services/cluster.ts) | 지도 라이브러리 내장 클러스터 | 저장 금지 원칙 + 테스트 용이 | 2026-07-17 |
| 지도: **네이버 Dynamic Map** (`@mj-studio/react-native-naver-map`) + 사진 클러스터 마커. SVG는 카드/스플래시용. **dev build 필수**(Expo Go 불가) | RN Maps / SVG 인포그래픽 | 사용자 결정: 한국 지도 품질·라벨. Client ID `i20jt73shx` | 2026-07-27 |
| 지도 줌: Naver `animateCameraTo` / `animateCameraWithTwoCoords`. 월 `frameKey` 변경 시에만 자동 프레임 | RN Maps region / SVG rebase | 네이버 SDK 카메라 API | 2026-07-27 |
| 시 라벨: `KOREA_CITIES` + SVG. 여정 문구는 `expo-location` reverse geocode | 시 중심점 근접 매칭 | 근접 매칭 오탐 | 2026-07-18 |
| 점선 발자취: **핀(클러스터) 중심을 첫 방문 순으로 잇는 폴리라인** + **선 위 방문 순서(1…N)**. 핀 아래 사진 장수 캡션 없음 | 사진마다 연결 / 핀 캡션 장수 | 사용자: 장수 불필요, 선에 순서 | 2026-08-07 |
| 점선 발자취: **핀(클러스터) 중심을 첫 방문 순으로 잇는 폴리라인** (B) | 사진마다 연결(A) / 없음 | 사용자 선택 B. 이전 “전부 제거” 결정 갱신 | 2026-07-27 |
| 시 경계선: `municipalities.json`에서 이름 끝이 `시`인 것만 | 전체 시군구 / 도만 | 확대 시 구·군 선이 깨져 보임 | 2026-07-18 |
| 대표 사진: **핀(장소 버킷) 단위** | 월 1장 히어로만 | Discovery 1-B | 2026-07-18 |
| 지도 테마: **종이 팔레트 3종** (dawn/ink/warm). SVG 유지 | MapLibre 타일 / 테마 1개 고정 | Discovery 2-A. 이전 "프리셋 1개" 결정 갱신 | 2026-07-18 |
| 하단 방문지: 줌에 따라 **도→시→동** | 고정 시 목록 / 헤더만 | Discovery 3-B | 2026-07-18 |
| 테마·커버 저장: sqlite kv + useSyncExternalStore | Zustand | 기존 month 패턴 재사용. Zustand 미도입 | 2026-07-18 |
| 지도 테마: **dawn 단일** (ink/warm 제거, 스키마 `z.enum(['dawn'])`) | 3종 유지 | 사용자 결정. 정체성 단일화 + 팔레트 유지비 절감. 구조는 유지해 테마팩 복원 여지 | 2026-07-20 |
| 줌 선명도: **정착 시 재투영(rebase)** — `utils/rebase.ts` 순수 수학 + `useMapProjection(baseBBox)` + settle 오케스트레이션. 카메라 정착 시 보이는 영역×2(headroom)로 base를 갈아끼우고 카메라를 {scale:2,0,0}으로 리셋. SVG는 headroom배 오버샘플이라 정착 화면은 네이티브 해상도 | 래스터 오버샘플만 (배율 제곱 메모리, 상한 3 이상 흐림) / 타일링 | Mercator가 (radLng, mercY)에서 아핀이라 swap이 항등 (수치검증: 200 랜덤 카메라 드리프트 5.7e-11px, 5연쇄 누적 없음). zoom-toolkit이 minScale<1을 throw하므로 줌아웃은 headroom으로 해결. 유효 배율 상한 18은 base별 동적 maxScale로 보존 | 2026-07-20 |
| 제스처 체감: **panMode=friction · scaleMode=clamp · decay**, settle는 가장자리/줌 이탈 시에만 rebase (중간 패닝은 SVG 재빌드 생략). bounce는 핀치 끝 튕김이라 clamp로 교체. 제스처 중 SVG는 `shouldRasterizeIOS`/`renderToHardwareTextureAndroid` | 매 제스처 종료마다 rebase / bounce | 플링 끝 hitch·핀치 튕김 완화 | 2026-07-27 |
| 하단 방문지 바 제거, 친숙 라벨을 **상단 헤더 칩**으로 | 줌 스코프 바(도→시→동) 유지 | 헤더가 이미 방문지를 보여줘 중복. `VisitScopeBar`/`visitScope` 삭제 | 2026-07-22 |
| 서울 **구** 라벨(여정/칩): `dong-gu.json` **법정동→구 테이블**로 복구 | iOS geocode에 의존 / 구 경계만으로 라벨 | 실기기 진단으로 iOS가 서울에 법정동만 주고 구는 어떤 필드에도 안 줌을 확인. 동은 신뢰 가능 → 테이블이 좌표 계산보다 단순·정확 | 2026-07-22 |
| 구 테이블 **전국 일반구 시로 확장** (서울 자치구 + 성남·수원·고양·용인·안양·안산·전주·창원·천안·청주·포항). `{시:{동:구}}` 시-스코프 키. journeyLabel에 구 포함해 구별 칩 분리 | 서울만 / 동 이름 단일 키(전국 충돌) | 비용 동일하고 일관. 시-스코프로 전국 동명 충돌 회피, 시내 충돌 8개(창원7·천안1)는 생략→시 폴백 | 2026-07-22 |
| 지도 톤: **Figma 서베이 맵에 맞춘 SVG+한지 그레인** (양피지·잉크 경계·산/소나무). 래스터 맵 교체 없음 | 피그마 일러스트 PNG를 배경으로 / 평탄 팔레트 | 줌·rebase·전국 핀 유지하면서 목업 톤 근접. 한강 geo 없음 | 2026-07-27 |
| 방문 마커: **thumb file 즉시 httpUri** → 백그라운드에서 종이 프레임 bake로 교체. 대표 없으면 첫 사진 | bake 끝날 때까지 숨김 | 첫 페인트 체감 | 2026-08-02 |
| 대량 월(수천 장): 마커는 **placeholder symbol 즉시** + cluster `id`=grid cell(멤버수 제외) + 맵 진입 시 스탬프 sync 지연. thumb export 전 `return null` 금지 | thumb 준비될 때까지 핀 숨김 | 2600장에서 trail만 보이던 체감 | 2026-08-02 |
| 월 이미지 워밍: **예산 캡(≤120)** — 보이는 핀 커버/시드 + 시트·재생 **현재 페이지**만 `Image.prefetch`. 월 전체(수천~수만) prefetch 금지 | 월 전체 warm | 50k에서 디스크·MediaLibrary 고갈 방지 | 2026-08-02 |
| 핀 vs 스탬프: 핀 thumb export busy면 라이브러리 GPS 배치 **양보**; 맵은 첫 핀 파도 후 스탬프 시작. cluster cellDeg **줌별 sticky**로 progressive remount 감소 | 고정 4.5s 후 스탬프 / grain 매번 재계산 | 핀 사진 교체 지연 완화 | 2026-08-02 |
| 지도 정돈(A): **BUILDING 등 레이어 off** + 핀 `isHideCollidedSymbols`. POI 랜드마크 단독 필터는 SDK 미지원 | 커스텀 방문 라벨(B) | 사용자 선택 A | 2026-07-27 |
| 지도 라벨: 제스처 중에도 **마운트 유지** (MapScreenAnchor). 숨김은 깜빡임의 원인 | 제스처 중 unmount | 확대/패닝 시 라벨 깜빡임 해소 | 2026-07-27 |
| 클러스터링: **공간 그리드 O(n)** + **줌별 핀 상한** (넘치면 셀 확대). 개요≈20핀, 확대 시 ≤116 | 시드+haversine O(n²) / 상한 없음 | 대량·전국 산포 시 핀 카펫·튕김 방지 | 2026-07-23 |
| 대량 사진 안정성: GPS `LOCATION_BATCH=8`, 핀 thumb export **동시 2**, URI/bake **LRU**, 그리드 FlatList window 축소 + expo-image recycling/clearMemoryCache | 무제한 Promise.all / 캐시 무한 성장 | 수백 장 월에서 ImageManipulator·디코드 jetsam 완화 | 2026-07-29 |
| 핀 thumb **디스크 LRU**(최대 400, cacheDirectory) | 전 라이브러리 영구 복사 / 메모리만 | 재실행 시 export 생략, 앱 용량 상한 | 2026-08-02 |
| __DEV__ 더미: **서울·경기 고정 ~55장** (구/시 허브). picsum 썸네일. 설정에서 off | 전국 랜덤 / 수백~수천 스트레스 | 시뮬·위치별 피커 확인용 | 2026-07-27 |
| 유료: 계획=무료 3개월 / 프로 전체·₩3,990. **지금은 `IS_MONETIZATION_LIVE=false`로 전부 개방** | 출시 전 결제 강제 | 도그푸드·출시 우선 | 2026-07-23 |
| 월 GPS 로드: **캐시 히트 즉시 맵 + 배치 점진 갱신**; 다른 달은 현재 월 완료 후 **인접→나머지** 워밍업. **백그라운드에서도 계속**(UIBackgroundTask). 앨범 스탬프 스캔과만 배타 | 백그라운드 일시정지 | 나가도 인덱싱 이어감 | 2026-08-06 |
| **Place resolve (A):** GPS→핀 유지. 좌표→이름은 `placeResolve` + 디스크 캐시. 파서=**행정단위 토큰 파이프라인** (`adminTokens`). 시트/여정/발도장/카드/몰아보기 동일 API | 화면별 geocode / 필드별 휴리스틱 | 불일치·리 누락·콜드스타트 | 2026-08-02 |
| 주소 파싱: 전 필드 토큰화 후 계층 조립. **읍·면·동·리를 버리지 않음** (`eupMyon` 필드). 라벨=구>동·리>읍·면>시. place cache v16 / parse rev 12 | 시 있으면 읍·면 drop → 전부 "강릉시"로 붕괴 | 교향리/주문진읍 등 농어촌 칩 누락 | 2026-08-03 |
| 2글자 법정동(우동·중동·목동)은 `dong-gu` 화이트리스트로만 토큰 인정. 매칭 후 같은 kind로 최장 확장(중동 ⊂ 중동리) | 3글자 이상만 동 인정 | 부산 우동 등 2글자 동 전체 누락 | 2026-08-03 |
| geocode는 **직렬 큐 + 최소 간격 + 지수 백오프 + 3회 재시도**. 실패 버킷을 버리지 않음 | 동시 6 Promise.all | CLGeocoder 스로틀로 임의 장소가 영구 누락(교항리) + JS 스레드 잼 | 2026-08-03 |
| geocode 큐 **우선순위 2단**: interactive(90ms — 칩·시트·몰아보기) > background(300ms — 발도장 전체 스캔). interactive는 부분 실패 시 **1회 재패스** | 단일 FIFO | 전체 앨범 스캔이 이번 달과 1:1 경합 + 스로틀 창에 걸린 리가 세션 내내 누락 | 2026-08-03 |
| 버킷 지오코딩은 **실제 사진 좌표**로 (캐시 키만 110m 반올림). place cache v17 — 발도장 rev는 유지(시·군 단위는 78m 무관) | 반올림 좌표로 조회 | ±78m가 리 경계를 넘어 교항리→주문리로 병합. Apple 사진과 결과가 달라진 원인 | 2026-08-03 |
| 사용감: 전체앨범 GPS에 **배치 yield**, 배치 8, 월워밍업↔앨범스캔 배타(`fullAlbumScanBusy`), 발도장 탭 즉시스캔→12s 지연, 핀 bake는 **선택 핀만**, 줌 recluster 180ms debounce. 발도장 sync geocode는 **백그라운드 계속**(UIBackgroundTask) + gap 280ms | 동시 스캐너 / 전 핀 bake / 즉시 앨범 스캔 | 지도 사용 중 발열·버벅 → 인덱싱은 잠금 중에도 진행 | 2026-08-06 |
| 지도 핀: React key=**seed assetId** (grain 아님) + `peekAssetFileUri` 첫 페인트. 맵 워밍은 cover만. grain sticky ±1줌 | key=`grain:cell` 리마운트 → 캐시 있어도 placeholder 깜빡 + 네이티브 churn | 확대 시 이미지 깜빡·쓰다 보면 버벅 | 2026-08-04 |
| 맵 격리: `memo(MapCanvas)` + `memo(MapClusterMarker)` 비교, 스탬프 뱃지는 HomeNavBar 구독, sync notify 2s throttle, GPS partial 1.4s | 칩/스탬프 setState가 네이티브 마커 전부 재평가 | 사용 중 지도 버벅 | 2026-08-04 |
| 디스크 miss를 메모리에 기억(`diskMissCache`), 동일 버킷 in-flight 합치기. `resolveVisitPlaces`는 캐시분 즉시 emit 후 점진 갱신 | 리페인트마다 버킷당 동기 SQLite read | 칩 스크롤 끊김 | 2026-08-03 |
| 광역시 라벨은 **짧은 형태로 통일**: "서울 강남구". `toSiForm` 삭제 | 시트·몰아보기만 "서울시 강남구" | 같은 장소가 칩과 시트에서 다르게 보였음 | 2026-08-03 |
| place resolve를 4개로 분리: `placeCache`(버킷키·2단 캐시) / `geocodeQueue`(권한·직렬 큐) / `visitPlaceBuild`(순수 조립) / `placeResolve`(네이밍 정책 + 공개 API). 외부는 계속 `placeResolve`만 import | 단일 456줄 파일 | 캐시·스로틀·조립이 한 파일에 섞여 원인 추적이 어려웠음 | 2026-08-03 |
| 여정 칩: 디스크 hydrate 즉시 + GPS partial 중에도 geocode(캐시 우선). 빈 결과로 기존 칩을 지우지 않음. visit place 중복은 시+구+동 단위 | `!isFetching` 대기만 / 매 partial마다 wipe | 콜드스타트 "사진 n장"만 · 칩 소실 | 2026-08-02 |
| GPS 핫패스: 로컬 모듈 `asset-locations`가 **배치로 PHAsset.location / Android EXIF latlng** 읽음. `getAssetInfoAsync`(원본·EXIF 전체)는 모듈 없거나 iCloud deep recheck일 때만 | 장마다 getAssetInfoAsync | expo가 파일까지 열어 발열·저속. 발자취식 메타만 읽기와 정렬 | 2026-08-05 |

## 경계

- 이 feature가 의존하는 것: `asset-locations` (로컬 네이티브), expo-media-library, expo-image-manipulator, expo-location, @mj-studio/react-native-naver-map, react-native-svg (카드/스플래시), react-native-gesture-handler, react-native-reanimated, assets/geo/*, lib/storage, shared/constants
- 이 feature에 의존하는 것: cards (photoRefSchema, useMonthlyPhotos, useCurrentMonth를 import)

## 범위 제외

- 사진 편집, 동영상, 위치 없는 사진의 지도/카드 노출
- Expo Go로 홈 맵 실행 (네이버맵은 development build 필요)
- MapLibre / 커스텀 타일셋
- 전국 시군구·일반구 경계 (특별시·광역시 자치구만 `districts.json` — 카드 SVG용)
- 몰아보기 자동 재생 (제거됨 · 재도입 보류)
- 몰아보기 지도 이동형 스토리
- 카드 플로우 전면 개편
