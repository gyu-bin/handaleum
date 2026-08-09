# 대량 사진 로드 하드닝 (2026-08-10)

## 제품 기준

전 화면에서 사진이 잘 뜨고 **끊김·강제종료가 없는 것**이 최우선.  
“즉시 전부”보다 “항상 부드럽고, 결국 채워짐”.

## 변경

1. `createConcurrencyLimiter` — `maxQueue` + overflow drop (pin 64 / grid warm 48 / android uri 32).
2. `resolveAssetFileUri` — 실패 시 8s 네거티브 캐시 (큐 overflow 포함).
3. `MapClusterMarker` — burst 6회 + idle 후 1회 재시도 (무한 while 제거).

## 비범위

- Viewport 밖 핀 unmount (다음 티어)
- 디스크 byte budget / orphan sweep
