/**
 * Live integration test script for unismsgateway.
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in your credentials.
 *   2. npm run test:live
 *
 * Set TEST_SEND=true in .env (or inline) to actually send an SMS.
 * Without it, only init and balance checks run.
 *
 * Optional TEST_SEND_METHOD:
 *   quickSend (default) — single recipient via quickSend()
 *   send                — multiple recipients via send() (nest, route)
 *   both                — run quickSend() then send()
 *   sendPersonalized    — personalised bulk via sendPersonalized() (nest, hubtel)
 *
 * For send / both, set TEST_TO_MULTI to comma-separated MSISDNs (e.g. 233...,233...).
 * If TEST_TO_MULTI is omitted, TEST_TO is used as a single-element array.
 * For sendPersonalized, set TEST_PERSONALIZED_DESTINATIONS (JSON array of { to, values }).
 */

import * as dotenv from 'dotenv';
dotenv.config();

import {
  init,
  smsPlatform,
  PlatformId,
  QuickSendParams,
  SendParams,
  PersonalizedSendParams,
  PersonalizedRecipient,
  IgatewayParam
} from '../src/lib/lib';

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

type TestSendMethod = 'quickSend' | 'send' | 'both' | 'sendPersonalized';

function parseSendMethod(): TestSendMethod {
  const raw = (env('TEST_SEND_METHOD') || 'quickSend').toLowerCase();
  if (raw === 'quicksend') return 'quickSend';
  if (raw === 'send' || raw === 'both') return raw;
  if (raw === 'sendpersonalized') return 'sendPersonalized';
  throw new Error(
    `Invalid TEST_SEND_METHOD="${raw}". Use quickSend, send, both, or sendPersonalized.`
  );
}

function parseRecipients(value: string): (string | number)[] {
  const items = value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (items.length === 0) {
    throw new Error('At least one recipient is required.');
  }
  return items;
}

function resolveMultiRecipients(): (string | number)[] {
  const multi = env('TEST_TO_MULTI');
  if (multi) {
    return parseRecipients(multi);
  }
  const single = env('TEST_TO');
  if (single) {
    info('TEST_TO_MULTI not set — using TEST_TO as a single-element send() array');
    return [single];
  }
  throw new Error(
    'send() requires TEST_TO_MULTI (comma-separated) or TEST_TO when TEST_SEND_METHOD is send or both'
  );
}

function resolvePersonalizedDestinations(): PersonalizedRecipient[] {
  const raw = env('TEST_PERSONALIZED_DESTINATIONS');
  if (!raw) {
    throw new Error(
      'sendPersonalized() requires TEST_PERSONALIZED_DESTINATIONS as a JSON array of { to, values } objects'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'TEST_PERSONALIZED_DESTINATIONS must be valid JSON (e.g. [{"to":"233...","values":["Name",123]}])'
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      'TEST_PERSONALIZED_DESTINATIONS must be a non-empty JSON array'
    );
  }

  const destinations: PersonalizedRecipient[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown>;
    const to = item.to ?? item.To;
    const values = item.values ?? item.Values;

    if (to === null || to === undefined) {
      throw new Error(
        `TEST_PERSONALIZED_DESTINATIONS[${i}] is missing to or To`
      );
    }
    if (!Array.isArray(values)) {
      throw new Error(
        `TEST_PERSONALIZED_DESTINATIONS[${i}] requires values or Values as an array`
      );
    }

    destinations.push({
      To: typeof to === 'number' ? to : String(to).trim(),
      Values: values as (string | number)[]
    });
  }

  return destinations;
}

function resolvePersonalizedTemplate(): string {
  return (
    env('TEST_PERSONALIZED_TEMPLATE') ||
    'Hello {$name}. unismsgateway live test — please ignore.'
  );
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
    const param: IgatewayParam = {};

    switch (platformId) {
      case 'nest':
        param.apiKey = requireEnv('NEST_API_KEY');
        if (env('NEST_HOST'))     param.host     = env('NEST_HOST')!;
        if (env('NEST_PROTOCOL')) {
          param.protocol = env('NEST_PROTOCOL')! as 'http' | 'https';
        }
        if (env('NEST_DELIVERY_CALLBACK_URL')) {
          param.deliveryCallback = {
            url: env('NEST_DELIVERY_CALLBACK_URL')!
          };
          const accept = env('NEST_DELIVERY_CALLBACK_ACCEPT');
          if (accept) {
            param.deliveryCallback.accept = accept as 'application/json' | 'application/xml';
          }
        }
        param.debug = true;
        break;

      case 'hubtel':
        param.clientId     = requireEnv('HUBTEL_CLIENT_ID');
        param.clientSecret = requireEnv('HUBTEL_CLIENT_SECRET');
        param.debug = true;
        break;

      case 'route':
        param.username = requireEnv('ROUTE_USERNAME');
        param.password = requireEnv('ROUTE_PASSWORD');
        if (env('ROUTE_HOST'))     param.host     = env('ROUTE_HOST')!;
        if (env('ROUTE_PORT'))     param.port     = Number(env('ROUTE_PORT'));
        if (env('ROUTE_PROTOCOL')) {
          param.protocol = env('ROUTE_PROTOCOL')! as 'http' | 'https';
        }
        break;
    }

    platform = init({ platformId, param });
    pass(`Initialized ${platformId} platform`);
    if (platformId === 'nest' && param.deliveryCallback?.url) {
      info(`Delivery push callback configured: ${param.deliveryCallback.url}`);
    }
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

  const sendMethod = parseSendMethod();
  const defaultContent =
    env('TEST_CONTENT') || 'unismsgateway live test — please ignore.';

  if (sendMethod === 'quickSend' || sendMethod === 'both') {
    await runTest('quickSend()', async () => {
      const sendParams: QuickSendParams = {
        From: requireEnv('TEST_FROM'),
        To: requireEnv('TEST_TO'),
        Content: defaultContent
      };

      info(`Sending from "${sendParams.From}" to "${sendParams.To}"...`);
      const result = await platform!.quickSend(sendParams);

      if (!result.success) {
        throw new Error(result.error || `Send failed: ${JSON.stringify(result)}`);
      }

      pass(`Message sent. Result: ${JSON.stringify(result)}`);
    });
  }

  if (sendMethod === 'send' || sendMethod === 'both') {
    await runTest('send()', async () => {
      const sendParams: SendParams = {
        From: requireEnv('TEST_FROM'),
        To: resolveMultiRecipients(),
        Content: defaultContent
      };

      info(
        `Sending from "${sendParams.From}" to [${sendParams.To.join(', ')}]...`
      );
      const result = await platform!.send(sendParams);

      if (!result.success) {
        throw new Error(result.error || `Send failed: ${JSON.stringify(result)}`);
      }

      pass(`Batch sent. Result: ${JSON.stringify(result)}`);
    });
  }

  if (sendMethod === 'sendPersonalized') {
    if (platformId === 'nest' || platformId === 'hubtel') {
      await runTest('sendPersonalized()', async () => {
        const sendParams: PersonalizedSendParams = {
          From: requireEnv('TEST_FROM'),
          Content: resolvePersonalizedTemplate(),
          Destinations: resolvePersonalizedDestinations()
        };

        info(
          `Sending personalised from "${sendParams.From}" to ${sendParams.Destinations.length} destination(s)...`
        );
        const result = await platform!.sendPersonalized(sendParams);

        if (!result.success) {
          throw new Error(result.error || `Send failed: ${JSON.stringify(result)}`);
        }

        pass(`Personalised batch sent. Result: ${JSON.stringify(result)}`);
      });
    } else {
      await runTest('sendPersonalized() not supported', async () => {
        const sendParams: PersonalizedSendParams = {
          From: requireEnv('TEST_FROM'),
          Content: resolvePersonalizedTemplate(),
          Destinations: [{ To: requireEnv('TEST_TO'), Values: ['Test'] }]
        };

        try {
          await platform!.sendPersonalized(sendParams);
          throw new Error(`Expected sendPersonalized() to throw for ${platformId}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('does not support sendPersonalized')) {
            pass(`sendPersonalized() correctly rejected: ${msg}`);
            return;
          }
          throw err;
        }
      });
    }
  }
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
