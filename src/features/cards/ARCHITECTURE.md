# cards 설계

## 엔티티

- 회고카드 RecapCard: id, month, title, comment, photoRefs[], template(feed/story), paperSkin(ivory/fog/sage/blush/ink), commentAlign(left/center/right), mapSnapshot(viewport min/max lat/lng), createdAt
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
| 카드 **UI 크롬**=Plan A (ink/serif 히어로). Feed/Story **템플릿 캔버스**는 pixel 고정 — 레이아웃·sand tick 최소 변경 | 템플릿까지 전면 저널화 | 사용자 Plan A + 내보내기 구도 보존 | 2026-08-05 |
| MMKV CRUD를 async 시그니처로 | 동기 API 직접 노출 | TanStack Query 일관성. 소스 교체 여지 | 2026-07-17 |
| 저장 백엔드 expo-sqlite/kv-store로 교체 | MMKV 유지(dev build 필요) / AsyncStorage(비동기라 구조 변경 필요) | 사용자 결정(Expo Go 워크플로우). 동기 API라 기존 파사드·호출부 무변경 | 2026-07-18 |
| 캡처는 react-native-view-shot 우선 | @shopify/react-native-skia | spec 확정. 품질 미달 시에만 skia 재검토 | 2026-07-17 |
| 템플릿 2종 고정 (feed 1:1, story 9:16) | 확장 가능 구조 | spec 확정. 요청 전 확장 금지 | 2026-07-17 |
| 사진 피커 정렬: **최신순 / 위치별** 토글. 위치별은 journey 라벨 섹션(첫 방문순) | 최신만 / 오래된순 포함 | 사용자 선택 C | 2026-07-27 |
| 공유 시트 라이브러리 미확정 | expo-sharing / RN Share API | **임시:** iOS=`Share.share({url})`, Android=앨범 저장 후 갤러리 안내. expo-sharing 도입은 사용자 승인 후 | 2026-07-28 |
| 카드 만들기: 코멘트 좌·중·우 정렬. 컨트롤은 종이색 동그라미 반대(오른쪽). 글 뒤 commentStrip 배경 제거 | strip 유지 / 왼쪽 배치 | 사용자 지시 | 2026-08-07 |
| 카드 만들기: 템플릿 피커 제거 · 스토리 카드 미리보기+드래그 · 선택 계기판 · sand CTA · 그리드 필드시트 헤더/링 | 정사각 콜라주+템플릿칩 | 사용자 지시 리디자인 (claude design 참조는 MCP 미연결로 지시서만 적용) | 2026-07-31 |
| 카드 만들기 sticky 프리뷰 = **인스타식** height+top scale (시트 덮개/shadow 제거). 콜라주 재측정 없음 | clip-only / zIndex 덮개 | 스펙 `2026-08-09-collapse-header-scroll-design.md` | 2026-08-10 |
| 만들기 성공 후 선택 초안 **즉시 비움** + preview 복귀는 `back()` + stack `freezeOnBlur`. 미리보기 push 직전에만 warm pause (탭 전환 blur에 pause 고정 금지) | dismissTo/replace 재마운트 / blur마다 pause | 저장→뒤로 충돌 + 안드 그리드 warm 고착 | 2026-08-10 |

## 경계

- 이 feature가 의존하는 것: photos (photoRefSchema, monthKeySchema, useMonthlyPhotos, useCurrentMonth), lib/storage(MMKV), react-native-view-shot, shared/constants
- 이 feature에 의존하는 것: 없음

## 범위 제외

- 카드 편집(저장 후 수정) — 삭제 후 재생성으로 대체, 필요 시 재검토
- 템플릿 3종 이상, 사진 편집, AI 자동 회고 텍스트, 앱 내 타인 공유
