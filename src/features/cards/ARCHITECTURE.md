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
| 카드 만들기 sticky 프리뷰 = 스크롤에 **천천히** 접힘(range 320, minRatio 0.42, deadzone 48). 피커 여유 + 미리보기 유지 | 빠른 접힘(range 90) / 고정 프리뷰 | 사용자: 너무 빨리 접힘 | 2026-08-20 |
| 내 회고 보드 = 곳/날 토글, 라벨은 행정 위치(detailLabel). 선택 칸 view-shot 공유 | 랜드마크 POI / 라벨 편집 persist | 사용자 2026-08-19. 편집은 보류 | 2026-08-19 |
| 내 회고 위치 칸 = 뱀 레일 헤어라인으로 이음. 마지막 줄은 레일 쪽에 붙임 | 가운데 정렬 마지막 줄 | 사용자 2026-08-19 기차 요청 | 2026-08-19 |
| 내 회고 위치 칸 = 한 뱀으로 아래로 이어 스크롤. 가로 페이징 없음 | 곳 3줄 넘으면 가로 페이징 | 사용자 2026-08-19 | 2026-08-19 |
| 날 보기 = 일월화수목금토 월 달력. 곳 보기는 뱀 레일 유지 | 6열 뱀 | 사용자 2026-08-19 | 2026-08-19 |
| 곳 칸 이름 = 길게 눌러 별명. kv `placeAliases` (identity→alias). 다음 달에도 유지 | 세션만 / 랜드마크 API | 사용자 2026-08-19 | 2026-08-19 |
| 내 회고 팝업에서 대표 지정 → 칸·공유 캡처 + 같은 GPS 버킷 홈 핀 커버 | 보기만 | 사용자 2026-08-19 | 2026-08-19 |
| 사진 빼기: kv `hiddenPhotos:{month}` → 지도·회고·몰아보기에서만 숨김. 설정 → 숨긴 사진 목록에서 장별 되돌리기 | 세션만 / 앨범 삭제 | 사용자 2026-08-20 | 2026-08-20 |
| 곳 보기 칸 = 행정 위치 × 로컬 날짜. 같은 동 다른 날은 뱀에 이어짐. 별명은 identity만 | 위치당 1칸(날짜 합침) | 사용자 2026-08-20 | 2026-08-20 |
| 내 회고 공유는 제거. 카드 만들기는 홈과 같은 우측 하단 종이칩 FAB(틱 + 카드 만들기). 공유는 카드 만들기만 | 회고 보드 포스터 공유 / 잉크 사각 + 버튼 | 사용자 2026-08-21 | 2026-08-21 |
| 내 회고 위치/날 = 탭 가운데. 보드 좌우 스와이프로 전환 | 탭만 / 이중 페이지 슬라이드 | 사용자 2026-08-20 | 2026-08-20 |

## 경계

- 이 feature가 의존하는 것: photos (photoRefSchema, monthKeySchema, useMonthlyPhotos, useCurrentMonth, useMonthJourney), lib/storage(MMKV), react-native-view-shot, shared/constants
- 이 feature에 의존하는 것: 없음

## 범위 제외

- 카드 편집(저장 후 수정) — 삭제 후 재생성으로 대체, 필요 시 재검토
- 템플릿 3종 이상, 사진 편집, AI 자동 회고 텍스트, 앱 내 타인 공유
