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
  /** Home hero line under the wordmark. */
  tagline: '사진과 지도, 그리고 나의 이야기',
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
  onboarding: {
    // Shown once on first launch. The last slide's CTA requests photo access,
    // so the value is explained before the permission is asked.
    slides: [
      {
        title: '한 달을 지도 위에',
        body: '카메라롤 사진의 위치와 시간을 새벽 종이지도에 펼쳐,\n지난 한 달을 돌아봐요.',
      },
      {
        title: '한 장의 카드로',
        body: '마음에 든 순간을 골라 인스타 피드·스토리용\n카드로 남기고 공유해요.',
      },
      {
        title: '사진을 볼 수 있게',
        body: '지도를 그리려면 사진의 위치 정보가 필요해요.\n사진은 기기 밖으로 나가지 않아요.',
      },
    ],
    next: '다음',
    skip: '건너뛰기',
    grant: '사진 허용하고 시작',
    /** Replay from Settings — no permission prompt. */
    close: '닫기',
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
    /** Accessibility label for the "!" button that reveals the map notices. */
    infoToggle: '안내 보기',
    /**
     * The one loud line on the map screen. Everything else about the month —
     * the year, the step count — is evidence and belongs in `monthMeta`.
     */
    monthTitle: (monthNumber: number) => `${MONTH_NAMES[monthNumber - 1]}의 기록`,
    /** Evidence line under the title: reads as an instrument, not a sentence. */
    monthMeta: (monthLabel: string, steps: number) =>
      steps > 0 ? `${monthLabel} · ${countWord(steps)} 걸음` : monthLabel,
    /** Shown while GPS for this month is still resolving in the background. */
    resolvingLocations: '위치 확인 중…',
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
    viewOnboarding: '앱 소개 다시 보기',
    proSection: '프로',
    proDescription: (priceLabel: string) =>
      `최근 3개월보다 지난 달을 열고, 인사이트 일부 지표를 잠금 해제합니다. ${priceLabel} · 일회 구매.`,
    proOn: '프로 이용 중',
    proOff: '무료 · 최근 3개월만',
    proPurchase: '프로 구매',
    proRestore: '구매 복원',
    proToggleOn: '프로 켜기',
    proToggleOff: '프로 끄기',
    proPaywall: {
      title: '한달음 프로',
      subtitle: '지도를 더 멀리, 기록을 더 깊게',
      oneTime: '일회 구매 · 구독이 아닙니다',
      later: '나중에',
      cta: (priceLabel: string) => `${priceLabel}에 잠금 해제`,
      benefits: [
        {
          title: '지난 달 전부',
          body: '무료는 최근 3개월만. 프로는 아카이브 전체를 엽니다.',
        },
        {
          title: '인사이트 잠금 해제',
          body: '대략 이동 거리·가장 바빴던 날까지 한눈에.',
        },
        {
          title: '한 번만 결제',
          body: '월 구독 없이, 이 기기에서 계속 이용합니다.',
        },
      ],
    },
  },
  months: {
    title: '월 선택',
    photoCount: (count: number) => `${count}장`,
    empty: '표시할 월이 없습니다',
    freeWindowHint: (priceLabel: string) =>
      `무료는 최근 3개월만 볼 수 있어요. 더 지난 달은 프로(${priceLabel}·일회)에서 열려요.`,
    proOnly: '프로',
  },
  playback: {
    title: '몰아보기',
    empty: '이 달에는 보여줄 사진이 없습니다',
    play: '자동 재생',
    pause: '멈춤',
    placeLoading: '위치 확인 중…',
  },
  cards: {
    listTitle: '내 회고',
    listEmpty: '아직 만든 회고 카드가 없습니다',
    createTitle: '카드 만들기',
    /** Primary CTA on the create screen (not the edit "저장"). */
    create: '만들기',
    previewTitle: '미리보기',
    titlePlaceholder: '이 달의 제목',
    commentPlaceholder: '한 달을 한마디로',
    templateLabel: '템플릿',
    photoLabel: '사진 선택',
    templateFeed: '피드 4:5',
    templateStory: '스토리 9:16',
    shareFormatLabel: '공유 형식',
    save: '저장',
    edit: '제목·코멘트 편집',
    listEdit: '편집',
    listDone: '완료',
    selectAll: '전체 선택',
    deselectAll: '선택 해제',
    deleteSelected: (count: number) => `${count}개 삭제`,
    deleteConfirmTitle: '카드를 삭제할까요?',
    deleteConfirmMessage: (count: number) =>
      count === 1
        ? '이 카드를 삭제합니다. 되돌릴 수 없습니다.'
        : `선택한 ${count}장을 삭제합니다. 되돌릴 수 없습니다.`,
    saveToAlbum: '앨범에 저장',
    saved: '앨범에 저장했습니다',
    share: '공유',
    delete: '삭제',
    notFound: '카드를 찾을 수 없습니다',
    errorTitleRequired: '제목을 입력해 주세요',
    errorPhotoRequired: '사진을 한 장 이상 선택해 주세요',
    /** e.g. "2/3장" — how many photos are picked out of the template's cap. */
    selectedCount: (count: number, max: number) => `${count}/${max}장`,
  },
  insights: {
    title: '인사이트',
    empty: '이 달은 보여줄 인사이트가 없어요',
    placesCount: '다녀온 동네',
    newPlaces: '처음 간 곳',
    newPlacesWarming: '기록 쌓이는 중',
    farthest: '가장 멀리 간 곳',
    topPlace: '제일 많이 찍은 곳',
    approxDistance: '대략 이동 거리',
    busiestDay: '가장 바빴던 날',
    proTag: '프로',
    proHint: '대략 이동 거리·바쁜 날은 프로에서 볼 수 있어요',
    unknownPlace: '알 수 없는 장소',
    farthestValue: (label: string, km: number) => `${label} · ${km}km`,
    topPlaceValue: (label: string, count: number) => `${label} · ${count}장`,
    approxDistanceValue: (km: number) => `약 ${km} km`,
    busiestDayValue: (month: number, day: number, count: number) =>
      `${month}월 ${day}일 · ${count}장`,
  },
} as const;
