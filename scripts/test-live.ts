/**
 * Live integration test script for unismsgateway.
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in your credentials.
 *   2. npm run test:live
 *
 * Set TEST_SEND=true in .env (or inline) to actually send an SMS.
 * Without it, only init and balance checks run.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { init, smsPlatform, PlatformId, QuickSendParams } from '../src/lib/lib';

// ─── Colour helpers ──────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const pass  = (msg: string) => console.log(`  ${GREEN}✔${RESET}  ${msg}`);
const fail  = (msg: string) => console.log(`  ${RED}✖${RESET}  ${msg}`);
const info  = (msg: string) => console.log(`  ${CYAN}ℹ${RESET}  ${msg}`);
const warn  = (msg: string) => console.log(`  ${YELLOW}⚠${RESET}  ${msg}`);
const title = (msg: string) => console.log(`\n${BOLD}${msg}${RESET}`);

// ─── Env helpers ─────────────────────────────────────────────────────────────
function env(key: string): string | undefined {
  return process.env[key] || undefined;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

// ─── Test counters ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function runTest(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
  } catch (err) {
    failed++;
    fail(`${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Per-platform tests ───────────────────────────────────────────────────────
async function testPlatform(platformId: PlatformId): Promise<void> {
  title(`Platform: ${platformId.toUpperCase()}`);

  let platform: smsPlatform;

  // 1. Initialisation
  await runTest('Init / config validation', async () => {
    const param: Record<string, string | number> = {};

    switch (platformId) {
      case 'nest':
        param.apiKey = requireEnv('NEST_API_KEY');
        if (env('NEST_HOST'))     param.host     = env('NEST_HOST')!;
        if (env('NEST_PROTOCOL')) param.protocol = env('NEST_PROTOCOL')!;
        break;

      case 'hubtel':
        param.clientId     = requireEnv('HUBTEL_CLIENT_ID');
        param.clientSecret = requireEnv('HUBTEL_CLIENT_SECRET');
        break;

      case 'route':
        param.username = requireEnv('ROUTE_USERNAME');
        param.password = requireEnv('ROUTE_PASSWORD');
        if (env('ROUTE_HOST'))     param.host     = env('ROUTE_HOST')!;
        if (env('ROUTE_PORT'))     param.port     = Number(env('ROUTE_PORT'));
        if (env('ROUTE_PROTOCOL')) param.protocol = env('ROUTE_PROTOCOL')!;
        break;
    }

    platform = init({ platformId, param: param as any });
    pass(`Initialized ${platformId} platform`);
  });

  // 2. Balance check (only nest and hubtel expose getBalance)
  if (platformId === 'nest' || platformId === 'hubtel') {
    await runTest('getBalance()', async () => {
      const gateway = platform!.getGateway();
      if (!gateway.getBalance) {
        warn('getBalance not implemented — skipped');
        return;
      }
      const balance = await gateway.getBalance!();
      pass(`Balance retrieved: ${JSON.stringify(balance)}`);
    });
  } else {
    warn(`getBalance not supported by '${platformId}' — skipped`);
  }

  // 3. Send SMS (opt-in via TEST_SEND=true)
  const shouldSend = env('TEST_SEND') === 'true';
  if (!shouldSend) {
    warn('TEST_SEND is not set to true — skipping live send');
    return;
  }

  await runTest('quickSend()', async () => {
    const sendParams: QuickSendParams = {
      From:    requireEnv('TEST_FROM'),
      To:      requireEnv('TEST_TO'),
      Content: env('TEST_CONTENT') || 'unismsgateway live test — please ignore.'
    };

    info(`Sending from "${sendParams.From}" to "${sendParams.To}"...`);
    const result = await platform!.quickSend(sendParams);

    if (!result.success) {
      throw new Error(result.error || `Send failed: ${JSON.stringify(result)}`);
    }

    pass(`Message sent. Result: ${JSON.stringify(result)}`);
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`\n${BOLD}═══════════════════════════════════════${RESET}`);
  console.log(`${BOLD}   unismsgateway  —  live test runner   ${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════${RESET}`);

  const platformArg = env('GATEWAY_PLATFORM');
  const platforms: PlatformId[] = platformArg
    ? [platformArg as PlatformId]
    : (env('TEST_ALL') === 'true' ? ['nest', 'hubtel', 'route'] : []);

  if (platforms.length === 0) {
    console.log(`\n${YELLOW}No platform selected.${RESET}`);
    console.log('Set GATEWAY_PLATFORM=nest|hubtel|route in your .env file,');
    console.log('or set TEST_ALL=true to test all configured platforms.\n');
    process.exit(1);
  }

  for (const p of platforms) {
    try {
      await testPlatform(p);
    } catch {
      // individual test errors already captured above
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  title('Summary');
  if (passed > 0) pass(`${passed} check(s) passed`);
  if (failed > 0) fail(`${failed} check(s) failed`);

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n${RED}Unexpected error:${RESET}`, err);
  process.exit(1);
});
