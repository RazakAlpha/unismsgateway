# Unified SMS Gateway

Most projects rely on more than one SMS provider so they can switch if a gateway is unavailable. Each provider’s API differs, so separate integrations are usually required.

**unismsgateway** exposes a single API for multiple SMS gateways. You implement once, then select or switch the platform; your send flow stays the same.

## Installation

```bash
npm install unismsgateway
```

**Requirements:** Node.js `>= 12.0.0` (see `package.json` `engines`).

## Module import

**CommonJS**

```javascript
const unisms = require('unismsgateway');
```

**ESM / TypeScript**

```typescript
import * as unisms from 'unismsgateway';
// or named:
import { init, getSmsPlatform, reset, smsPlatform } from 'unismsgateway';
```

---

## Configuration overview

### `IgatewaySettings`


| Field        | Type            | Description                            |
| ------------ | --------------- | -------------------------------------- |
| `platformId` | `'route' \| 'hubtel' \| 'nest'` | Which gateway to use. |
| `param`      | `IgatewayParam` | Provider-specific options (see below). |


### `IgatewayParam` (all fields optional except what your `platformId` requires)


| Field          | Type      | Used by         | Description                                                            |
| -------------- | --------- | --------------- | ---------------------------------------------------------------------- |
| `username`     | `string`  | `route`         | Route Mobile account username. **Required** for `route`.               |
| `password`     | `string`  | `route`         | Route Mobile account password. **Required** for `route`.               |
| `host`         | `string`  | `route`, `nest` | API host. See per-gateway defaults below.                              |
| `port`         | `number`  | `route`         | TCP port for Route Mobile. Default: `8080`.                            |
| `protocol`     | `'http' \| 'https'` | `route`, `nest` | HTTPS or HTTP to the provider API.                         |
| `clientId`     | `string`  | `hubtel`        | Hubtel client ID. **Required** for `hubtel`.                           |
| `clientSecret` | `string`  | `hubtel`        | Hubtel client secret. **Required** for `hubtel`.                       |
| `apiKey`       | `string`  | `nest`          | SMSOnlineGH API key (`Authorization: key …`). **Required** for `nest`. |
| `debug`        | `boolean` | all             | If `true`, the active gateway logs each request/response to the console (prefix `[unismsgateway:…]`). Off by default. |


Validation runs in `smsPlatform` when the instance is constructed: missing required fields for the chosen `platformId` throw `Error` with a clear message.

---

## Environment variables

There are **two separate contexts**. Use the section that matches what you are doing.


| Context                                                         | Who reads env?                                                | Purpose                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Library usage** (`init()` in your app)                        | **Your code** — this package does **not** read `process.env`. | You choose variable names and map them into `platformId` and `param` yourself. |
| **Live integration test** (`npm test` / `scripts/test-live.ts`) | **The test script** via `dotenv` and `process.env`.           | Fixed names in `.env` (see `.env.example`).                                    |


---

### Library usage: required and optional param fields

Nothing is read from the environment unless **you** wire it. Required fields are determined only by `platformId`:


| `platformId` | Required in `param`        | Optional in `param` (defaults in this library)                                                |
| ------------ | -------------------------- | --------------------------------------------------------------------------------------------- |
| `nest`       | `apiKey`                   | `host` (default `api.smsonlinegh.com`), `protocol` (default `https`), `debug`                 |
| `hubtel`     | `clientId`, `clientSecret` | `debug`                                                                                       |
| `route`      | `username`, `password`     | `host` (default `rslr.connectbind.com`), `protocol` (default `http`), `port` (default `8080`), `debug` |


**Suggested env names for your app** (optional; you can rename them). Credential keys (`NEST_`*, `HUBTEL_`*, `ROUTE_*`) match [live test](#live-integration-test-environment-variables) and `.env.example`. Platform selection differs: the test script requires `GATEWAY_PLATFORM` (or `TEST_ALL`); in your app you choose any name (the example below uses `SMS_PLATFORM_ID`):


| Env name (suggestion)  | Maps to `param`            | Required when `platformId` is |
| ---------------------- | -------------------------- | ----------------------------- |
| `NEST_API_KEY`         | `apiKey`                   | `nest`                        |
| `NEST_HOST`            | `host`                     | optional for `nest`           |
| `NEST_PROTOCOL`        | `protocol`                 | optional for `nest`           |
| `HUBTEL_CLIENT_ID`     | `clientId`                 | `hubtel`                      |
| `HUBTEL_CLIENT_SECRET` | `clientSecret`             | `hubtel`                      |
| `ROUTE_USERNAME`       | `username`                 | `route`                       |
| `ROUTE_PASSWORD`       | `password`                 | `route`                       |
| `ROUTE_HOST`           | `host`                     | optional for `route`          |
| `ROUTE_PORT`           | `port` (use `Number(...)`) | optional for `route`          |
| `ROUTE_PROTOCOL`       | `protocol`                 | optional for `route`          |


You may also use names like `SMSONLINEGH_API_KEY` / `SMSONLINEGH_HOST` in your app only — there is **no** built-in support for alternate names in the test script; that script expects `NEST_`* and `ROUTE_`* as in `.env.example`.

Example wiring: branch on `platformId` and build `param` so you do not mix unrelated fields.

```javascript
const unisms = require('unismsgateway');

// Pick any env name for the active gateway; the live test uses GATEWAY_PLATFORM instead.
const platformId = process.env.SMS_PLATFORM_ID;

const paramByPlatform = {
  route: {
    username: process.env.ROUTE_USERNAME,
    password: process.env.ROUTE_PASSWORD,
    host: process.env.ROUTE_HOST,
    port: process.env.ROUTE_PORT ? Number(process.env.ROUTE_PORT) : undefined,
    protocol: process.env.ROUTE_PROTOCOL
  },
  hubtel: {
    clientId: process.env.HUBTEL_CLIENT_ID,
    clientSecret: process.env.HUBTEL_CLIENT_SECRET
  },
  nest: {
    apiKey: process.env.NEST_API_KEY,
    host: process.env.NEST_HOST,
    protocol: process.env.NEST_PROTOCOL
  }
};

const gateway = unisms.init({
  platformId,
  param: paramByPlatform[platformId]
});
```

---

### Live integration test environment variables

The script `scripts/test-live.ts` loads `.env` (copy from `.env.example`) and expects **these exact names**. It does not use `SMS_PLATFORM_ID` or other app-specific aliases.

#### How a run is selected


| Variable           | Required?                          | Description                                                                                                                                                                                                 |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GATEWAY_PLATFORM` | **Yes**, unless you use `TEST_ALL` | Must be exactly `nest`, `hubtel`, or `route`.                                                                                                                                                               |
| `TEST_ALL`         | Optional                           | If set to `true`, the script runs `nest`, then `hubtel`, then `route` in order. You still need the **required** variables below for each platform you run; missing keys for a step cause that step to fail. |


#### Per gateway — credentials and overrides

`**nest` (SMSOnlineGH)**


| Variable        | Required? | Purpose                                       |
| --------------- | --------- | --------------------------------------------- |
| `NEST_API_KEY`  | **Yes**   | Maps to `param.apiKey`.                       |
| `NEST_HOST`     | No        | Overrides default host `api.smsonlinegh.com`. |
| `NEST_PROTOCOL` | No        | Overrides default `https`.                    |


`**hubtel`**


| Variable               | Required? | Purpose                       |
| ---------------------- | --------- | ----------------------------- |
| `HUBTEL_CLIENT_ID`     | **Yes**   | Maps to `param.clientId`.     |
| `HUBTEL_CLIENT_SECRET` | **Yes**   | Maps to `param.clientSecret`. |


`**route` (Route Mobile)**


| Variable         | Required? | Purpose                                             |
| ---------------- | --------- | --------------------------------------------------- |
| `ROUTE_USERNAME` | **Yes**   | Maps to `param.username`.                           |
| `ROUTE_PASSWORD` | **Yes**   | Maps to `param.password`.                           |
| `ROUTE_HOST`     | No        | Overrides default `rslr.connectbind.com`.           |
| `ROUTE_PORT`     | No        | Overrides default `8080` (set as a numeric string). |
| `ROUTE_PROTOCOL` | No        | Overrides default `http`.                           |


#### Live send (optional; all gateways)


| Variable       | Required?                     | Purpose                                                                                                            |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `TEST_SEND`    | No (default: do not send)     | Set to `true` to call `quickSend()` and send a real SMS. If unset or not `true`, only init and balance checks run. |
| `TEST_FROM`    | **Yes** when `TEST_SEND=true` | `QuickSendParams.From`.                                                                                            |
| `TEST_TO`      | **Yes** when `TEST_SEND=true` | `QuickSendParams.To`.                                                                                              |
| `TEST_CONTENT` | No                            | Message body; if omitted, the script uses a built-in default string.                                               |


---

## How initialization works

1. `**init(settings: IgatewaySettings): smsPlatform`** (in `src/lib/lib.ts`):
  - Validates and constructs a new `smsPlatform` with your `settings`.
  - Stores it as the **module singleton** (`smsPlatformInstance`).
  - Calls `smsPlatform.init()` on that instance (returns the same facade for chaining).
  - Returns the `smsPlatform` instance.
2. `**smsPlatform` constructor** (in `src/lib/platform.ts`):
  - Runs `validateSettings()` (platform id + required `param` fields for that id).
  - Calls `createGateway()` to instantiate the underlying provider (`routeSms`, `HubtelSms`, or `NestSmsGateway`).
3. `**getSmsPlatform(): smsPlatform | null`**: Returns the current singleton, or `null` if `reset()` was called and no new `init()` has run.

There is **no async bootstrap**; after `init()` returns, `quickSend` is ready.

---

## Re-initializing and reset

- **Switch platform or credentials:** Call `**init(newSettings)`** again. Each call **replaces** the stored singleton with a new `smsPlatform`. You do not have to call `reset()` first.
- **Clear the singleton:** `**reset()`** sets the internal reference to `null`. `getSmsPlatform()` then returns `null` until the next `init()`. Use this when you want to guarantee nothing holds a gateway instance (e.g. tests or explicit teardown).

```javascript
const unisms = require('unismsgateway');

const a = unisms.init({ platformId: 'nest', param: { apiKey: 'key-1' } });
// Later: new config
const b = unisms.init({ platformId: 'hubtel', param: { clientId: 'x', clientSecret: 'y' } });
// b replaces a; unisms.getSmsPlatform() === b

unisms.reset();
// unisms.getSmsPlatform() === null

const c = unisms.init({ platformId: 'nest', param: { apiKey: 'key-2' } });
```

---

## Supported gateways


| `platformId` | Provider           | Package / implementation                |
| ------------ | ------------------ | --------------------------------------- |
| `route`      | Route Mobile       | `routemobilesms`                        |
| `hubtel`     | Hubtel SMS (Ghana) | `hubtel-sms-extended`                   |
| `nest`       | SMSOnlineGH        | Built-in REST client (`NestSmsGateway`) |


**Configuration vs env:** Required and optional `param` fields are summarized in [Library usage: required and optional param fields](#library-usage-required-and-optional-param-fields). The live test runner’s `.env` names are listed in [Live integration test environment variables](#live-integration-test-environment-variables).

### `route` (Route Mobile)

**Required `param`:** `username`, `password`.

**Optional `param` (defaults in this library):**


| Field      | Default if omitted     |
| ---------- | ---------------------- |
| `host`     | `rslr.connectbind.com` |
| `protocol` | `'http'`               |
| `port`     | `8080`                 |


These are passed into `routeSms` from `routemobilesms`.

```javascript
const gateway = unisms.init({
  platformId: 'route',
  param: {
    username: 'your-username',
    password: 'your-password',
    host: 'rslr.connectbind.com',
    protocol: 'http',
    port: 8080
  }
});
```

### `hubtel` (Hubtel)

**Required `param`:** `clientId`, `clientSecret`.

No `host` / `protocol` in `IgatewayParam` for Hubtel in this library; configuration follows `hubtel-sms-extended`.

```javascript
const gateway = unisms.init({
  platformId: 'hubtel',
  param: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret'
  }
});
```

### `nest` (SMSOnlineGH)

**Required `param`:** `apiKey`.

**Optional `param`:**


| Field      | Default if omitted    |
| ---------- | --------------------- |
| `host`     | `api.smsonlinegh.com` |
| `protocol` | `'https'`             |


Requests use `POST` to path `**/v5/<endpoint>`** (e.g. send: `message/sms/send`, balance: `account/balance`). Authorization header: `Authorization: key <apiKey>`. Each request opens a fresh connection (keep-alive pooling is disabled) to prevent stale-socket errors in long-running processes.

```javascript
const gateway = unisms.init({
  platformId: 'nest',
  param: {
    apiKey: 'your-api-key'
    // optional: host, protocol
  }
});
```

**Balance (nest only):** The underlying `NestSmsGateway` implements `getBalance()`. Access it via the facade’s `getGateway()`:

```javascript
const gateway = unisms.init({
  platformId: 'nest',
  param: { apiKey: 'your-api-key' }
});

const nest = gateway.getGateway();
const balance = await nest.getBalance();
console.log(balance.balance, balance.model);
```

---

## Sending messages

### `QuickSendParams`

| Field     | Type     | Required | Description                                                            |
| --------- | -------- | -------- | ---------------------------------------------------------------------- |
| `From`    | `string` | yes      | Sender ID or label.                                                    |
| `To`      | `string \| number` | yes      | Recipient MSISDN or number.                                            |
| `Content` | `string` | yes      | Message body.                                                          |
| `Type`    | `number` | no       | Message type; **nest** maps this to request body `type` (default `0`). |

**camelCase:** You may pass **`from`**, **`to`**, **`content`**, and **`type`** instead of the PascalCase names above. Many JavaScript projects use camelCase; if you pass only `content` and `Content` is missing, the SMSOnlineGH (`nest`) API receives no message body and may return handshake **1305** (`MV_ERR_MESSAGE` — missing or invalid message body). The library normalizes both conventions before calling the gateway.

### `quickSend(params, callback?)`

Returns `Promise<SendResult>`. Optional `callback` is invoked with the same result when the promise completes. The `params` argument accepts **`QuickSendParams`** (PascalCase) or **`QuickSendParamsCamel`** (`{ from, to, content, type? }`). See **`normalizeQuickSendParams`** in the public API if you need the same mapping outside `quickSend`.

`**SendResult`:**

```typescript
{
  success: boolean;
  messageId?: string;
  data?: any;
  error?: string;
  statusCode?: number; // HTTP status from the provider when available (nest, etc.)
}
```

When `success` is `false`, always read **`error`** — it contains a human-readable reason (provider status codes, API handshake labels, network errors, and so on). For **`nest`**, if the API rejects the send but returns JSON, **`data`** is the **full parsed response body** (not only `response.data`), so you can inspect `handshake` and any provider fields. For HTTP errors, `data` may be the raw response body string. **`statusCode`** is set when the adapter knows the HTTP status (for example nest).

**Debugging:** Set `param.debug: true` when calling `init()` to print request URLs, bodies, and responses to the console. The live test script enables debug for the `nest` platform so you can trace `quickSend` and `getBalance` without changing application code.

**Example**

```javascript
const unisms = require('unismsgateway');

const gateway = unisms.init({
  platformId: 'nest',
  param: { apiKey: 'your-api-key' }
});

async function sendSms() {
  try {
    const result = await gateway.quickSend({
      From: 'SenderName',
      To: '233XXXXXXXXX',
      Content: 'Hello from unismsgateway!',
      Type: 0
    });

    if (result.success) {
      console.log('Sent:', result.messageId);
    } else {
      console.error('Failed:', result.error);
    }
  } catch (err) {
    console.error(err);
  }
}
```

**With callback**

```javascript
gateway.quickSend(
  { From: 'SenderName', To: '233XXXXXXXXX', Content: 'Test' },
  (response) => {
    console.log(response);
  }
);
```

---

## Testing (live integration)

There is no unit test suite in this package. For **manual integration checks** against real gateways, use the script in `scripts/test-live.ts`.

**Setup**

1. Clone the repo and install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set variables for your chosen platform — see [Live integration test environment variables](#live-integration-test-environment-variables) for required vs optional names per gateway.
3. Run:

```bash
npm test
# same as:
npm run test:live
```

**What runs**

1. **Init** — Builds `param` from your `.env`, calls `init()`, and checks configuration validation.
2. **Balance** — For `nest` and `hubtel` only, calls `getBalance()` when the adapter supports it. `route` skips this step.
3. **Send** — **Opt-in.** By default no SMS is sent. Set `TEST_SEND=true` and the send-related variables listed in [Live integration test environment variables](#live-integration-test-environment-variables).

Full variable reference (selection, per-gateway credentials, live send): [Live integration test environment variables](#live-integration-test-environment-variables). The script loads `.env` via `dotenv` (dev dependency). Exit code is `0` when all checks pass, non-zero if a step fails or no platform is selected.

---

## API reference


| Export                     | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| `init(settings)`           | Create and register the singleton `smsPlatform`, return it.          |
| `getSmsPlatform()`         | Current `smsPlatform` or `null` after `reset()` and before `init()`. |
| `reset()`                  | Clear the singleton.                                                 |
| `smsPlatform`              | Class type for typing/advanced use.                                  |
| `QuickSendParamsInput`     | Union: PascalCase `QuickSendParams` or camelCase `QuickSendParamsCamel`. |
| `QuickSendParamsCamel`     | `{ from, to, content, type? }` for `quickSend`.                      |
| `normalizeQuickSendParams` | Maps input to canonical `QuickSendParams` (throws if body/sender missing). |


`**smsPlatform` instance methods**


| Method                         | Returns               | Description                                    |
| ------------------------------ | --------------------- | ---------------------------------------------- |
| `init()`                       | `ISmsGateway`         | Returns `this` (facade).                       |
| `quickSend(params, callback?)` | `Promise<SendResult>` | Normalizes PascalCase or camelCase params, then delegates to the active gateway. |
| `getGateway()`                 | `ISmsGateway`         | Underlying adapter (for nest: `getBalance()`). |


---

## Changelog

### 1.5.2
- **Build:** TypeScript `rootDir` is now `./src` with `include: ["src/**/*.ts"]` (scripts stay `ts-node`-only). Previously the compiler also picked up `scripts/test-live.ts`, inferred a project root above `src/`, and emitted library code under `dist/src/lib/…` while published entrypoints load `dist/lib/…` — leaving **stale or missing** `dist/lib/nest-gateway.js` (wrong `requestBody` shape). The published `dist/` layout now matches `package.json` `main` and always rebuilds gateway files from current sources.

### 1.5.1
- **Fix (`nest` / all gateways):** `quickSend` now accepts **camelCase** (`from`, `to`, `content`, `type`) as well as PascalCase (`From`, `To`, `Content`, `Type`). Passing only camelCase previously left `Content` undefined, so the nest JSON body omitted `text` and the API returned handshake **1305** (missing or invalid message body). Validation errors throw clear messages when body or sender is empty after trim.

### 1.5.0
- **Fix (`nest`):** `quickSend` now reliably works in long-running processes (servers, workers). Node's global HTTP agent reuses keep-alive sockets across calls; when the provider closes an idle socket server-side, the next `quickSend` that writes a request body received `write ECONNABORTED` while `getBalance` (no body) appeared to work fine. Fixed by setting `agent: false` on each request so every call opens a fresh connection rather than reusing a potentially stale one from the pool.

---

## License

[MIT](https://choosealicense.com/licenses/mit/)