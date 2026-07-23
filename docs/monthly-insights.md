# 이달의 인사이트 — 기획서

> 구현 착수용 문서. 이번 달 사진 데이터로 "요약 지표"를 계산해 보여주는 기능.
> 커서에서 이 문서 기준으로 구현. 착수 전 배치(§5)·"처음 간 곳"(§3.2) 결정 확정할 것.

## 0. 한 줄 정의

이번 달 사진의 위치·시간을 굴려 "이번 달 이런 걸 했구나"를 몇 개의 숫자로 정리해 보여준다. 전부 기기 로컬 계산, 서버·네트워크 불필요. 브리프가 인정한 "미감 차이뿐"인 약점에 **실제 기능 하나**를 더하는 항목이자, 유료(프로) 앵커.

## 1. 성공 기준

- [ ] 1,000장 월에서 계산이 체감 지연 없이(기존 지도 로딩 예산 안에서) 끝난다. 클러스터·라벨은 이미 계산/캐시된 걸 재사용.
- [ ] "다녀온 동네 수"가 지도 헤더의 여정 칩 개수와 일치한다(같은 소스).
- [ ] 집 사진·위치 없는 사진 제외 규칙이 지도와 동일하게 반영된다.
- [ ] 집 미지정·빈 달 등에서 깨지지 않고 적절한 빈 상태를 보인다.

## 2. 데이터 소스 (전부 기존 것 재사용)

| 필요 | 출처 |
|---|---|
| 이번 달 사진(집 제외, 지도 대상) | `useMonthlyPhotos(month).data.photos` |
| 전체 사진(집 포함) | `...data.allPhotos` — 인사이트는 기본 `photos` 사용(지도와 일관) |
| 제외 카운트 | `...data.noLocationCount`, `.homeExcludedCount` |
| 근접 묶음(핀) | `clusterPhotos(photos, zoom)` → `PlaceCluster[]` (`centerLat/Lng`, `photos[]`) |
| 방문 동네 라벨(친숙/구/동) | `resolveVisitPlaces(photos)` + `labelsForVisitLevel` / `useMonthJourney(photos).places` |
| 장소 상세 라벨 | `resolveClusterDetailLabel(lat, lng)` (버킷 캐시됨) |
| 집 위치 | `useHomeLocation().home` (`{lat,lng,radiusM} | null`) |
| 두 지점 거리(m) | `distanceMeters(aLat,aLng,bLat,bLng)` — `features/photos/utils/homeFilter.ts` (haversine, 이미 존재) |

새 라이브러리 없음.

## 3. 지표 정의 (계산 방법 명시)

### 3.1 다녀온 동네 수 — `placesCount` · 무료
- `useMonthJourney(photos).places.length` (친숙 라벨 grain, 집 제외 반영). 지도 칩과 동일 소스.

### 3.2 처음 간 곳 — `newPlacesCount` · 무료  ★결정 필요
- 정의: 이번 달 방문 동네 중, **과거에 간 적 없는** 곳의 수.
- 과거 비교가 필요 → 계산 비용이 있는 유일한 지표. 권장 방식:
  - kv에 `placeFirstSeen` = JSON `{ [동네라벨]: 'YYYY-MM' }` 인덱스를 둔다.
  - 어떤 달을 계산할 때: 그 달의 distinct 동네 라벨마다 인덱스를 `min(기존, 해당월)`로 갱신(사용자가 월을 역순으로 봐도 "가장 이른 달"을 저장).
  - "이번 달 처음 간 곳" = `placeFirstSeen[label] === 이번달` 인 라벨 수.
- **콜드스타트 한계**: 기록이 없으면 모든 곳이 "처음"으로 보인다. 대응(택1, 착수 전 결정):
  - (a) 인덱스에 2개월 이상 데이터가 쌓이기 전엔 이 지표를 숨김("기록 쌓이는 중").
  - (b) 그대로 노출하되 라벨을 "처음 간 곳(기록상)"으로.
- 비권장 대안: 매번 과거 전체 사진을 스캔·지오코딩 → 지오코딩 호출 폭증. 하지 말 것.

### 3.3 가장 멀리 간 곳 — `farthest` · 무료
- 집이 있으면: 각 클러스터 center와 집의 `distanceMeters` 중 최댓값. 표시 = 그 장소 라벨(`resolveClusterDetailLabel`) + `Math.round(m/1000)`km.
- 집이 없으면: 이 지표 숨김(또는 이번 달 사진 중심점 기준 최대 — 착수 시 택1, 기본은 숨김).

### 3.4 제일 많이 찍은 곳 — `topPlace` · 무료
- `clusterPhotos`에서 `photos.length` 최대 클러스터. 표시 = 라벨 + 장수.

### 3.5 대략 이동 거리 — `approxDistanceKm` · 프로
- 시간순으로 정렬한 클러스터(또는 사진) center를 이어 `distanceMeters` 합. **직선 근사**(실제 경로 아님 — 지도 엔진 없음). 표시 = "약 N km".
- 라벨: "대략 이동 거리" (근사임을 명시).

### 3.6 가장 바빴던 날 — `busiestDay` · 프로
- 사진을 촬영일(로컬 날짜)로 그룹핑, 최다 장수 날. 표시 = 날짜 + 장수.

> 지표 추가 여지: 활동 반경, 주말/평일 비중 등. v1은 위 6개.

## 4. 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| 계산된 인사이트 | 화면 파생 (`useMonthlyInsights` 훅, useMemo + 라벨은 비동기) | geocode 결과처럼 저장 안 함. `useMonthJourney` 패턴 미러 |
| `placeFirstSeen` 인덱스 | sqlite kv (`lib/storage.ts` 헬퍼) | "처음 간 곳" 판정용 누적 인덱스 |
| 프로 여부 `isPro` | 지금은 로컬 플래그(추후 RevenueCat) | 유료화 문서 참고. 프로 지표 게이팅 |

Zustand 미도입.

## 5. 배치 (★핵심 결정 — feature-architect에서 확정)

- **권장: 전용 "인사이트" 화면.** 홈 하단 내비에 4번째 항목 추가(`월 선택 · 몰아보기 · 내 회고 · 인사이트`). 지도 헤더를 안 붐비게 하고, 전체 리스트 공간 확보, 추후 "인사이트 카드" 공유 템플릿의 자연스러운 집.
- 대안 A: 지도 헤더 안 접이식 섹션(공간 좁음).
- 대안 B: 지도에서 바텀시트로.
- 무료/프로: 프로 지표(3.5·3.6)는 블러 + "프로" 태그(목업대로). `isPro`면 실제 값.

## 6. 파일 구조 (컨벤션 준수, features/photos·cards 패턴)

```
신규 — src/features/insights/
├── services/computeInsights.ts   # 순수 함수: (clusters, photos, home, journeyPlaces) → InsightsData. throw 없음, 테스트 용이
├── hooks/useMonthlyInsights.ts    # photos 받아 계산. 라벨(비동기)만 resolve. useMonthJourney 패턴
├── screens/InsightsScreen.tsx     # 로딩/에러/빈/정상 4분기. 전용 화면 채택 시
├── components/InsightHero.tsx     # 히어로 숫자 블록 Props
├── components/InsightRow.tsx      # 리스트 한 줄(라벨·값·프로 잠금) Props
├── index.ts                       # barrel
└── ARCHITECTURE.md                # 결정 기록(이 문서 요약 + 확정값)

수정
├── src/lib/storage.ts             # getPlaceFirstSeen / setPlaceFirstSeen (JSON 맵, getPinCovers 패턴)
├── src/app/insights.tsx           # 라우트(배치만) — 전용 화면 채택 시
├── src/features/photos/screens/MonthlyMapScreen.tsx  # 하단 내비에 '인사이트' 항목(navItems)
└── src/shared/constants/strings.ts # insights.* 문구
```

- 계산은 `computeInsights`(순수) + `useMonthlyInsights`(라벨 resolve·조립)로 분리. `resolveClusterDetailLabel`은 비동기라 훅에서.
- `InsightsData` 타입은 순수 함수가 반환하는 형태로 정의(수동 interface 최소, 필요시 `src/features/insights/types.ts`). zod 저장 대상은 `placeFirstSeen`뿐 → 필요하면 작은 스키마, 아니면 `getPinCoversRaw`처럼 문자열 JSON.

## 7. 엣지 케이스

- 집 미지정 → 3.3 숨김(또는 중심점 기준, 기본 숨김).
- 위치 있는 사진 0 / 빈 달 → 빈 상태("이 달은 보여줄 인사이트가 없어요").
- 과거 기록 없음 → 3.2 숨김/캡션(§3.2 결정).
- 클러스터 1개 → 3.5 이동 거리 0 또는 숨김.
- 프로 아님 → 프로 지표 블러 + "프로" 태그.
- 해외 사진: 현재 지도와 동일하게 제외/카운트만. 인사이트도 국내 기준.

## 8. 범위 제외 (v1)

- 실제 이동 경로 거리(도로 기반) — 지도 엔진 없음, 직선 근사만.
- 인사이트 공유 카드 템플릿 — 카드 기능 확장 시 별도.
- 추세 그래프/차트, 월 간 비교 시각화.
- 해외 인사이트.

## 9. 참고

- 로드맵·유료화: 기획 아티팩트 https://claude.ai/code/artifact/35928aa4-44ca-402d-a2bd-aa009a39dd5f
- 목업: 대화의 "이달의 인사이트 목업" 위젯(히어로 2 + 리스트 4, 프로 블러).
- 브리프 §8 "늪 방지선": 완성선(지도 이동형 몰아보기) 이후 별도 결정으로 착수.
