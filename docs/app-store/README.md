# App Store — 한달음

## 스크린샷

종이(크림) + 잉크 카피 + 폰 목업. 파스텔 템플릿 아님.

| 사이즈 | 경로 | Connect |
|---|---|---|
| 6.5" / 1284 × 2778 | `docs/app-store/screenshots/1284x2778/` | iPhone 6.5" |
| 6.9" / 1320 × 2868 | `docs/app-store/screenshots/1320x2868/` | iPhone 6.9" (16 Pro Max) |

**원본 UI 캡처:** `docs/app-store/screenshots/live/`

재합성: `python scripts/compose-app-store-shots.py` (Pillow 필요)

| # | 파일 | 화면 | 카피 |
|---|---|---|---|
| 1 | `01-home.png` | 홈 지도 | 한 달의 사진이 지도가 됩니다 |
| 2 | `02-months.png` | 월 선택 | 지난 달을 다시 펼칩니다 |
| 3 | `03-playback.png` | 몰아보기 | 흩어진 하루를 한곳에 |
| 4 | `04-stamps.png` | 발도장 | 동네마다 발도장 |
| 5 | `05-card.png` | 내 회고 | 한 달을 한눈에 |

## App Review Notes (영문 — Connect Notes에 붙여넣기)

```
App name: 한달음 (Handaleum)

WHAT THE APP DOES
Handaleum turns the user’s camera-roll photos that have GPS into a monthly map journal. Features: monthly map with photo pins, journey path, neighborhood “stamp” collection (발도장), recap cards, and playback.

ACCOUNT / LOGIN
No account required. No sign-up. Works fully offline after granting photo library access (and optional location for place labels).

PERMISSIONS
• Photo Library — Required to read photos and GPS metadata to place pins and stamps. Photos stay on device; we do not upload the photo library to our servers for core features.
• Location (When In Use) — Optional / used to reverse-geocode place names and to set a “home” radius so home photos can be hidden on the map. Not used for background tracking.

HOW TO REVIEW
1. Launch the app and allow Photo Library access (Limited or Full is fine).
2. If the device has no geotagged photos, empty states will show until photos with location exist. A device with GPS photos is recommended for full review.
3. Home: monthly map. Month picker. Stamps (발도장). Cards: create a recap card. Playback: swipe through places.
4. Monetization is currently disabled in this build (all features available). RevenueCat may initialize but purchases are not required.

DEMO ACCOUNT
Not applicable — no user accounts.

NOTES
• Uses Naver Map SDK for the Korea map experience.
• Stamp indexing may run after launch using on-device photo GPS; it can continue briefly in background via iOS background task, then resumes when foregrounded.
• Overseas GPS photos are not shown on the map (Korea-focused).
```

## 심사 메모 (한국어 요약)

- 계정/로그인 없음  
- 사진 권한: 앨범 GPS로 지도·발도장 (업로드 없음, 기기 내 처리)  
- 위치 권한: 장소 이름·집 반경용 (백그라운드 추적 아님)  
- 리뷰: GPS 사진 있는 기기 권장 → 홈 / 월 선택 / 발도장 / 카드 / 몰아보기  
- 결제: 현재 비활성, 전 기능 사용 가능  
- 네이버 지도 SDK, 국내(한국) GPS만 지도에 표시  

