# onboarding 설계

첫 실행 시 앱 가치를 설명하고 사진 권한으로 유도하는 1회성 안내 흐름.

## 엔티티

도메인 엔티티 없음. 상태는 **앱설정 플래그 하나**뿐.

- 온보딩상태: `seen`(boolean). `lastViewedMonth`·`mapThemeId`와 같은 계열. sqlite kv 저장.

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| `seen` | sqlite kv + `useOnboarding` (useSyncExternalStore) | 앱 전역 1회성 플래그. `useCurrentMonth` 패턴 재사용. Zustand 미도입 |
| 현재 슬라이드 index, 요청 중 busy | 화면 로컬 useState | 탐색 중 상태 |

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| 온보딩이 권한 요청을 **흡수** (마지막 슬라이드 CTA가 `request()`) | 온보딩 → /permission 별도 화면 이동 | 탭 수↓, 가치→허용 매끄러움. `PermissionScreen`은 거부 후 재요청·설정 유도 폴백으로 축소 | 2026-07-23 |
| 라우팅 게이트를 `MonthlyMapScreen`에 (`!seen → <Redirect href="/onboarding">`), 권한 게이트 앞 | app/ 라우트나 _layout에 게이트 | 기존 권한 redirect가 이미 이 화면에 있어 대칭. `seen`은 kv 동기 조회라 first-run에서 즉시 표시 | 2026-07-23 |
| `schema.ts`/`types.ts` 없음 | 플래그에도 zod 스키마 | 상태가 boolean 하나 → `lastViewedMonth`처럼 kv 문자열('1'). 과설계 회피 | 2026-07-23 |
| 완료 시점에 `seen=true` 기록(권한 결과 무관), 허용→`/` / 거부→`/permission` | 허용해야만 seen 기록 | 값 슬라이드는 이미 봤으므로 재노출 안 함. 거부 시 폴백 화면이 재요청 담당 | 2026-07-23 |

## 경계

- 이 feature가 의존하는 것: `@/lib/storage`(kv 헬퍼), `@/features/photos`(`usePhotoPermission`), `@/shared/components`(BrandMark·Button), `@/shared/constants`(strings·theme), expo-router
- 이 feature에 의존하는 것: `photos/MonthlyMapScreen`(`useOnboarding`로 게이트), `src/app/onboarding.tsx`(라우트)

## 범위 제외

- 설정에서 온보딩 다시 보기 (나중)
- 슬라이드별 정교한 일러스트/애니메이션 (현재는 브랜드마크·카드 글리프 정도)
- 다국어 문구 (i18n 도입 시 일괄)
