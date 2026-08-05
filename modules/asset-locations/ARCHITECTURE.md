# asset-locations 설계

로컬 Expo 네이티브 모듈. MediaLibrary asset id 배열 → GPS만 배치 조회.

## 엔티티

| 엔티티 | 필드 | 소유자 |
|---|---|---|
| AssetLocationRow | id, latitude?, longitude? | 네이티브 응답 (비영속). 앱 캐시는 photos의 `assetLoc` |

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| 배치 GPS 결과 | 호출부 일회성 | 캐시 쓰기는 `mediaLibrary` / `assetLoc` kv |

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| 로컬 Expo Module (`modules/asset-locations`) | expo-media-library 패치 / JS만 | 파일 미오픈(iOS) + 업스트림 독립 | 2026-08-05 |
| iOS+Android, 월간+전체앨범 | iOS만 / 앨범만 | Discovery 1A 2A | 2026-08-05 |
| 모듈 없으면 `getAssetInfoAsync` 폴백 | 하드 페일 | 구 TestFlight 바이너리에서도 동작 | 2026-08-05 |

## 경계

- 의존: ExpoModulesCore, Photos (iOS), MediaStore/ExifInterface (Android)
- 소비자: `src/features/photos/services/mediaLibrary.ts`

## 범위 제외

- iCloud 원본 다운로드로 GPS 채우기 (기존 deep recheck)
- reverse-geocode
- Expo Go (네이티브 모듈 필요)
