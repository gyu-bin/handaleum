# 이번 달 thumb 중간 프리웜 (2026-08-10)

## 결정

- GPS 인덱싱은 기존처럼 **메타만** (빠르기 유지).
- GPS 끝난 뒤 idle에 **이번 달** 작은 thumb(`file://` pin) 미리 생성.
- 우선순위: **핀 seed/cover** → 같은 달 나머지 GPS 사진(상한).
- 다른 달: 그달 열릴 때 동일 로직.
- 스크롤 중(`gridThumbWarmPaused`)·핀 export 폭주 시 양보.

## 상한

- month fill ≤ 160 (우선순위 제외 후)
- warmup queue ≤ 200
- concurrency는 기존 pin export 슬롯 공유

## 비범위

- 라이브러리 전체 thumb 선생성
- 원본 해상도 prefetch
