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
  /** Splash editorial line under the wordmark (sample D). */
  splashTagline: '한 달의 사진',
  /** Home hero line under the wordmark. */
  tagline: '한 달의 사진을 지도로',
  common: {
    loading: '불러오는 중',
    error: '문제가 발생했습니다',
    retry: '다시 시도',
    confirm: '확인',
    cancel: '취소',
    back: '뒤로',
  },
  ota: {
    checking: '업데이트 확인 중',
    updating: '업데이트 중',
    done: '업데이트 완료',
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
    /** First-run — monthly photo journal, not walk-tracking. */
    headline: '한 달 동안 찍은 사진이\n지도 위 이야기로 모입니다.',
    subhead: '카메라롤만으로 이번 달 지도를 그려요.',
    photoToggle: '앨범에서 이번 달·지난 기록을 불러와요',
    photoToggleHint: '사진은 기기에만 두고, 위치만 읽어 지도를 그립니다.',
    start: '시작하기',
    /** Kept for settings replay / legacy callers. */
    slides: [
      {
        title: '한 달을 지도 위에',
        body: '카메라롤 사진의 위치와 시간을 지도에 펼쳐,\n한 달을 사진으로 다시 봐요.',
      },
    ],
    next: '다음',
    skip: '건너뛰기',
    grant: '사진 허용하고 시작',
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
    /** Header edge steppers — previous / next calendar month. */
    monthPrev: '이전 달',
    monthNext: '다음 달',
    timeFilter: '이 날짜까지',
    timeFilterHint: '슬라이더로 월 안에서 사진 기간을 줄입니다',
    clusterCount: (count: number) => `사진 ${count}장`,
    placeLoading: '위치 확인 중…',
    placeUnknown: '위치 없음',
    hint: '드래그로 이동 · 핀치로 확대',
    zoomIn: '확대',
    zoomOut: '축소',
    resetView: '처음으로',
    /** Toggle mid-segment visit-order numbers on the journey path. */
    pathOrderToggle: '1·2',
    pathOrderShow: '여정 선·순서 켜기',
    pathOrderHide: '여정 선·순서 끄기',
    /** Accessibility label for the "!" button that reveals the map notices. */
    infoToggle: '안내 보기',
    /**
     * The one loud line on the map screen. Everything else about the month —
     * the year, the step count — is evidence and belongs in `monthMeta`.
     */
    monthTitle: (monthNumber: number) => `${MONTH_NAMES[monthNumber - 1]}의 지도`,
    /** Evidence line under the title — unique spots this month, not walk steps. */
    monthMeta: (monthLabel: string, places: number) =>
      places > 0 ? `${monthLabel} · ${countWord(places)} 곳` : monthLabel,
    /** Shown while GPS for this month is still resolving in the background. */
    resolvingLocations: '이번 달 위치 확인 중…',
    /** Full-album stamp indexing banner (home map). */
    indexingPreparing: '앨범 준비 중',
    indexingPhotos: '앨범 훑는 중',
    indexingPhotoCount: (scanned: string, total: string) =>
      `${scanned}/${total}`,
    indexingPlaces: '동네 정리 중',
    indexingPlaceCount: (done: string, total: string) => `${done}/${total}`,
    indexingPercent: (pct: number) => `${pct}%`,
    indexingPlacesEmpty: '위치 사진 없음',
    indexingDone: '앨범 정리 완료',
    indexingDoneDetail: (photos: string) => `위치 ${photos}장`,
    /**
     * Headline above the visit chips. Photo-journal tone (not walk-tracking).
     * e.g. "이번 달엔 다섯 곳이 남았어요"
     */
    monthJourney: (places: string[]) => {
      if (places.length === 0) {
        return '';
      }
      if (places.length === 1) {
        return `이번 달 사진, ${places[0]}`;
      }
      return `이번 달 사진 ${countWord(places.length)} 곳`;
    },
    navSeparator: '·',
    coverHint: '사진을 눌러 이 장소의 대표 사진으로 지정',
    setAsCover: '대표 사진으로 지정',
    setAsCoverShort: '대표',
    coverSelected: '대표 사진',
    coverBadge: '대표',
    hidePhoto: '이 사진 빼기',
  },
  settings: {
    title: '설정',
    /** Section labels (reference: grey header above a ruled list). */
    albumSection: '앨범',
    displaySection: '화면',
    darkMode: '다크모드',
    homeSection: '집',
    albumSync: '사진 다시 담기',
    albumSyncing: '불러오는 중…',
    albumSyncModalTitle: '사진 다시 담기',
    albumSyncModalBody:
      '방금 찍은 하루부터, 아직 지도에 없는 장면까지.\n앨범을 다시 훑어 올려요.',
    albumSyncModalConfirm: '담기',
    albumSyncModalCancel: '나중에',
    hiddenPhotos: '숨긴 사진',
    hiddenPhotosTitle: '숨긴 사진',
    hiddenPhotosCount: (count: number) => `${count}장`,
    hiddenPhotosSubtitle: (monthLabel: string) =>
      `${monthLabel} · 지도·회고·몰아보기에서만 숨김`,
    hiddenPhotosEmpty: '숨긴 사진이 없습니다',
    hiddenPhotoRestore: '되돌리기',
    hiddenPhotoOrphan: '앨범에서 찾을 수 없음',
    mapNoticeSection: '이번 달 지도',
    noLocationTitle: '위치 없는 사진',
    noLocationCount: (count: number) => `${count}장`,
    noLocationExplain:
      'GPS가 없는 사진은 지도에 안 뜹니다. 카드 만들기에는 넣을 수 있어요.',
    homeExcludedTitle: '집에서 찍은 사진',
    homeExcludedCount: (count: number) => `${count}장`,
    homeExcludedExplain:
      '집 반경 안 사진은 지도 핀에서만 빼 둡니다. 카드에는 그대로 쓸 수 있어요.',
    homeUnset: '미설정',
    homeSet: (radiusM: number) =>
      radiusM >= 1000
        ? `${(radiusM / 1000).toFixed(1)}km`
        : `${radiusM}m`,
    useCurrentLocation: '현재 위치로 설정',
    locating: '확인 중…',
    clearHome: '해제',
    locationDenied: '위치 권한이 필요해요',
    locationFailed: '위치를 찾지 못했어요',
    buildEmbedded: '내장',
    buildOta: (publishedAt: string, shortId: string) =>
      `OTA ${publishedAt} · ${shortId}`,
    diag: {
      section: '진단',
      queue: (i: number, b: number, backoff: number, done: number, failed: number) =>
        `geo ${i}/${b} · ${backoff}ms · ok ${done} · fail ${failed}`,
      monthIdle: 'month —',
      month: (resolved: number, cached: number, total: number, failed: number, finished: boolean) =>
        `month ${resolved + cached}/${total}${failed > 0 ? ` · fail ${failed}` : ''}${finished ? '' : '…'}`,
      scanIdle: 'scan —',
      scanGps: (elapsedSec: number) => `scan gps ${elapsedSec}s`,
      scanGeocode: (done: number, total: number, elapsedSec: number) =>
        `scan place ${done}/${total} · ${elapsedSec}s`,
      scanDone: 'scan ok',
    },
    proSection: '프로',
    proOn: '이용 중',
    proOff: '무료',
    proPurchase: '구매',
    proRestore: '복원',
    proToggleOn: '프로 켜기',
    proToggleOff: '프로 끄기',
    /** Kept for paywall modal copy elsewhere. */
    proDescription: (priceLabel: string) =>
      `지난 달 전체와 인사이트. ${priceLabel} · 일회.`,
    /** __DEV__ only */
    devToggle: '개발',
    devDummyOn: '샘플 켜짐',
    devDummyOff: '샘플 꺼짐',
    devDummyEnable: '샘플 켜기',
    devDummyDisable: '샘플 끄기',
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
    journalTitle: '사진 일기',
    journalSubtitle: '한 달의 사진을 지도로 모아요',
    photoCount: (count: number) => `${count}장`,
    empty: '표시할 월이 없습니다',
    freeWindowHint: (priceLabel: string) =>
      `무료는 최근 3개월만 볼 수 있어요. 더 지난 달은 프로(${priceLabel}·일회)에서 열려요.`,
    proOnly: '프로',
    pickYear: '연도',
    pickMonth: '월',
    yearLabel: (year: string) => `${year}년`,
    monthOnly: (month: number) => `${month}월`,
    prevYear: '이전 해',
    nextYear: '다음 해',
  },
  playback: {
    title: '몰아보기',
    empty: '이 달에는 보여줄 사진이 없습니다',
    placeLoading: '위치 확인 중…',
    placeUnknown: '위치 없음',
    stripHint: '같은 장소 · 탭하면 대표 사진',
    gridHint: '탭하면 대표 사진',
    prevPlace: '이전 장소',
    nextPlace: '다음 장소',
    chapterDay: (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) {
        return '';
      }
      return d.toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      });
    },
  },
  cards: {
    listTitle: '내 회고',
    listArchive: '카드 기록',
    listEmpty: '아직 만든 회고 카드가 없습니다',
    createTitle: '카드 만들기',
    /** Primary CTA on the create screen (not the edit "저장"). */
    create: '만들기',
    previewTitle: '미리보기',
    titlePlaceholder: '이 달의 제목',
    commentPlaceholder: '사진에 남길 한마디',
    paperSkinLabel: '종이 색',
    paperSkinA11y: (name: string) => `종이 ${name}`,
    paperSkinIvory: '크림',
    paperSkinFog: '안개',
    paperSkinSage: '세이지',
    paperSkinBlush: '블러시',
    paperSkinInk: '잉크',
    commentAlignLabel: '글 정렬',
    commentAlignA11y: (align: string) => `글 ${align}`,
    commentAlignLeft: '왼쪽',
    commentAlignCenter: '가운데',
    commentAlignRight: '오른쪽',
    templateLabel: '템플릿',
    photoLabel: '사진 선택',
    sortNewest: '최신순',
    sortOldest: '오래된순',
    sortByPlace: '위치별',
    placeUnknown: '위치 미확인',
    placeGrouping: '위치 묶는 중',
    loadingAlbum: '앨범 읽는 중',
    loadingPhotos: (done: number, total: number) =>
      `사진 ${done.toLocaleString('ko-KR')}/${total.toLocaleString('ko-KR')}`,
    boardPlace: '위치',
    boardDay: '날',
    boardWeekdays: ['일', '월', '화', '수', '목', '금', '토'] as const,
    boardEmpty: '이번 달 위치 사진이 없습니다',
    boardSharePlaces: (count: number) => `${count}개 위치 공유`,
    boardShareDays: (count: number) => `${count}일 공유`,
    boardRenameTitle: '이 위치 이름',
    boardRenamePlaceholder: '예: 한옥마을',
    boardRenameHint: '탭하면 사진. 길게 누르면 이름 수정.',
    boardDayHint: '날짜를 누르면 그날 사진을 봅니다.',
    boardPhotosClose: '닫기',
    boardSetCover: '대표로 쓰기',
    boardCoverOn: '대표 사진',
    boardHidePhoto: '이 사진 빼기',
    boardRenameReset: '위치 이름으로 되돌리기',
    arrangeLabel: '배치',
    arrangeHint: '카드 사진 탭으로 해제 · 길게 눌러 위치 변경 · 실수는 되돌리기',
    placeOverlay: '장소에 이름',
    placeOverlayA11y: '사진 위에 구·시 이름 표시',
    selectionUndo: '되돌리기',
    selectionReset: '초기화',
    maxPhotosHint: '사진은 최대 5장까지예요',
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
    /** Android: RN Share cannot attach file images without expo-sharing. */
    shareAndroidHint: '갤러리 앱에서 사진을 골라 공유해 주세요.',
    share: '공유',
    delete: '삭제',
    notFound: '카드를 찾을 수 없습니다',
    errorTitleRequired: '제목을 입력해 주세요',
    errorPhotoRequired: '사진을 한 장 이상 선택해 주세요',
  },
  insights: {
    title: '인사이트',
    empty: '이 달은 보여줄 인사이트가 없어요',
    placesCount: '사진 찍힌 동네',
    newPlaces: '새로 찍힌 곳',
    newPlacesWarming: '기록 쌓이는 중',
    farthest: '가장 먼 촬영지',
    topPlace: '제일 많이 찍은 곳',
    approxDistance: '대략 이동 거리',
    busiestDay: '사진이 가장 많던 날',
    proTag: '프로',
    proHint: '대략 이동 거리·바쁜 날은 프로에서 볼 수 있어요',
    unknownPlace: '알 수 없는 장소',
    farthestValue: (label: string, km: number) => `${label} · ${km}km`,
    topPlaceValue: (label: string, count: number) => `${label} · ${count}장`,
    approxDistanceValue: (km: number) => `약 ${km} km`,
    busiestDayValue: (month: number, day: number, count: number) =>
      `${month}월 ${day}일 · ${count}장`,
  },
  stamps: {
    title: '발도장',
    progress: (a: number, b: number) => `${a}/${b}`,
    progressLabel: (sido: string) => `${sido} · `,
    cityProgressLabel: (city: string) => `${city} · `,
    newBadge: 'NEW',
    newBadgeA11y: '이번 달에 새로 모은 도장',
    earned: (name: string) => `${name} 도장!`,
    emptyTitle: '아직 모은 동네가 없어요',
    empty: '위치가 있는 사진이 있으면 동 단위로 도장이 생겨요',
    uncollected: '미수집',
    slotUnknown: '?',
    errorTitle: '도장을 불러오지 못했어요',
    errorRetry: '다시 시도',
    loading: '도장 준비 중…',
    backfilling: '앨범에서 동네를 모으는 중…',
    indexingGateTitle: '동네 도장 모으는 중',
    indexingGateBody:
      '홈으로 나가거나 앱을 잠가도 백그라운드에서 이어져요. 홈 지도는 그대로 쓸 수 있어요.',
    indexingGateHint: '다른 일 하다 와도 괜찮아요',
    scanIntroTitle: '사진으로 동네 도장 모으기',
    scanIntroBody:
      '앨범 속 위치 사진으로 동 도장을 모아요. 확인을 눌러도 백그라운드에서 이어지고, 홈의 이번 달 지도는 그대로 쓸 수 있어요.',
    scanIntroConfirm: '확인',
    mapA11y: '방문한 동네가 색 방울로 표시된 대한민국 지도',
    mapEyebrow: '동네 도장',
    mapTitle: '모은 동네',
    mapHint: '한눈에 보는 발자취',
    mapClose: '닫기',
    mapOpen: '모은 동네 보기',
    mapPinchHint: '두 손가락으로 확대 · 드래그로 이동',
    mapVisitCount: (dongs: number, sidos: number) =>
      `${dongs}개 동 · ${sidos}개 시·도`,
    mapLegendDong: (n: number) => `동 ${n}`,
    mapEmpty: '아직 모은 동이 없어요',
    leafListEmpty: '동네 목록이 없어요',
    gunLeafListEmpty: '면·읍 목록을 아직 준비 중이에요',
    dongPhotosLoading: '사진을 찾는 중…',
    dongPhotosCount: (n: number) =>
      n === 0 ? '모은 사진 없음' : `모은 사진 ${n}장`,
    dongPhotosEmpty:
      '이 동네 사진을 아직 찾지 못했어요. 앨범 정리가 끝나면 다시 열어 보세요.',
    dongPhotosClose: '닫기',
    dongPhotosNewest: '최신순',
    dongPhotosOldest: '오래된순',
    dongPhotosOpenPhoto: '사진 크게 보기',
    dongPhotosViewerHint: '좌우로 넘겨 보세요',
    dongPhotoRetry: '다시 시도',
  },
} as const;
