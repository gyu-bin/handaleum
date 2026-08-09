# stamps (발도장) 설계

## 엔티티

| 엔티티 | 필드 | 소유자 |
|---|---|---|
| StampEntry | name(동), city, sido(short), firstMonth | kv `stampsCollected` |
| StampId | `${sido}/${city}/${dong}` | 맵 키 (동명 충돌 방지) |
| DongsIndex | sido → city → leaf[] (동 + 군 읍·면) | `assets/geo/dongs-by-sido-city.json` |
| StampMapUnit | L1 구·시·군 MultiPolygon | `assets/geo/stamp-map-units.json` (pack script) |
| StampsUnseen | stampId[] | kv `stampsUnseen` — 탭 배지 |
| CitiesIndex | sido → city → units[] | `assets/geo/cities-by-sido.json` |
| AdminDongGu | stampCity → 행정동 → 구 | `assets/geo/admin-dong-gu.json` |
| GunEupMyeon | sido → 군 → 읍·면[] | `assets/geo/gun-eupmyeon-by-sido.json` |

VisitPlace는 photos feature 소유. 발도장은 `gu ?? city` / `province`만 소비.
Grain = **시군구** (서울·광역 구, 도 시·군, 일반구 시 → 구만; 부모 시 이름 수집 금지).

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| collected / unseen | sqlite kv + useSyncExternalStore | useCurrentMonth 패턴 |
| 시·도·L1 선택, 축하 오버레이 | 화면 로컬 | |
| **전체 라이브러리 sync만** | 지도/발도장 진입 (single-flight) | 월 선택으로 도장 추가 금지 |

## 내비

시·도 칩 → **L1(구·시·군)** → **L2(동 / 읍·면)**. 시→구→동 3뎁스 금지.
- 광역(서울·부산…): L1=구(+군), L2=동(군은 읍·면)
- 도(경기·경남…): L1=구·시·군 flat(일반구 시는 구만, 부모 시 단독 없음), L2=동 또는 읍·면
- 인덱스: `admin-dong-gu.json`(행정동→구), `gun-eupmyeon-by-sido.json`

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| 발도장 화면 UI = **Plan A** (크림·그레인·ink 진행/도장). 지도 dawn-blue와 분리 — 마스코트/맵 핀 글리프는 dawn accent 유지 가능 | 발도장도 dawn accent / terracotta 복귀 | photos Plan A와 동일 | 2026-08-05 |
| 총량 = districts + dong-gu 일반구 + municipalities 시 + KOSTAT 군 | 전체 행정구역 재수집 | 시군구 grain | 2026-08-01 |
| 저장 키 = `sido/name` | 시군구명만 | 중구 등 동명 구 충돌 | 2026-08-01 |
| 인사이트 탭 → 발도장 교체 | 새 탭 | 프롬프트. useIsPro 등은 유지 | 2026-08-01 |
| 시·도 칩 전체 노출 | 방문분만 | 프롬프트 기본 | 2026-08-01 |
| 내비 = 시·도 한 페이지 + 시 구역 | 시 목록 드릴 | 사용자 피드백 | 2026-08-01 |
| 과거 백필 = 라이브러리 전체 1회 silent | 달 열 때마다 | 사용자 Q1=A + 빠른 체감 | 2026-08-01 |
| **StampScreen 진입마다 전체 라이브러리 sync** | 1회 플래그 / 이번 달만 | 누적이 월에 묶이던 버그 | 2026-08-02 |
| 라이브러리 sync = 실앨범 기본(`forceRealLibrary`) + 지도 지연 kickoff. `__DEV__` 샘플 ON이면 dummy hubs를 GPS 소스로 사용 | 탭 진입 즉시 전체 스캔 / 샘플은 지도만 | 지도 발열 완화 + 시뮬 데모·발도장 일치 | 2026-08-06 |
| StampScreen 루트도 **뒤로** (`router.back`). L1에서는 L1 해제 | 루트 hideBack | 홈에서 push된 화면인데 나갈 길이 없음 | 2026-08-06 |
| 군=군 그대로(강화군), 광역 부모명만 있을 때 도장 안 찍음 | `강화군시` / `대전` 단독 수집 | 슬롯 불일치로 “안 찍힘”처럼 보임 | 2026-08-02 |
| 전체 앨범 sync = 지도 진입에서도 single-flight + GPS 실패 1회 재시도 + geocode miss 재시도 | 발도장 탭에서만 | “모든 GPS 사진 → 시군구” 누적 | 2026-08-02 |
| 발도장 sync = **전 연도 GPS 먼저 전부** → 그다음 geocode (월 진입과 무관) | GPS 배치마다 geocode await | 월 열 때만 도장 찍히는 체감 | 2026-08-02 |
| 발도장 문구 상시 표시 방지: sync **6시간 쿨다운** + iCloud no-GPS **주 1회 deep recheck** + 핀 export 양보 **최대 2.5s** | 방문마다 전체 재스캔 / 핀 idle 무한 대기 | “하루종일 찾는 중” 체감 | 2026-08-02 |
| 발도장 = **국내만** (한국 bbox + 시군구 인덱스에 있는 것만) | 해외 방문도 수집 | 사용자 요청. 지도 해외 핀은 유지 | 2026-08-02 |
| 도장 수집 = 라이브러리 sync만. 월 선택 `useStampSync` 제거 | 월 열 때 places → stamp | 안 간 달 열어도 도장 쌓이던 문제 | 2026-08-02 |
| 발도장 첫 진입 안내 모달 + 백그라운드 sync. sync 중엔 발도장 **게이트**(홈·백그라운드는 열림) | 빈 화면 풀로딩 / 조작 가능 | 사용자 요청 | 2026-08-02 → 2026-08-07 |
| 일반구 모시(용인시) 단독 도장 금지 | 시+구 둘 다 | 이중 수집 버그 | 2026-08-01 |
| 장소 파싱 = 행정 토큰 파이프라인. 발도장 city=시/군만, 라벨용 **eupMyon·dong 보존**. parse rev 12 | 읍·면 drop / 시만 표시 | 여정 칩 붕괴·리 안 보임 | 2026-08-03 |
| 전체 스캔 geocode는 **background 우선순위**(월 화면이 항상 먼저). parse rev 재스캔이 `stampsLibrarySyncAt=0`을 쓰지 않음 — deep GPS recheck는 주 1회 그대로 | rev bump마다 deep recheck | 파서 변경에 GPS 네트워크 재확인이 따라와 버벅임 유발 | 2026-08-03 |
| 광역 법정동→구: `dong-gu`에 부산·인천·대전·대구·광주·울산 추가. province가 시명으로 오던 버그 수정 + `inferSidoForUnit`(강릉시→강원). 인천 `미추홀구` 슬롯 추가. parse rev 4 재스캔 | 서울·일반구만 dong-gu | 인천/대전 구 miss→metro reject, 강릉 province=강릉시→sido null | 2026-08-02 |
| 행정동 숫자 strip (`신정1동`→`신정동`→양천구) + place-parse rev bump 시 쿨다운 무시 1회 재스캔 | 행정동 EXTRA 전수 / 쿨다운 대기 | iOS 행정동 miss → 서울만 → metro reject | 2026-08-02 |
| 진입 연출 = unseen 팝업 id당 1회. 탭 슬램 재생은 유지. 라이브러리 sync silent | 전체 sync도 팝업 | 새 방문만 축하 + 탭 재미 | 2026-08-02 |
| 발도장 sync 중 = **화면 게이트**(진행 바 + 홈은 열림). 뒤로만 가능 | 차단 없음 / 앱 전체 막기 | 사용자 A | 2026-08-07 |
| 발도장 **방문 지도** = 헤더 아이콘 → 팝업. **테두리 없는 한반도 실루엣** + soft 남색 채우기 + 핀치 줌. 탭→시·도 | 사각 프레임 / 인라인 | 사용자: 한반도만·이쁘게·줌 | 2026-08-05 |
| 홈 지도 상단 **인덱싱 배너** (GPS 장수 → 지역 매칭 진행률). sync progress 구독 | 발도장 문구만 | 발자취형 첫 사용 체감 | 2026-08-05 |
| 전체 앨범 GPS = **로컬 메타만** (iCloud 다운로드 없음). 주 1회는 no-GPS **로컬 재조회**만 | network deep recheck | 인덱싱 발열·대기 제거 | 2026-08-10 |
| GPS 끝나면 `stampsGpsScanAt` + located 스냅샷 저장. **Approach A:** 스냅샷 있으면 콜드스타트도 앨범 GPS 스킵(주 1회 deep만 재스캔). force만 스냅샷 삭제. sync/쿨다운 스킵 후 동 사진 인덱스 프리빌드 | 매번 GPS / 더미가 스냅샷 삭제 | “또 앨범 훑는 중” + 팝업 첫 클릭 지연 | 2026-08-07 |
| GPS 끝나면 `stampsGpsScanAt` + located 스냅샷 저장. geocode 중 종료 후 재실행은 **앨범 재스캔 없이** 동네만 이어감(캐시 % 시드). 설정 force만 GPS 재실행 | 매번 GPS부터 | “또 앨범 훑는 중” + 진행 리셋 | 2026-08-06 |
| 발도장 「동네 정리」= **로컬 PIP** (`dongs.json` + 그리드). CLGeocoder·위치권한 불필요. 지도 칩은 placeResolve 유지 | Apple 2-pass geocode | 동네 정리 체감 = GPS 이후 수 초~수십 초 | 2026-08-06 |
| 인덱싱 중 **잠금/앱전환 허용**: iOS `UIBackgroundTask`(asset-locations). OS 만료 후엔 resume | foreground only | 두고 있어도 GPS/PIP 이어감 | 2026-08-06 |
| **동 단위** 발도장 (시·도→시→동). 읍·면 제외 수집 초안. spec: `2026-08-05-dong-stamp-indexing-design.md` | 시군구 유지 | 사용자 확정 B | 2026-08-05 |
| 내비 = **2뎁스** 시·도→구·시·군→동·면. `admin-dong-gu`로 행정동→구 100% | 시→전체 동(서울 425) / 법정동 dong-gu만 | 너무 깊음 피드백 | 2026-08-06 |
| 방문 동 탭 → 큰 사진 팝업. 소스=GPS 스냅샷 + PIP (스키마에 assetId 없음) | 수집 시 assetId 저장 | 사용자 B 확정 | 2026-08-06 |
| 동 사진 그리드 = 카드/몰아보기와 동일 **128 warm file://** + 스크롤 중 warm pause + row-chunk FlatList | 셀마다 원본 `ph://` / numColumns | 호출 경합·스크롤 버벅 | 2026-08-09 |
| 동 사진 = **탭→in-modal 페이저** 크게 보기 + peek 즉시 그리드/warm. 스펙 `2026-08-09-stamp-dong-photos-viewer-design.md` | 한 장 모달만 / 스피너 게이트 | 사용자 옵션 1 | 2026-08-09 |
| 발도장 헤더 타이틀 **화면 중앙** (절대 배치) | flex 균형만 | 사용자 요청 | 2026-08-06 |
| 군 **읍·면** PIP 수집 (`dongs.json`에 군 leaf 포함). 도농복합 시 읍·면은 제외 | 동만 / 시 읍면까지 | 사용자 Q=군만 | 2026-08-06 |
| 방문 지도 = **전국 시·도 실지도** → 탭 시 L1 확대. **같은 StampKoreaMap 인스턴스 유지**(key remount/Fade 제거). 탭=Pressable hitTest. 방문 칸=`stampMapFill` | 전국 L1 / Path onPress / drill remount | 성능 | 2026-08-07 |
| 방문 지도 grain = nation=시·도 칠, drill=L1 구·시·군 (`stamp-map-units.json`). 1동만 있어도 구 전체 칠함 | 동 단위 칠 / 시·도만 | 색칠북 가독성 | 2026-08-06 |
| 전국 = 시·도 윤곽만 + **방문 L1 패치만** 칠 (시·도 전체 wash/점 없음). 확대 L1 유지 | 시·도 풀 칠 / 동 grain | “동 하나면 시 전체” 오해 | 2026-08-08 |
| 방문 지도 = **뷰온리 점 성좌** (동당 점 1개, 탭/드릴다운 없음). 스펙 `2026-08-08-stamp-map-glance-dots-design.md` | L1 wash / 시·도→동 격자 | 한눈 + 디테일, 탭 불필요 | 2026-08-08 |
| 방문 지도 = **시·도 pastel wash** (방문분만) + 전국 라벨 + 동 점 + 권역 범례. 스펙 `2026-08-09-stamp-map-sido-wash-design.md` | 점만 / 점 색만 | 사용자 목업 옵션 2 | 2026-08-09 |
| 방문 지도 = **동 단위 파스텔 방울** (시 전체 칠 없음) + 라벨 + 범례(색·이름만). 점/핀 느낌 지양 | 시·도 wash / 검정 점 | 사용자 B 확정 | 2026-08-09 |

## 경계

- 의존: photos(VisitPlace, placeResolve/resolveVisitPlaces, loadAllLocatedPhotos, geo utils), lib/storage, theme, PinGlyph 언어, assets/geo
- 피의존: HomeNavBar badge, MonthlyMapScreen sync, app/stamps

## 범위 제외

- ~~지도 위 도장 누적 표시~~ → 2026-08-05 히어로 맵으로 범위 오픈
- 온보딩 마스코트 재사용
- 인사이트 화면 파일 삭제(라우트만 제거)
- 백필 OS background-fetch
- 맵 공유/저장 이미지
- 사용자 커스텀 지도 색
- 연간 회고 지도 (12월 로드맵)
