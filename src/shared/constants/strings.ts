const MONTH_NAMES = [
  '일월',
  '이월',
  '삼월',
  '사월',
  '오월',
  '유월',
  '칠월',
  '팔월',
  '구월',
  '시월',
  '십일월',
  '십이월',
] as const;

const NATIVE_COUNTS = [
  '한',
  '두',
  '세',
  '네',
  '다섯',
  '여섯',
  '일곱',
  '여덟',
  '아홉',
  '열',
] as const;

function countWord(n: number): string {
  return n >= 1 && n <= 10 ? NATIVE_COUNTS[n - 1] : String(n);
}

/**
 * All user-facing strings live here (i18n is out of scope, but strings are
 * separated per spec section 7).
 */
export const strings = {
  brand: '한달음',
  common: {
    loading: '불러오는 중',
    error: '문제가 발생했습니다',
    retry: '다시 시도',
    confirm: '확인',
    cancel: '취소',
    back: '뒤로',
  },
  permission: {
    title: '사진 접근 권한이 필요합니다',
    description: '한 달의 사진을 지도 위에 펼쳐 보려면 사진 접근을 허용해 주세요.',
    request: '권한 허용하기',
    denied: '설정에서 사진 접근을 허용하면 다시 시작할 수 있습니다.',
  },
  map: {
    emptyMonth: '이 달에는 위치가 있는 사진이 없습니다',
    noLocationNotice: (count: number) =>
      `위치 정보가 있는 사진만 표시됩니다 (제외 ${count}장)`,
    timeFilter: '이 날짜까지',
    timeFilterHint: '슬라이더로 월 안에서 사진 기간을 줄입니다',
    clusterCount: (count: number) => `사진 ${count}장`,
    hint: '드래그로 이동 · 핀치로 확대',
    zoomIn: '확대',
    zoomOut: '축소',
    resetView: '처음으로',
    monthRecord: (monthLabel: string, monthNumber: number, steps: number) =>
      steps > 0
        ? `${monthLabel} — ${MONTH_NAMES[monthNumber - 1]}의 기록 · ${countWord(steps)} 걸음`
        : `${monthLabel} — ${MONTH_NAMES[monthNumber - 1]}의 기록`,
    /** e.g. "이번 달엔 성남시, 서울 - 마포구, 용인시에 갔어요~" */
    monthJourney: (places: string[]) => {
      if (places.length === 0) {
        return '';
      }
      if (places.length === 1) {
        return `이번 달엔 ${places[0]}에 갔어요~`;
      }
      return `이번 달엔 ${places.join(', ')}에 갔어요~`;
    },
    navSeparator: '·',
    themePicker: '지도 색감',
    visitScope: {
      province: '이번 달 · 도',
      city: '이번 달 · 시',
      dong: '이번 달 · 동',
    },
    coverHint: '사진을 눌러 이 장소의 대표 사진으로 지정',
    setAsCover: '대표 사진으로 지정',
    setAsCoverShort: '대표',
    coverSelected: '대표 사진',
    coverBadge: '대표',
  },
  months: {
    title: '월 선택',
    photoCount: (count: number) => `${count}장`,
    empty: '표시할 월이 없습니다',
  },
  playback: {
    title: '몰아보기',
    empty: '이 달에는 보여줄 사진이 없습니다',
  },
  cards: {
    listTitle: '내 회고',
    listEmpty: '아직 만든 회고 카드가 없습니다',
    createTitle: '카드 만들기',
    titlePlaceholder: '이 달의 제목',
    commentPlaceholder: '한 달을 한마디로',
    templateLabel: '템플릿',
    photoLabel: '사진 선택',
    templateFeed: '피드 1:1',
    templateStory: '스토리 9:16',
    save: '저장',
    saveToAlbum: '앨범에 저장',
    saved: '앨범에 저장했습니다',
    share: '공유',
    delete: '삭제',
    notFound: '카드를 찾을 수 없습니다',
    errorTitleRequired: '제목을 입력해 주세요',
    errorPhotoRequired: '사진을 한 장 이상 선택해 주세요',
    selectedCount: (count: number) => `${count}장 선택됨`,
  },
} as const;
