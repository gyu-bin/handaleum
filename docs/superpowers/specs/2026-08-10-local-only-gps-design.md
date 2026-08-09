# GPS·미디어 = 로컬만 (2026-08-10)

## 결정

- 인덱싱/`loadMonthlyPhotos`/`loadAllLocatedPhotos`: **iCloud 원본 다운로드 없음**.
- 핀 thumb export도 `shouldDownloadFromNetwork: false`.
- 네이티브 메타 배치 32, yield 40ms.
- 주간 발도장 패스는 예전에 no-GPS로 캐시한 항목의 **로컬 메타 재조회**만 (다운로드 아님).

## 트레이드오프

- Photos에 “최적화 보관”만 있고 기기에 GPS 메타가 없는 사진은 지도/발도장에서 빠질 수 있음.
- 사용자가 Photos에서 원본을 받은 뒤 주간 재조회·캐시 무효 시 붙을 수 있음.

## 비범위

- iCloud GPS 보강 UI(“클라우드 사진 포함”) 토글
