/**
 * Self-check for the admin tokenizer → parseGeocodedPlace → label chain.
 * Run: npx tsx@4.20.3 scripts/check-place-parse.ts
 *
 * Covers the field shapes iOS actually returns per region type (metro / 도 +
 * 시 / 군 / 읍·면·리 / 특별자치도 / glued city string / POI-only name), so a
 * regression that drops one admin grain fails here instead of on device.
 */
import assert from 'node:assert/strict';

import type { LocationGeocodedAddress } from 'expo-location';

import { parseGeocodedPlace } from '../src/features/photos/utils/parseGeocodedPlace';
import { composeFineLabel } from '../src/features/photos/utils/placeLabels';

type Addr = Partial<LocationGeocodedAddress>;

function addr(partial: Addr): LocationGeocodedAddress {
  return {
    city: null,
    country: '대한민국',
    district: null,
    isoCountryCode: 'KR',
    name: null,
    postalCode: null,
    region: null,
    street: null,
    streetNumber: null,
    subregion: null,
    timezone: null,
    formattedAddress: null,
    ...partial,
  } as LocationGeocodedAddress;
}

type Case = {
  title: string;
  input: LocationGeocodedAddress;
  city: string | null;
  gu?: string | null;
  eupMyon?: string | null;
  dong?: string | null;
  detail: string | null;
};

const cases: Case[] = [
  {
    title: '강릉 주문진읍 주문리',
    input: addr({
      region: '강원특별자치도',
      city: '강릉시',
      district: '주문진읍',
      name: '주문리',
      formattedAddress: '대한민국 강원특별자치도 강릉시 주문진읍 주문리',
    }),
    city: '강릉시',
    eupMyon: '주문진읍',
    dong: '주문리',
    detail: '강릉시 주문리',
  },
  {
    title: '강릉 주문진읍 교항리',
    input: addr({
      region: '강원특별자치도',
      city: '강릉시',
      district: '주문진읍',
      name: '교항리',
      formattedAddress: '대한민국 강원특별자치도 강릉시 주문진읍 교항리',
    }),
    city: '강릉시',
    eupMyon: '주문진읍',
    dong: '교항리',
    detail: '강릉시 교항리',
  },
  {
    title: '교항리가 city 필드에 붙어서 옴',
    input: addr({
      region: '강원특별자치도',
      city: '강릉시교항리',
      formattedAddress: '대한민국 강원특별자치도 강릉시교항리',
    }),
    city: '강릉시',
    dong: '교항리',
    detail: '강릉시 교항리',
  },
  {
    title: '읍만 있고 부모 시 없음',
    input: addr({
      region: '강원특별자치도',
      city: '주문진읍',
      formattedAddress: '대한민국 강원특별자치도 주문진읍',
    }),
    city: '주문진읍',
    eupMyon: '주문진읍',
    detail: '주문진읍',
  },
  {
    title: '서울 강남구 역삼동',
    input: addr({
      region: '서울특별시',
      city: '서울특별시',
      district: '강남구',
      street: '역삼동',
      formattedAddress: '대한민국 서울특별시 강남구 역삼동',
    }),
    city: '서울',
    gu: '강남구',
    dong: '역삼동',
    detail: '서울 강남구',
  },
  {
    title: '부산 해운대구 우동 (2글자 동)',
    input: addr({
      region: '부산광역시',
      city: '부산광역시',
      district: '해운대구',
      street: '우동',
      formattedAddress: '대한민국 부산광역시 해운대구 우동',
    }),
    city: '부산',
    gu: '해운대구',
    dong: '우동',
    detail: '부산 해운대구',
  },
  {
    title: '2글자 동만 오면 구를 복구해야 한다',
    input: addr({
      region: '부산광역시',
      city: '부산광역시',
      street: '우동',
      formattedAddress: '대한민국 부산광역시 우동',
    }),
    city: '부산',
    gu: '해운대구',
    dong: '우동',
    detail: '부산 해운대구',
  },
  {
    title: '2글자 동이 더 긴 리를 자르면 안 된다 (중동 ⊂ 중동리)',
    input: addr({
      region: '충청남도',
      city: '보령시',
      district: '주교면',
      name: '중동리',
      formattedAddress: '대한민국 충청남도 보령시 주교면 중동리',
    }),
    city: '보령시',
    eupMyon: '주교면',
    dong: '중동리',
    detail: '보령시 중동리',
  },
  {
    title: '경기 성남시 분당구 정자동',
    input: addr({
      region: '경기도',
      city: '성남시',
      subregion: '분당구',
      street: '정자동',
      formattedAddress: '대한민국 경기도 성남시 분당구 정자동',
    }),
    city: '성남시',
    gu: '분당구',
    dong: '정자동',
    detail: '성남시 분당구',
  },
  {
    title: '인천 강화군 (군은 구를 붙이지 않는다)',
    input: addr({
      region: '인천광역시',
      city: '인천광역시',
      subregion: '강화군',
      formattedAddress: '대한민국 인천광역시 강화군',
    }),
    city: '강화군',
    gu: null,
    detail: '강화군',
  },
  {
    title: '양평군 용문면',
    input: addr({
      region: '경기도',
      city: '양평군',
      district: '용문면',
      formattedAddress: '대한민국 경기도 양평군 용문면',
    }),
    city: '양평군',
    eupMyon: '용문면',
    detail: '양평군 용문면',
  },
  {
    title: '제주 서귀포시 안덕면',
    input: addr({
      region: '제주특별자치도',
      city: '서귀포시',
      district: '안덕면',
      formattedAddress: '대한민국 제주특별자치도 서귀포시 안덕면',
    }),
    city: '서귀포시',
    eupMyon: '안덕면',
    detail: '서귀포시 안덕면',
  },
  {
    title: '세종특별자치시',
    input: addr({
      region: '세종특별자치시',
      city: '세종특별자치시',
      formattedAddress: '대한민국 세종특별자치시',
    }),
    city: '세종',
    detail: '세종',
  },
  {
    title: 'POI 이름(엘리시움)이 시로 오인되면 안 됨',
    input: addr({
      region: '강원특별자치도',
      city: '평창군',
      district: '대관령면',
      name: '엘리시움',
      formattedAddress: '대한민국 강원특별자치도 평창군 대관령면 엘리시움',
    }),
    city: '평창군',
    eupMyon: '대관령면',
    detail: '평창군 대관령면',
  },
  {
    title: '도만 있는 지오코드',
    input: addr({
      region: '전라남도',
      city: '전라남도',
      formattedAddress: '대한민국 전라남도',
    }),
    city: '전라남도',
    detail: '전라남도',
  },
];

let failed = 0;

for (const c of cases) {
  const parsed = parseGeocodedPlace(c.input);
  const detail = parsed?.city
    ? composeFineLabel(
        parsed.city,
        parsed.gu,
        parsed.dong,
        null,
        parsed.eupMyon,
      )
    : null;

  const actual = {
    city: parsed?.city ?? null,
    gu: parsed?.gu ?? null,
    eupMyon: parsed?.eupMyon ?? null,
    dong: parsed?.dong ?? null,
    detail,
  };
  const expected = {
    city: c.city,
    gu: c.gu ?? null,
    eupMyon: c.eupMyon ?? null,
    dong: c.dong ?? null,
    detail: c.detail,
  };

  try {
    assert.deepEqual(actual, expected);
    console.log(`ok   ${c.title}`);
  } catch {
    failed += 1;
    console.log(`FAIL ${c.title}`);
    console.log('  expected', expected);
    console.log('  actual  ', actual);
  }
}

if (failed > 0) {
  console.log(`\n${failed}/${cases.length} failed`);
  process.exit(1);
}
console.log(`\nall ${cases.length} passed`);
