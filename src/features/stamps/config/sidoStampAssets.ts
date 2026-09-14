import type { ImageSourcePropType } from 'react-native';

/**
 * 시·도 full-face stamp PNGs (512²), sliced from `_sheet.png`.
 * Frame+type are baked; district/neighborhood use component + symbol images.
 */
export const SIDO_STAMP_ASSETS: Record<string, ImageSourcePropType> = {
  서울: require('../../../../assets/stamps/sido/seoul.png'),
  부산: require('../../../../assets/stamps/sido/busan.png'),
  대구: require('../../../../assets/stamps/sido/daegu.png'),
  인천: require('../../../../assets/stamps/sido/incheon.png'),
  광주: require('../../../../assets/stamps/sido/gwangju.png'),
  대전: require('../../../../assets/stamps/sido/daejeon.png'),
  울산: require('../../../../assets/stamps/sido/ulsan.png'),
  세종: require('../../../../assets/stamps/sido/sejong.png'),
  경기: require('../../../../assets/stamps/sido/gyeonggi.png'),
  강원: require('../../../../assets/stamps/sido/gangwon.png'),
  충북: require('../../../../assets/stamps/sido/chungbuk.png'),
  충남: require('../../../../assets/stamps/sido/chungnam.png'),
  전북: require('../../../../assets/stamps/sido/jeonbuk.png'),
  전남: require('../../../../assets/stamps/sido/jeonnam.png'),
  경북: require('../../../../assets/stamps/sido/gyeongbuk.png'),
  경남: require('../../../../assets/stamps/sido/gyeongnam.png'),
  제주: require('../../../../assets/stamps/sido/jeju.png'),
};

export function sidoStampAsset(
  sido: string,
): ImageSourcePropType | undefined {
  return SIDO_STAMP_ASSETS[sido];
}
