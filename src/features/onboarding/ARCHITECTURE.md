# onboarding 설계

첫 실행 시 앱 가치를 설명하고 사진 권한으로 유도하는 1회성 안내 흐름.

## 엔티티

도메인 엔티티 없음. 상태는 **앱설정 플래그 하나**뿐.

- 온보딩상태: `seen`(boolean). `lastViewedMonth`·`mapThemeId`와 같은 계열. sqlite kv 저장.

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| `seen` | sqlite kv + `useOnboarding` (useSyncExternalStore) | 앱 전역 1회성 플래그. `useCurrentMonth` 패턴 재사용. Zustand 미도입 |
| 요청 중 busy | 화면 로컬 useState | 권한 요청 진행 표시. 슬라이드 index·사진 불러오기 토글 상태는 제거됨 |

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| 화면 = 문구 + 지도 시트 + **버튼 하나**. 사진 불러오기 토글 제거 | 토글 유지(전체/일부를 앱에서 먼저 물음) | iOS 권한 대화상자가 이미 전체·일부·거부를 묻는다. 앞단 토글은 탭만 늘렸고, 끄면 `/permission`으로 가 같은 질문을 다시 받는 구조였다 | 2026-08-20 |
| 지도 시트에 인화지 사진 5장 + 인출선. 원형 아바타 핀·3점 점선 경로·"사진이 찍힌 곳" 범례 제거 | 기존 원형 핀 + 점선 경로 유지 | 캡션에서 날짜를 뺀 뒤 3점 경로가 근거를 잃었다. 사각 인화지가 종이 지도 문법에 맞고, 사진↔좌표는 인출선이 직접 잇는다. 대전은 핀 사진 확보 시 `PLACES`에 한 줄 추가 | 2026-08-20 |
| 인화지 카드 위치·크기를 **패널 비율**로 잡고 카드가 패널을 벗어나지 않게 배치 | 절대 좌표 / 작은 화면에서 카드 수 줄이기 | 기기별 분기 없이 한 벌로 간다. Android는 `overflow: visible`이 불안정해 시안의 "종이 밖으로 삐져나온 사진"은 안쪽으로 당겼다 | 2026-08-20 |
| 해안선 stroke 폭을 px로 정의하고 지도 스케일로 나눠 그림 | viewBox 단위 고정 폭(기존) | viewBox 단위는 패널이 커질수록 획이 같이 두꺼워져 만화 외곽선이 됐다. px 기준이면 어떤 크기에서도 헤어라인 | 2026-08-20 |
| 헤드라인을 `headlineLead`(300) / `headlineKey`(700) 두 키로 분리하고 `theme.type.lede`(27/38) 신설 | 한 문자열 + `\n`, `type.display`(34) 사용 | display는 한국어 이 길이에서 3줄로 넘친다. 무게 대비가 디자인 의도라 문자열도 둘로 쪼개 고정 | 2026-08-20 |
| 문구를 "이야기/모입니다" → "이번 달 사진이 / 찍은 자리에 놓입니다"로 교체, 어체를 `~습니다`로 통일 | 기존 문구 유지 | '이야기'가 동작을 설명하지 않았고 헤드라인·서브헤드가 같은 말을 반복했다. CTA도 결과를 말하도록 "시작하기" → "이번 달 지도 만들기" | 2026-08-20 |
| 온보딩 지도 패널 = 홈 MapSvg와 동일 **dawn** 바다 채움(`#BFD7E8`) + 양피지 육지·멀티패스 해안 + 사진 핀. 크림 `surface` 카드/반투명 워시 금지(흰 여백으로 보임) | 크림 패널 + 수채 워시 | 홈 지도 톤 일치, 흰 배경 제거 | 2026-08-20 |
| 온보딩이 권한 요청을 **흡수** (마지막 슬라이드 CTA가 `request()`) | 온보딩 → /permission 별도 화면 이동 | 탭 수↓, 가치→허용 매끄러움. `PermissionScreen`은 거부 후 재요청·설정 유도 폴백으로 축소 | 2026-07-23 |
| 라우팅 게이트를 `MonthlyMapScreen`에 (`!seen → <Redirect href="/onboarding">`), 권한 게이트 앞 | app/ 라우트나 _layout에 게이트 | 기존 권한 redirect가 이미 이 화면에 있어 대칭. `seen`은 kv 동기 조회라 first-run에서 즉시 표시 | 2026-07-23 |
| `schema.ts`/`types.ts` 없음 | 플래그에도 zod 스키마 | 상태가 boolean 하나 → `lastViewedMonth`처럼 kv 문자열('1'). 과설계 회피 | 2026-07-23 |
| 완료 시점에 `seen=true` 기록(권한 결과 무관), 허용→`/` / 거부→`/permission` | 허용해야만 seen 기록 | 값 슬라이드는 이미 봤으므로 재노출 안 함. 거부 시 폴백 화면이 재요청 담당 | 2026-07-23 |

## 경계

- 이 feature가 의존하는 것: `@/lib/storage`(kv 헬퍼), `@/features/photos`(`usePhotoPermission`), `@/shared/components`(BrandMark·Button), `@/shared/constants`(strings·theme), expo-router
- 이 feature에 의존하는 것: `photos/MonthlyMapScreen`(`useOnboarding`로 게이트), `src/app/onboarding.tsx`(라우트)

## 범위 제외

- 설정에서 온보딩 다시 보기 (나중)
- 슬라이드별 정교한 일러스트 (단화면 B 패널로 대체)
- 다국어 문구 (i18n 도입 시 일괄)
- 대전 인화지 (핀 사진 없음. `assets/splash/pins/daejeon.png` 확보 시 `PLACES` + `KOREA_SILHOUETTE.pins`에 추가)

## 시안

`docs/onboarding-mock/` — `C-final.png`이 확정안, `plate.png`은 탈락한 A·B·D 방향, `C-copy-options.png`은 문구 3안 비교.
