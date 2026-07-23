# insights 설계

## 엔티티

- InsightsData: 월별 파생 지표 (저장 안 함)
- placeFirstSeen: `{ [동네라벨]: YYYY-MM }` — kv 누적 인덱스
- isPro: RevenueCat entitlement `Handaleum Pro` (+ sqlite 오프라인 캐시)

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| 계산된 인사이트 | 화면 파생 (`useMonthlyInsights`) | geocode처럼 저장 안 함 |
| placeFirstSeen | sqlite kv | "처음 간 곳" 판정 |
| isPro | RevenueCat (+ sqlite 캐시) | 프로 지표 게이팅 |

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| 배치: **전용 인사이트 화면** + 홈 내비 4번째 | 헤더 접이식 / 바텀시트 | 기획서 권장. 헤더 비움 + 공유 확장 여지 | 2026-07-23 |
| 처음 간 곳: **인덱스가 서로 다른 달 2개 이상일 때까지 숨김** | "기록상" 라벨로 노출 | 콜드스타트에 전부 "처음"으로 보이는 오해 방지 | 2026-07-23 |
| 최원거리: **집 없으면 숨김** | 월 중심점 기준 | 기획서 기본 | 2026-07-23 |
| 클러스터 줌: **고정 12** | 지도 현재 줌 | 인사이트는 뷰포트와 무관한 월 요약 | 2026-07-23 |
| 대략 거리: 클러스터 2개 미만이면 숨김 | 0 km 표시 | 의미 없음 | 2026-07-23 |
| 프로 본진은 **월 아카이브(3개월/전체)·₩3,990**. **결제 오프** (`IS_MONETIZATION_LIVE=false`) — 코드·RC 설정은 유지 | 지표만 프로 / expo-iap | brief | 2026-07-23 |

## 경계

- 의존: photos (photos, journey, cluster, home, distanceMeters, resolveClusterDetailLabel), lib/storage, shared
- 의존하는 것: app/insights 라우트, MonthlyMapScreen 내비

## 범위 제외

- 도로 경로 거리, 인사이트 공유 카드, 추세 차트, 해외
