#!/usr/bin/env node
/**
 * EAS Update 업로드 래퍼.
 *
 * 사용:
 *   npm run ota:upload
 *   npm run ota:upload -- --platform all --channel prod
 *   npm run ota:upload -- --platform all --channel prod --runtime-version 1.0.0 --apply-mode immediate
 *
 * 옵션 (모두 선택):
 *   --platform ios|android|all     기본 all
 *   --channel prod|production|preview  기본 production (prod → production)
 *   --runtime-version <ver>        app.json version(runtime)과 다르면 경고
 *   --apply-mode immediate|next-launch  기록용 (앱은 런치 시 업데이트 체크)
 *   --message / -m <text>          없으면 시각 기준 자동 메시지
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANNEL_ALIASES = {
  prod: 'production',
  production: 'production',
  preview: 'preview',
};

function parseArgs(argv) {
  const out = {
    platform: 'all',
    channel: 'production',
    runtimeVersion: null,
    applyMode: 'immediate',
    message: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      i += 1;
      return argv[i];
    };

    if (a === '--platform' || a === '-p') out.platform = next();
    else if (a === '--channel') out.channel = next();
    else if (a === '--runtime-version') out.runtimeVersion = next();
    else if (a === '--apply-mode') out.applyMode = next();
    else if (a === '--message' || a === '-m') out.message = next();
    else if (a === '--help' || a === '-h') out.help = true;
    else {
      console.error(`[ota:upload] 알 수 없는 옵션: ${a}`);
      process.exit(1);
    }
  }

  return out;
}

/** Resolve the runtime version EAS will stamp on this update. */
function readAppRuntimeVersion() {
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const expo = appJson?.expo ?? {};
  const rv = expo.runtimeVersion;
  if (rv && typeof rv === 'object' && rv.policy === 'appVersion') {
    return String(expo.version ?? '');
  }
  if (typeof rv === 'string' && rv.length > 0) {
    return rv;
  }
  return String(expo.version ?? '');
}

function defaultMessage() {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return `OTA ${stamp}`;
}

function printHelp() {
  console.log(`Usage:
  npm run ota:upload
  npm run ota:upload -- --platform all --channel prod
  npm run ota:upload -- --platform all --channel prod --runtime-version 1.0.0 --apply-mode immediate
  npm run ota:upload -- --platform ios --channel preview -m "핫픽스"

Flags:
  --platform ios|android|all     (default: all = ios+android)
  --channel prod|production|preview  (default: production)
  --runtime-version <ver>        warn if mismatch with app.json (appVersion policy)
  --apply-mode immediate|next-launch  (info only)
  --message / -m <text>          (default: auto timestamp)
`);
}

function runEasUpdate({ channel, platform, message }) {
  const args = [
    'eas-cli',
    'update',
    '--channel',
    channel,
    '--platform',
    platform,
    '--message',
    message,
    '--non-interactive',
  ];

  console.log(`[ota:upload] eas update --channel ${channel} --platform ${platform} ...`);
  const result = spawnSync('npx', args, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, CI: '1' },
  });
  return result.status ?? 1;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const channel = CHANNEL_ALIASES[opts.channel];
  if (!channel) {
    console.error(`[ota:upload] 지원하지 않는 channel: ${opts.channel}`);
    process.exit(1);
  }

  if (!['ios', 'android', 'all'].includes(opts.platform)) {
    console.error(`[ota:upload] 지원하지 않는 platform: ${opts.platform}`);
    process.exit(1);
  }

  if (!['immediate', 'next-launch'].includes(opts.applyMode)) {
    console.error(`[ota:upload] 지원하지 않는 apply-mode: ${opts.applyMode}`);
    process.exit(1);
  }

  const appRuntime = readAppRuntimeVersion();
  if (opts.runtimeVersion && opts.runtimeVersion !== appRuntime) {
    console.warn(
      `[ota:upload] --runtime-version ${opts.runtimeVersion} ≠ app.json runtime(${appRuntime}). EAS는 app.json을 사용합니다.`,
    );
  }

  const message = opts.message?.trim() || defaultMessage();

  console.log('[ota:upload]', {
    platform: opts.platform,
    channel,
    runtimeVersion: appRuntime,
    applyMode: opts.applyMode,
    message,
  });

  // `eas update --platform all` can pull web export; run mobile platforms separately.
  const platforms =
    opts.platform === 'all' ? ['ios', 'android'] : [opts.platform];

  for (const platform of platforms) {
    const code = runEasUpdate({ channel, platform, message });
    if (code !== 0) {
      process.exit(code);
    }
  }

  process.exit(0);
}

main();
