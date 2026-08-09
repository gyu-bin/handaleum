# 그리드 스크롤 warm (2026-08-10)

## 문제

- 앞쪽 N장만 `warmGridThumbs` → 아래로 갈수록 cold `ph://` 디코드로 끊김.
- 스크롤 pause 중 warm 요청이 버려져 resume 후에도 재워밍 없음.

## 결정

1. 마운트된 셀(`useGridThumbUri`)이 `scheduleGridThumbWarm` 호출 → viewport warm.
2. pause 중 요청은 pending(≤96)에 쌓고, resume 시 flush.
3. 헤드 `warmGridThumbs`는 첫 페인트용으로 유지.

## 비범위

- collapse height를 transform-only로 되돌리기
- GPS 인덱싱 자체를 백그라운드 전용 스레드로 이동
