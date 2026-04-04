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

| Field | Type | Description |
|-------|------|-------------|
| `platformId` | `'route' \| 'hubtel' \| 'nest'` | Which gateway to use. |
| `param` | `IgatewayParam` | Provider-specific options (see below). |

### `IgatewayParam` (all fields optional except what your `platformId` requires)

| Field | Type | Used by | Description |
|-------|------|---------|-------------|
| `username` | `string` | `route` | Route Mobile account username. **Required** for `route`. |
| `password` | `string` | `route` | Route Mobile account password. **Required** for `route`. |
| `host` | `string` | `route`, `nest` | API host. See per-gateway defaults below. |
| `port` | `number` | `route` | TCP port for Route Mobile. Default: `8080`. |
| `protocol` | `'http' \| 'https'` | `route`, `nest` | URL scheme. See defaults per gateway. |
| `clientId` | `string` | `hubtel` | Hubtel client ID. **Required** for `hubtel`. |
| `clientSecret` | `string` | `hubtel` | Hubtel client secret. **Required** for `hubtel`. |
| `apiKey` | `string` | `nest` | SMSOnlineGH API key (`Authorization: key …`). **Required** for `nest`. |

Validation runs in `smsPlatform` when the instance is constructed: missing required fields for the chosen `platformId` throw `Error` with a clear message.

---

## Environment variables

**This library does not read `process.env` or any configuration files.** You pass all credentials and endpoints explicitly in `init({ platformId, param })`.

In your own application it is common to map environment variables into `param`. Suggested names (you define these in `.env` or your host’s secret store):

| Suggested env name | Maps to `param` | Gateways |
|--------------------|-----------------|----------|
| `SMS_PLATFORM_ID` | `platformId` | all |
| `ROUTE_SMS_USERNAME` | `username` | `route` |
| `ROUTE_SMS_PASSWORD` | `password` | `route` |
| `ROUTE_SMS_HOST` | `host` | `route` (optional; has default) |
| `ROUTE_SMS_PORT` | `port` | `route` (optional) |
| `ROUTE_SMS_PROTOCOL` | `protocol` | `route` (optional) |
| `HUBTEL_CLIENT_ID` | `clientId` | `hubtel` |
| `HUBTEL_CLIENT_SECRET` | `clientSecret` | `hubtel` |
| `SMSONLINEGH_API_KEY` or `NEST_API_KEY` | `apiKey` | `nest` |
| `SMSONLINEGH_HOST` or `NEST_HOST` | `host` | `nest` (optional) |
| `SMSONLINEGH_PROTOCOL` or `NEST_PROTOCOL` | `protocol` | `nest` (optional) |

Example wiring (conceptual): branch on `platformId` and build `param` so you do not mix unrelated fields.

```javascript
const unisms = require('unismsgateway');

const platformId = process.env.SMS_PLATFORM_ID;

const paramByPlatform = {
  route: {
    username: process.env.ROUTE_SMS_USERNAME,
    password: process.env.ROUTE_SMS_PASSWORD,
    host: process.env.ROUTE_SMS_HOST,
    port: process.env.ROUTE_SMS_PORT ? Number(process.env.ROUTE_SMS_PORT) : undefined,
    protocol: process.env.ROUTE_SMS_PROTOCOL
  },
  hubtel: {
    clientId: process.env.HUBTEL_CLIENT_ID,
    clientSecret: process.env.HUBTEL_CLIENT_SECRET
  },
  nest: {
    apiKey: process.env.SMSONLINEGH_API_KEY,
    host: process.env.SMSONLINEGH_HOST,
    protocol: process.env.SMSONLINEGH_PROTOCOL
  }
};

const gateway = unisms.init({
  platformId,
  param: paramByPlatform[platformId]
});
```

---

## How initialization works

1. **`init(settings: IgatewaySettings): smsPlatform`** (in `src/lib/lib.ts`):
   - Validates and constructs a new `smsPlatform` with your `settings`.
   - Stores it as the **module singleton** (`smsPlatformInstance`).
   - Calls `smsPlatform.init()` on that instance (returns the same facade for chaining).
   - Returns the `smsPlatform` instance.

2. **`smsPlatform` constructor** (in `src/lib/platform.ts`):
   - Runs `validateSettings()` (platform id + required `param` fields for that id).
   - Calls `createGateway()` to instantiate the underlying provider (`routeSms`, `HubtelSms`, or `NestSmsGateway`).

3. **`getSmsPlatform(): smsPlatform | null`**: Returns the current singleton, or `null` if `reset()` was called and no new `init()` has run.

There is **no async bootstrap**; after `init()` returns, `quickSend` is ready.

---

## Re-initializing and reset

- **Switch platform or credentials:** Call **`init(newSettings)`** again. Each call **replaces** the stored singleton with a new `smsPlatform`. You do not have to call `reset()` first.
- **Clear the singleton:** **`reset()`** sets the internal reference to `null`. `getSmsPlatform()` then returns `null` until the next `init()`. Use this when you want to guarantee nothing holds a gateway instance (e.g. tests or explicit teardown).

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

| `platformId` | Provider | Package / implementation |
|----------------|----------|---------------------------|
| `route` | Route Mobile | `routemobilesms` |
| `hubtel` | Hubtel SMS (Ghana) | `hubtel-sms-extended` |
| `nest` | SMSOnlineGH | Built-in REST client (`NestSmsGateway`) |

### `route` (Route Mobile)

**Required `param`:** `username`, `password`.

**Optional `param` (defaults in this library):**

| Field | Default if omitted |
|-------|-------------------|
| `host` | `rslr.connectbind.com` |
| `protocol` | `'http'` |
| `port` | `8080` |

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

| Field | Default if omitted |
|-------|-------------------|
| `host` | `api.smsonlinegh.com` |
| `protocol` | `'https'` |

Requests use `POST` to path **`/v5/<endpoint>`** (e.g. send: `message/sms/send`, balance: `account/balance`). Authorization header: `Authorization: key <apiKey>`.

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `From` | `string` | yes | Sender ID or label. |
| `To` | `string \| number` | yes | Recipient number (format as required by the provider). |
| `Content` | `string` | yes | Message body. |
| `Type` | `number` | no | Message type; **nest** maps this to request body `type` (default `0`). |

### `quickSend(params, callback?)`

Returns `Promise<SendResult>`. Optional `callback` is invoked with the same result when the promise completes.

**`SendResult`:**

```typescript
{
  success: boolean;
  messageId?: string;
  data?: any;
  error?: string;
}
```

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

## API reference

| Export | Description |
|--------|-------------|
| `init(settings)` | Create and register the singleton `smsPlatform`, return it. |
| `getSmsPlatform()` | Current `smsPlatform` or `null` after `reset()` and before `init()`. |
| `reset()` | Clear the singleton. |
| `smsPlatform` | Class type for typing/advanced use. |

**`smsPlatform` instance methods**

| Method | Returns | Description |
|--------|---------|-------------|
| `init()` | `ISmsGateway` | Returns `this` (facade). |
| `quickSend(params, callback?)` | `Promise<SendResult>` | Delegates to the active gateway. |
| `getGateway()` | `ISmsGateway` | Underlying adapter (for nest: `getBalance()`). |

---

## License

[MIT](https://choosealicense.com/licenses/mit/)
