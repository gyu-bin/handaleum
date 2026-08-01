# 발도장 — 구현 프롬프트 (커서용)

> 그대로 수행. **모든 색·치수·타입은 `src/shared/constants/theme.ts`에서만** 가져오고 하드코딩 색 금지.
> 작업 후 `npx tsc --noEmit`과 `npx expo lint` 통과. 종이지도(새벽) 정체성 유지, Expo Go 안에서 완결(네이티브/알림/빌드 불필요).

## 0. 개념

전국을 다니며 처음 간 **시군구**에 귀여운 도장이 찍히고, "발도장" 화면에서 모은 도장과 진행률을 본다.
- **인사이트 탭 자리를 발도장이 대신한다** (새 탭 없음).
- 재방문 동력 = 수집 + 진행률(빈칸 채우기). 귀여움 = 도장 찍기 모션 + 핀 마스코트.
- 새 도장이 생기면 **홈 하단탭에 빨간 마크**.

## 1. 재사용 (이미 있는 것 — 새 코드 최소화)

| 필요 | 기존 것 |
|---|---|
| 방문 시군구 + 시·도 | `resolveVisitPlaces(photos)` → `VisitPlace { province, city, gu, dong }` (`features/photos/utils/placeJourney`). **시군구 = `gu ?? city`**, 시·도 = `province` |
| 이번 달 사진 | `useMonthlyPhotos(month).data.photos` (집 제외 반영) |
| "처음 간 곳" 인덱스 | `getPlaceFirstSeenRaw`/`setPlaceFirstSeenRaw` (`@/lib/storage`) — 참고만; 발도장은 시군구 grain의 **자체 인덱스**를 둔다(§3) |
| kv 저장 패턴 | `@/lib/storage` (getX/setX 문자열 JSON), 훅은 `useSyncExternalStore`(useCurrentMonth 패턴) |
| 지역 데이터 | `assets/geo/provinces.json`(시·도), `assets/geo/municipalities.json`(시군구 목록) → **시·도 → 시군구[] 총량 인덱스** 생성(§4) |
| 도장/핀 비주얼·모션 | `PinGlyph`(`@/shared/components/BrandMark`), `AnimatedSplash`/`OnboardingArt`의 스탬프 낙하 모션 언어(Reanimated + `ReduceMotion.Never`) |
| 하단탭 | `HomeNavBar`(`features/photos/components`) + `MonthlyMapScreen` navItems |
| 프로 게이팅 | `useIsPro`/`ProPaywallModal`(insights) — **삭제 금지**(월 선택 등에서 사용). 발도장은 무료 기능 |

## 2. 인사이트 처리

- `MonthlyMapScreen`의 navItems에서 `{ href: '/insights', ... icon: 'chart' }` 항목을 **발도장 항목으로 교체**(§8).
- `app/insights.tsx`·`features/insights/screens/InsightsScreen.tsx`는 탭에서 빠지므로 **라우트만 제거**(원하면 화면 파일은 남겨도 됨). `useIsPro`·`ProPaywallModal`·`placeFirstSeen`·`isPro` 저장은 **그대로 둔다**(다른 데서 씀).

## 3. 데이터 모델 & 저장 (kv)

`@/lib/storage`에 헬퍼 추가 (`getPinCoversRaw` 패턴, 문자열 JSON):

```ts
// 수집한 도장: 시군구 라벨 → { sido, firstMonth: 'YYYY-MM' }
const STAMPS_KEY = 'stampsCollected';
export function getStampsRaw(): string | null { ... }
export function setStampsRaw(json: string): void { ... }
// 아직 안 본 새 도장(하단탭 빨간 마크용): 시군구 라벨 배열
const STAMPS_UNSEEN_KEY = 'stampsUnseen';
export function getStampsUnseenRaw(): string | null { ... }
export function setStampsUnseenRaw(json: string): void { ... }
```

- `stampsCollected`: `{ [시군구]: { sido: string; firstMonth: string } }`
- `stampsUnseen`: `string[]` — 새로 찍혔지만 발도장 화면에서 아직 안 본 시군구. 화면 열면 비운다.
- 훅 `useStamps()` (useSyncExternalStore): `{ collected, unseenCount, markAllSeen() }` 노출. `features/stamps/hooks/useStamps.ts`.

## 4. 시·도 → 시군구 총량 인덱스

- `assets/geo/municipalities.json`(시군구) + `provinces.json`(시·도)로 **`{ 시도: 시군구[] }`** 를 만든다. 방법 택1:
  - (권장) 빌드 스크립트로 `assets/geo/sigungu-by-sido.json` 1개 생성(도장 자산은 이걸 import). `dong-gu.json` 만들 때와 동일 방식.
  - 런타임에 두 json에서 group-by.
- **주의(정확도 리스크)**: 발도장 라벨은 `VisitPlace`의 `gu ?? city`로 나온다. 이 라벨이 `municipalities.json`의 시군구 명칭과 어긋날 수 있다(예: `성남시` vs `성남시 분당구`, 광역시 자치구 표기). 매칭 규칙을 하나로 고정하고(같은 시군구 명칭 체계), 안 맞는 케이스는 로그로 남겨 후속 보정. 이 매칭이 이 기능의 **1번 정확도 포인트**.

## 5. 획득 판정 — `useStampSync`

`features/stamps/hooks/useStampSync.ts`. 입력: 현재 월 + `resolveVisitPlaces(photos)` 결과(또는 `MonthlyMapScreen`이 이미 계산한 방문지). 로직:

1. 방문 `VisitPlace`마다 시군구 = `gu ?? city`, 시·도 = `province`.
2. `stampsCollected`에 없으면 추가(`firstMonth = 현재월`) + `stampsUnseen`에 push.
3. 이미 있으면 무시(최초 1회만). 저장은 배치로 1회.
4. 지오코딩 추가 호출 없이 **이미 resolve된 방문지**를 재사용(성능).

호출 위치: `MonthlyMapScreen`(월 지도가 방문지를 이미 구함) 또는 발도장 화면 진입 시 최근 월들 동기화. 중복 실행 안전하게(멱등).

## 6. 발도장 화면 — `features/stamps/screens/StampScreen.tsx`

레이아웃(목업 기준, 깔끔·절제):
- **헤더**: `한달음` 톤 대신 세리프 제목 `발도장` + 작은 **핀 마스코트**(§9) + 새 도장 있으면 `이번 주 +N` 필(pill, `theme.colors.sand`).
- **요약 한 줄**(인사이트 흡수): `이번 달 N곳 · 처음 간 곳 M · 전국 K개 모음` (`theme.type.micro`, subtle). 지표 화면은 따로 안 만든다.
- **시·도 칩 행**: 서울·경기·부산·… 가로 스크롤. 선택 칩 = `theme.colors.accent` 채움. (도장 있는 시·도만 노출 or 전체 노출 — 택1, 기본 전체)
- **진행률**: `선택 시·도 · 수집/총량` + 얇은 바(`theme.colors.accent` on `theme.colors.line`).
- **시군구 도장 격자**(3열): 수집=도장(§7 정적 형태, 살짝 회전), 미수집=`theme.colors.line` 점선 원 + `?`(subtle).
- **4분기 상태**: 로딩 / 에러(재시도) / 빈(도장 0개 → "첫 도장을 찍어보세요") / 정상.
- 진입 시 `markAllSeen()` 호출 → 하단탭 빨간 마크 해제.

`components/StampBadge.tsx`(도장 1개, Props: 시군구·색·모티프·수집여부·press여부), `components/RegionChips.tsx`, `components/MascotPin.tsx`.

## 7. 도장 찍기 애니메이션

`StampBadge`에 press-in 모션(Reanimated, `ReduceMotion.Never` — 스플래시와 동일 정책):
- 새로 찍히는 도장: `scale 1.5→1`(살짝 overshoot, `Easing.out(Easing.back)`), `opacity 0→1`, `rotate` 최종각으로 스냅, 착지 시 옅은 잉크 링(원형 opacity 0.3→0, scale 1→1.4) 1회.
- **획득 순간 오버레이**(발도장 화면 진입 시 새 도장이 있으면): 마스코트 + `○○ 도장 획득!` + 도장이 "쿵" 찍히는 연출 1회. 여러 개면 순차(스플래시 스탬프 리듬 재사용).
- 격자에서 기존 도장은 정적, 이번에 새로 온 것만 press-in 1회.

## 8. 홈 하단탭 빨간 마크

- **테마 토큰 추가**: `theme.colors.notify`(빨강). 팔레트와 어울리는 따뜻한 red 제안: `#CB5A47`. (실제 값은 theme.ts에서 결정)
- `HomeNavItem`에 `badge?: boolean` 추가. `HomeNavBar`의 아이템 우상단에 작은 원(6~7pt, `theme.colors.notify`, 흰 hairline 링) 오버레이(absolute — 배지 용도 허용).
- `NavIcon`에 `'stamp'` 아이콘 추가(도장/스탬프 글리프, stroke는 기존과 동일 `active` 색).
- `MonthlyMapScreen` navItems: `insights` 항목 → `{ href: '/stamps', label: strings.stamps.title, icon: 'stamp', badge: unseenCount > 0 }`. `unseenCount`는 `useStamps()`.
- 새 라우트 `app/stamps.tsx` → `StampScreen`.

## 9. 마스코트

- 작은 핀 캐릭터: `PinGlyph` 기반 + 눈 2개·미소·볼터치(둥근 teardrop + 흰 얼굴). `features/stamps/components/MascotPin.tsx`, 색은 `theme.colors.accent`/`sand`. 지도를 덮지 않는 크기.
- 등장: 발도장 헤더, 획득 오버레이, 빈 상태. (온보딩 재사용은 후속)

## 10. 파일 구조

```
신규 — src/features/stamps/
├── hooks/useStamps.ts          # collected·unseenCount·markAllSeen (kv + useSyncExternalStore)
├── hooks/useStampSync.ts       # 방문 시군구 → 새 도장 추가 (멱등)
├── services/stampsStorage.ts   # parse/update (getStampsRaw 래핑, sigungu index)
├── screens/StampScreen.tsx     # 4분기 조립
├── components/StampBadge.tsx   # 도장 1개 + press-in
├── components/RegionChips.tsx
├── components/MascotPin.tsx
├── index.ts · ARCHITECTURE.md

수정
├── src/lib/storage.ts          # stampsCollected / stampsUnseen 헬퍼
├── src/shared/constants/theme.ts   # colors.notify (빨강) 추가
├── src/features/photos/components/HomeNavBar.tsx  # badge prop + 'stamp' 아이콘 + 배지 오버레이
├── src/features/photos/screens/MonthlyMapScreen.tsx  # navItems insights→stamps(badge), useStampSync 호출
├── src/app/stamps.tsx (신규 라우트) · src/app/insights.tsx (제거)
└── src/shared/constants/strings.ts  # stamps.* 문구
```

- `assets/geo/sigungu-by-sido.json`(생성 시) 추가.

## 11. 문자열 (`strings.stamps`)

`title:'발도장'`, `summary:(곳,처음,총)=>...`, `progress:(a,b)=>\`${a}/${b}\``, `newThisWeek:(n)=>\`이번 주 +${n}\``, `earned:(name)=>\`${name} 도장 획득!\``, `emptyTitle:'첫 도장을 찍어보세요'`, `empty:'처음 간 시군구에 도장이 찍혀요'`, 미수집 slot 등. 하드코딩 문자열 금지.

## 12. 검증

1. `npx tsc --noEmit` + `npx expo lint` 통과.
2. 새 시군구 방문 → 도장 1개만 추가되고 재방문엔 안 늘어남(멱등). 시·도 진행률이 실제 방문과 일치.
3. 새 도장 생기면 **홈 하단탭 발도장에 빨간 마크** → 발도장 열면 사라짐.
4. 발도장 진입 시 새 도장 **press-in 애니메이션** 재생(동작 줄이기 무관). 격자 1·다수 케이스.
5. 시·도 칩 전환 시 해당 지역 도장/진행률만 표시.
6. 한 화면 색 규칙: `notify`는 탭 배지에만, `sand`는 필/틱, `accent`는 진행률·선택 칩에.

## 13. 열린 결정 / 주의

- **시군구 매칭 정확도**(§4) — 최우선 확인. `gu ?? city` 라벨 ↔ municipalities 명칭 일치 규칙 고정.
- 시·도 칩: 전체 노출 vs 방문한 시·도만.
- 획득 판정 실행 위치(지도 화면 vs 발도장 진입) — 멱등이면 둘 다 OK.
- 지도 위 도장 누적 표시는 이번 범위 밖(후속).
