/** Display helpers for 시·도 stamp book (UI only — no collection logic). */

export const SIDO_EN: Record<string, string> = {
  서울: 'SEOUL',
  부산: 'BUSAN',
  대구: 'DAEGU',
  인천: 'INCHEON',
  광주: 'GWANGJU',
  대전: 'DAEJEON',
  울산: 'ULSAN',
  세종: 'SEJONG',
  경기: 'GYEONGGI',
  강원: 'GANGWON',
  충북: 'CHUNGBUK',
  충남: 'CHUNGNAM',
  전북: 'JEONBUK',
  전남: 'JEONNAM',
  경북: 'GYEONGBUK',
  경남: 'GYEONGNAM',
  제주: 'JEJU',
};

export const SIDO_FORMAL: Record<string, string> = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도',
};

export function sidoEn(sido: string): string {
  return SIDO_EN[sido] ?? sido.toUpperCase();
}

export function sidoFormal(sido: string): string {
  return SIDO_FORMAL[sido] ?? sido;
}
