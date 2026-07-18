# 한달음

한 달의 사진을, 종이 지도 위에.

카메라롤의 위치·시간을 읽어 **한국 종이지도**에 펼쳐 두고, 한 달을 천천히 돌아본 뒤 회고 카드로 남기는 앱입니다.

---

## 이런 앱입니다

| | |
|---|---|
| **지도** | 네비게이션이 아니라 SVG 인포그래픽. 핀치·드래그로 확대하고, 발걸음이 핀으로 남습니다. |
| **여정** | reverse geocode로 “이번 달엔 성남시, 서울 - 마포구에 갔어요~” 같은 앨범형 문구. |
| **줌별 방문지** | 하단 목록이 확대에 맞춰 도 → 시 → 동으로 펼쳐집니다. |
| **대표 사진** | 장소(핀)마다 커버 사진을 골라 두면 지도 썸네일에 반영됩니다. |
| **종이 팔레트** | 새벽 · 먹 · 온기 — 지도 색감 세 가지. |
| **회고 카드** | 피드(1:1) / 스토리(9:16) 템플릿으로 한 달을 카드로 저장·공유. |

사진은 앱에 복사하지 않습니다. 카메라롤 `assetId`만 참조합니다.

---

## 스크린

- **월간 지도** — 메인. 종이 지도 + 핀 + 시간 슬라이더
- **월 선택** — 지난 달로 이동
- **몰아보기** — 그달 사진을 한 장씩
- **회고 카드** — 만들고 앨범에 저장

---

## 스택

- **Expo SDK 54** · React Native · TypeScript
- **Expo Go**로 실기기 실행 (dev client 불필요)
- 지도: `react-native-svg` + `react-native-zoom-toolkit`
- 사진: `expo-media-library`
- 장소명: `expo-location` (reverse geocode)
- 로컬 저장: `expo-sqlite/kv-store`
- 스키마: Zod · 데이터 훅: TanStack Query

---

## 시작하기

```bash
# 의존성
pnpm install

# Expo Go
pnpm start
```

같은 Wi‑Fi의 폰에서 Expo Go로 QR을 스캔하세요.

| 스크립트 | 설명 |
|---|---|
| `pnpm start` | Expo Go 개발 서버 |
| `pnpm typecheck` | TypeScript 검사 |
| `pnpm lint` | ESLint |

### 권한

- **사진** — 월간 지도·몰아보기·카드에 필수
- **위치** — 여정 문구·방문지 라벨용 (위치 센서가 아니라 reverse geocode 권한)

GPS가 없는 사진은 지도에 올리지 않고, 제외 장수만 안내합니다.

---

## 폴더 구조

```
src/
  app/                 # expo-router 진입
  features/
    photos/            # 지도 · 월 · 몰아보기 · 권한
    cards/             # 회고 카드
  shared/              # UI · 테마 · 문자열
  lib/                 # sqlite kv, query client
assets/geo/            # 한반도 · 도 · 시 경계
docs/spec.md           # 제품 명세
```

기능별 설계는 각 feature의 `ARCHITECTURE.md`를 보면 됩니다.

---

## 디자인

새벽 블루 종이 톤을 기본으로 합니다.

- 배경 · 바다: 크림 페이퍼 (`#FBF9F4`)
- 강조: 새벽 블루 (`#3A5A78`)
- 토큰: `src/shared/constants/theme.ts`
- 지도 팔레트: `src/shared/constants/mapThemes.ts`

---

## 범위 밖 (의도적)

- MapLibre / 타일 기반 진짜 지도
- 도로·POI·구·군 경계 전부
- 사진 편집 · 동영상
- 클라우드 동기화 · 계정

자세한 제품 결정은 [`docs/spec.md`](docs/spec.md)에 있습니다.

---

## 라이선스

Private — 개인 / 팀 작업용.
