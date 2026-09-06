# Instagram — 한달음

## 피드 캐러셀

한 세트 = 6장, 1080×1350 (4:5). 크림 페이퍼 + 잉크 + 폰 목업 —
App Store 프레임(`docs/app-store/`)과 같은 시스템.

생성: `scripts/.venv/bin/python3 scripts/compose-instagram-shots.py`
출력: `docs/instagram/carousel/`

| # | 파일 | 화면 | 카피 |
|---|---|---|---|
| 1 | `01-hook.png` | 타이포 (한반도 워터마크) | 카메라롤에 쌓인 한 달, / 지도 한 장으로 |
| 2 | `02-map.png` | 홈 지도 (`live/01-home.png`) | 한 달의 사진이 / 지도가 됩니다 |
| 3 | `03-playback.png` | 몰아보기 (`live/03-playback.png`) | 흩어진 하루를 / 한곳에서 |
| 4 | `04-stamps.png` | 발도장 (`live/04-stamps.png`) | 발 닿은 동네마다 / 도장 하나 |
| 5 | `05-card.png` | 내 회고 (`live/05-card.png`) | 한 달을 / 카드 한 장으로 |
| 6 | `06-cta.png` | 타이포 CTA | 이번 한 달을 / 펼쳐 보세요 |

스크린샷은 `docs/app-store/screenshots/live/`의 더미데이터 캡처를 그대로 씀
(`__DEV__` 전국 샘플 앨범 — `src/features/photos/services/dummyPhotos.ts`).

### 넣기 전에 확인

- `HANDLE` — `compose-instagram-shots.py` 상단. 실제 인스타 핸들로 교체.
- `STORE_LINE` — App Store 링크/배지가 확정되면 교체.
