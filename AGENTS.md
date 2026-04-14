# AGENTS.md - Unified SMS Gateway

## Project Overview

This is a TypeScript library that provides a unified API for multiple SMS gateways (Hubtel, routeMobile, smsonlinegh/nest).

## Build Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Live integration test (requires .env — see .env.example and README.md)
npm test
# equivalent: npm run test:live

# Install dependencies
npm install
```

**Tests**: `npm test` runs `scripts/test-live.ts` via `ts-node`. It is a manual integration runner (not Jest): loads `.env` with `dotenv`, validates init, optional `getBalance` for nest/hubtel, optional live send when `TEST_SEND=true`. There is no unit test framework; see README.md **Testing (live integration)** for env vars.

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ES2016
- **Module**: CommonJS
- **Strict mode**: Enabled (all strict type checks)
- **esModuleInterop**: Enabled
- **Declaration files**: Generated automatically
- **Output directory**: `./dist/`

### Naming Conventions
- **Classes**: PascalCase (e.g., `smsPlatform`, `NestSmsGateway`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `IgatewaySettings`, `ISmsGateway`)
- **Functions/Variables**: camelCase (e.g., `quickSend`, `getSmsPlatform`)
- **Private members**: Underscore prefix (e.g., `_settings`, `_gateway`)
- **Type aliases**: PascalCase (e.g., `PlatformId`, `SendResult`)

### Type Annotations
- Always use explicit return types on public methods
- Use `interface` for object shapes
- Use `type` for union types and aliases
- Avoid `any` - prefer proper typing
- Use union types for known values (e.g., `PlatformId`)

### Import Style
```typescript
// External modules first
import { HubtelSms } from 'hubtel-sms-extended';
import { routeSms } from 'routemobilesms';
import * as https from 'https';

// Internal modules with relative paths
import { ISmsGateway, QuickSendParams } from './types';
```

### Formatting
- Use 2-space indentation
- Semicolons at end of statements
- Braces on same line for control structures
- Single quotes for strings
- No trailing commas in multiline

### Error Handling
- Throw `Error` objects with descriptive messages
- Use try/catch for async operations
- Validate configuration early with descriptive errors
- Return `SendResult` objects for operation outcomes

### Project Structure
```
src/
  index.ts           # Main exports
  lib/
    lib.ts           # Public API: init(), getSmsPlatform(), reset()
    platform.ts      # Core smsPlatform class and re-exports
    types.ts         # All TypeScript interfaces and types
    nest-gateway.ts  # SMSOnlineGH REST API implementation
scripts/
  test-live.ts       # Live integration test runner (npm test)
dist/                # Compiled output (do not edit)
typings.d.ts         # Module declarations for external packages
.env.example         # Template for test-live credentials
```

### Key Types and Interfaces

```typescript
type PlatformId = 'route' | 'hubtel' | 'nest';

interface QuickSendParams {
 From: string;
 To: string | number;
 Content: string;
 Type?: number;
}
// quickSend also accepts camelCase { from, to, content, type? }; see normalizeQuickSendParams in types.ts.

interface SendResult {
    success: boolean;
    messageId?: string;
    data?: any;
    error?: string;
}

interface IgatewaySettings {
    platformId: PlatformId;
    param: IgatewayParam;
}

interface IgatewayParam {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    apiKey?: string;        // For nest/smsOnlineGH
    protocol?: 'http' | 'https';
}

interface ISmsGateway {
    init(): ISmsGateway;
    quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult>;
    getBalance?(): Promise<any>;
}
```

### Supported Gateways

| Platform ID | Package | Required Params |
|-------------|---------|-----------------|
| `route` | routemobilesms | username, password, host |
| `hubtel` | hubtel-sms-extended | clientId, clientSecret |
| `nest` | Built-in REST API | apiKey |

### Adding New SMS Gateways

1. Create new gateway file in `src/lib/` implementing `ISmsGateway` interface
2. Add platform ID to `PlatformId` type in `types.ts`
3. Add required config to `IgatewayParam` and `GATEWAY_CONFIGS` in `platform.ts`
4. Add case in `createGateway()` switch statement
5. Run `npm run build` to compile

### Gateway Implementation Pattern

```typescript
import { ISmsGateway, QuickSendParams, SendResult } from './types';

export class NewSmsGateway implements ISmsGateway {
    constructor(config: NewGatewayConfig) {
        // Validate and store configuration
    }

    init(): ISmsGateway {
        return this;
    }

    async quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult> {
        // Implement send logic
        // Return SendResult object
    }
}
```

### Testing
- **`npm test`** / **`npm run test:live`**: runs `scripts/test-live.ts` (needs `.env` from `.env.example`). See README.md **Testing (live integration)**.
- No Jest or other unit test framework; optional future addition for mocked gateway tests.

### Publishing
- `npm run prepublish` runs build before publish
- Only `./dist/` folder is published to npm