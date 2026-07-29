# cards 설계

## 엔티티

- 회고카드 RecapCard: id, month, title, comment, photoRefs[], template(feed/story), mapSnapshot(viewport min/max lat/lng), createdAt
- RecapCardDraft: RecapCard에서 id/createdAt 제외. 편집 중 상태의 타입
- 사진 원본은 저장하지 않는다. photoRefs는 카메라롤 참조만 담는다

## 상태 소유권

| 데이터 | 분류 | 이유 |
|---|---|---|
| 카드 목록/상세 | TanStack Query (`cardsQueryKeys`) | 소스는 MMKV. 서버 데이터 취급, 오프라인 열람 필수 |
| 편집 중 카드 (선택 사진, 입력 텍스트, 템플릿) | 화면 로컬 useState | 저장 전까지 휘발. 전역 공유 불필요 |

## 결정 기록

| 결정 | 대안 | 선택 이유 | 날짜 |
|---|---|---|---|
| MMKV CRUD를 async 시그니처로 | 동기 API 직접 노출 | TanStack Query 일관성. 소스 교체 여지 | 2026-07-17 |
| 저장 백엔드 expo-sqlite/kv-store로 교체 | MMKV 유지(dev build 필요) / AsyncStorage(비동기라 구조 변경 필요) | 사용자 결정(Expo Go 워크플로우). 동기 API라 기존 파사드·호출부 무변경 | 2026-07-18 |
| 캡처는 react-native-view-shot 우선 | @shopify/react-native-skia | spec 확정. 품질 미달 시에만 skia 재검토 | 2026-07-17 |
| 템플릿 2종 고정 (feed 1:1, story 9:16) | 확장 가능 구조 | spec 확정. 요청 전 확장 금지 | 2026-07-17 |
| 사진 피커 정렬: **최신순 / 위치별** 토글. 위치별은 journey 라벨 섹션(첫 방문순) | 최신만 / 오래된순 포함 | 사용자 선택 C | 2026-07-27 |
| 공유 시트 라이브러리 미확정 | expo-sharing / RN Share API | **임시:** iOS=`Share.share({url})`, Android=앨범 저장 후 갤러리 안내. expo-sharing 도입은 사용자 승인 후 | 2026-07-28 |
| 카드 하단 지도 UX: **지도 제거**. 사진 최대 5장 콜라주. 네이버/칩 탭 취소 (인스타 탭 불가) | B 대표시+칩 / A 전국 / SVG 유지 | 사용자 선택. 사진이 주인공 | 2026-07-30 |

## 경계

- 이 feature가 의존하는 것: photos (photoRefSchema, monthKeySchema, useMonthlyPhotos, useCurrentMonth), lib/storage(MMKV), react-native-view-shot, shared/constants
- 이 feature에 의존하는 것: 없음

## 범위 제외

- 카드 편집(저장 후 수정) — 삭제 후 재생성으로 대체, 필요 시 재검토
- 템플릿 3종 이상, 사진 편집, AI 자동 회고 텍스트, 앱 내 타인 공유
