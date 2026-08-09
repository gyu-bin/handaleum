# 스크롤 히어로 축소 (몰아보기 · 카드 만들기) (2026-08-09)

## 결정

- 스크롤 시 상단 **인스타 프로필식 축소**: 높이 100%→~50% + **위에서 스케일**.
- **덮개(시트 zIndex로 가리기) 금지.** 아래 영역이 위를 덮는 느낌이 아니라, 위 미디어가 작아지며 공간이 비는 느낌.
- Reanimated UI 스레드만. 스크롤마다 `setState` 금지.
- 몰아보기·카드: 미디어 슬롯만 **height + top scale**. 리스트/시트 `translateY` 금지(하단 잘림).
- 그리드: fling 중 warm pause, `maxToRenderPerBatch=1` 금지(셀 팝인 끊김).

## 훅

`useCollapseOnScroll` → `collapseStyle`(height) + `mediaScaleStyle`(scale from top).

## 비범위

- 완전 접기 / 스프링 스냅
