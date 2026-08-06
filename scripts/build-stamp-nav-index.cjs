/**
 * Build admin-dong → 구 (and 군 → 읍·면) maps for stamp L1/L2 nav.
 * Source: same admdongkor GeoJSON as build-dong-assets.
 *
 * Usage: node scripts/build-stamp-nav-index.cjs [/path/to.geojson]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC =
  process.argv[2] || path.join('/tmp', 'hangjeongdong.geojson');
const OUT_ADMIN_GU = path.join(ROOT, 'assets/geo/admin-dong-gu.json');
const OUT_GUN_LEAVES = path.join(ROOT, 'assets/geo/gun-eupmyeon-by-sido.json');

const SIDO_FROM_FULL = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  강원도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라북도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

const METRO = new Set([
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
]);

function leafName(admNm) {
  const parts = String(admNm).trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

/**
 * stampCity + L1 gu label from sggnm.
 * 종로구 → (서울, 종로구); 수원시영통구 → (수원시, 영통구); 과천시 → null gu.
 */
function resolveScope(sido, sggnm) {
  if (!sggnm) {
    return null;
  }
  if (METRO.has(sido)) {
    if (sido === '세종') {
      return { stampCity: '세종시', gu: null, gun: null };
    }
    if (sggnm.endsWith('군')) {
      return { stampCity: sggnm, gu: null, gun: sggnm };
    }
    if (sggnm.endsWith('구')) {
      return { stampCity: sido, gu: sggnm, gun: null };
    }
    return { stampCity: sido, gu: null, gun: null };
  }
  if (sggnm.endsWith('군')) {
    return { stampCity: sggnm, gu: null, gun: sggnm };
  }
  const guInSi = sggnm.match(/^(.+시)(.+구)$/);
  if (guInSi) {
    return { stampCity: guInSi[1], gu: guInSi[2], gun: null };
  }
  if (sggnm.endsWith('시')) {
    return { stampCity: sggnm, gu: null, gun: null };
  }
  return null;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('missing source', SRC);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  /** @type {Record<string, Record<string, string>>} */
  const adminGu = {};
  /** @type {Record<string, Record<string, string[]>>} */
  const gunLeaves = {};

  for (const f of raw.features) {
    const p = f.properties;
    const sido = SIDO_FROM_FULL[p.sidonm];
    if (!sido) {
      continue;
    }
    const scope = resolveScope(sido, p.sggnm);
    if (!scope) {
      continue;
    }
    const name = leafName(p.adm_nm);
    if (!name) {
      continue;
    }

    if (scope.gu && name.endsWith('동')) {
      if (!adminGu[scope.stampCity]) {
        adminGu[scope.stampCity] = {};
      }
      adminGu[scope.stampCity][name] = scope.gu;
    }

    if (scope.gun && (name.endsWith('면') || name.endsWith('읍'))) {
      if (!gunLeaves[sido]) {
        gunLeaves[sido] = {};
      }
      if (!gunLeaves[sido][scope.gun]) {
        gunLeaves[sido][scope.gun] = [];
      }
      const list = gunLeaves[sido][scope.gun];
      if (!list.includes(name)) {
        list.push(name);
      }
    }
  }

  for (const city of Object.keys(adminGu)) {
    // leave as object — no sort needed for lookup
  }
  for (const sido of Object.keys(gunLeaves)) {
    for (const gun of Object.keys(gunLeaves[sido])) {
      gunLeaves[sido][gun].sort((a, b) => a.localeCompare(b, 'ko'));
    }
  }

  fs.writeFileSync(OUT_ADMIN_GU, `${JSON.stringify(adminGu)}\n`);
  fs.writeFileSync(OUT_GUN_LEAVES, `${JSON.stringify(gunLeaves)}\n`);
  const dongMapped = Object.values(adminGu).reduce(
    (n, m) => n + Object.keys(m).length,
    0,
  );
  const gunCount = Object.values(gunLeaves).reduce(
    (n, guns) => n + Object.keys(guns).length,
    0,
  );
  console.log(
    'admin-dong-gu cities',
    Object.keys(adminGu).length,
    'dongs',
    dongMapped,
  );
  console.log('gun-eupmyeon sidos', Object.keys(gunLeaves).length, 'guns', gunCount);
}

main();
