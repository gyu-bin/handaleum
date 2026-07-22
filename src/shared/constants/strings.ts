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
    // Explicit break: left to wrap on its own, this line orphans its last
    // syllable ("요.") on a second line at every width we ship.
    description: '한 달의 사진을 지도 위에 펼쳐 보려면\n사진 접근을 허용해 주세요.',
    request: '권한 허용하기',
    denied: '한 번 거부하면 앱에서 다시 물어볼 수 없습니다.\n설정에서 사진 접근을 켜 주세요.',
    /** Denied is terminal in-app — the only way back is the system settings app. */
    openSettings: '설정에서 허용하기',
  },
  map: {
    emptyMonth: '이 달에는 위치가 있는 사진이 없습니다',
    emptyAllHome: '이 달은 집에서 찍은 사진만 있습니다. 카드는 만들 수 있어요',
    noLocationNotice: (count: number) =>
      `위치 정보가 있는 사진만 표시됩니다 (제외 ${count}장)`,
    homeExcludedNotice: (count: number) =>
      `집에서 찍은 ${count}장은 지도에만 안 띄웁니다 (카드에는 쓸 수 있어요)`,
    settings: '설정',
    timeFilter: '이 날짜까지',
    timeFilterHint: '슬라이더로 월 안에서 사진 기간을 줄입니다',
    clusterCount: (count: number) => `사진 ${count}장`,
    hint: '드래그로 이동 · 핀치로 확대',
    zoomIn: '확대',
    zoomOut: '축소',
    resetView: '처음으로',
    /**
     * The one loud line on the map screen. Everything else about the month —
     * the year, the step count — is evidence and belongs in `monthMeta`.
     */
    monthTitle: (monthNumber: number) => `${MONTH_NAMES[monthNumber - 1]}의 기록`,
    /** Evidence line under the title: reads as an instrument, not a sentence. */
    monthMeta: (monthLabel: string, steps: number) =>
      steps > 0 ? `${monthLabel} · ${countWord(steps)} 걸음` : monthLabel,
    /**
     * Headline above the visit chips. Count-based so the line height stays
     * fixed no matter how many places the month holds — the places themselves
     * are rendered as chips below it.
     * e.g. "이번 달엔 다섯 곳에 갔어요~"
     */
    monthJourney: (places: string[]) => {
      if (places.length === 0) {
        return '';
      }
      if (places.length === 1) {
        return `이번 달엔 ${places[0]}에 갔어요~`;
      }
      return `이번 달엔 ${countWord(places.length)} 곳에 갔어요~`;
    },
    navSeparator: '·',
    coverHint: '사진을 눌러 이 장소의 대표 사진으로 지정',
    setAsCover: '대표 사진으로 지정',
    setAsCoverShort: '대표',
    coverSelected: '대표 사진',
    coverBadge: '대표',
  },
  settings: {
    title: '설정',
    homeSection: '집 위치',
    homeDescription:
      '집 근처에서 찍은 사진은 지도에 핀으로 뜨지 않습니다. 매일 같은 자리에 찍히는 핀은 알려주는 게 없으니까요. 카드를 만들 때는 그대로 고를 수 있습니다.',
    homeUnset: '아직 지정하지 않았습니다',
    homeSet: (radiusM: number) =>
      radiusM >= 1000
        ? `지정됨 · 반경 ${(radiusM / 1000).toFixed(1)}km`
        : `지정됨 · 반경 ${radiusM}m`,
    useCurrentLocation: '지금 위치를 집으로 지정',
    locating: '위치 확인 중',
    clearHome: '집 위치 해제',
    radiusLabel: '제외 반경',
    radiusHint: '집이 아파트 단지 안이면 넓게, 골목이면 좁게 잡으세요.',
    locationDenied: '위치 권한이 없어 집 위치를 지정할 수 없습니다',
    locationFailed: '위치를 확인하지 못했습니다. 다시 시도해 주세요',
  },
  months: {
    title: '월 선택',
    photoCount: (count: number) => `${count}장`,
    empty: '표시할 월이 없습니다',
  },
  playback: {
    title: '몰아보기',
    empty: '이 달에는 보여줄 사진이 없습니다',
    play: '자동 재생',
    pause: '멈춤',
  },
  cards: {
    listTitle: '내 회고',
    listEmpty: '아직 만든 회고 카드가 없습니다',
    createTitle: '카드 만들기',
    titlePlaceholder: '이 달의 제목',
    commentPlaceholder: '한 달을 한마디로',
    templateLabel: '템플릿',
    photoLabel: '사진 선택',
    templateFeed: '피드 4:5',
    templateStory: '스토리 9:16',
    shareFormatLabel: '공유 형식',
    save: '저장',
    edit: '제목·코멘트 편집',
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
