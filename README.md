# Unified Sms Gateway

Most of the time a single project relies on multiple sms Gateway so it can switched if one goes off.
However, each sms api specification is different from the other, hence the need to create separate implementation
for each sms gateway.

Unified sms gateway is library that brings most common sms gateways under a Unified api.
which means you only does one implementation in it works for all supported sms gateway. 
you just have select or switch your sms platform and your code still works fine like nothing has changed


## Installation

```bash
npm install unismsgateway
```

## Supported Gateways

| Platform ID | Provider | Required Params |
|-------------|----------|-----------------|
| `route` | routeMobile | username, password, host |
| `hubtel` | Hubtel SMS (Ghana) | clientId, clientSecret |
| `nest` | SMSOnlineGH / smsonlinegh | apiKey |

## Usage/Examples

### Initialize with Platform

```javascript
const unisms = require('unismsgateway')

// For routeMobile
const routeGateway = unisms.init({
    platformId: 'route',
    param: {
        username: 'your-username',
        password: 'your-password',
        host: 'rslr.connectbind.com',
        protocol: 'http',
        port: 8080
    }
})

// For Hubtel
const hubtelGateway = unisms.init({
    platformId: 'hubtel',
    param: {
        clientId: 'your-client-id',
        clientSecret: 'your-client-secret'
    }
})

// For SMSOnlineGH (nest)
const nestGateway = unisms.init({
    platformId: 'nest',
    param: {
        apiKey: 'your-api-key',
        // Optional: host, protocol (defaults to api.smsonlinegh.com, https)
    }
})
```

### Send SMS Message

```javascript
const unisms = require('unismsgateway')

// Initialize gateway
const gateway = unisms.init({
    platformId: 'nest',
    param: {
        apiKey: 'your-api-key'
    }
})

// Send message
async function sendSms() {
    try {
        const result = await gateway.quickSend({
            From: 'SenderName',
            To: '233XXXXXXXXX',  // recipient number
            Content: 'Hello from unismsgateway!',
            Type: 0  // optional, defaults to 0
        })
        
        if (result.success) {
            console.log('Message sent successfully:', result.messageId)
        } else {
            console.error('Failed to send:', result.error)
        }
    } catch (err) {
        console.error('Error:', err)
    }
}

sendSms()
```

### With Callback

```javascript
gateway.quickSend({
    From: 'SenderName',
    To: '233XXXXXXXXX',
    Content: 'Test message'
}, (response) => {
    console.log('Response:', response)
})
```

### Check Balance (SMSOnlineGH/nest only)

```javascript
const gateway = unisms.init({
    platformId: 'nest',
    param: { apiKey: 'your-api-key' }
})

// Only available for nest platform
if (gateway.getGateway) {
    const nestGateway = gateway.getGateway()
    const balance = await nestGateway.getBalance()
    console.log('Balance:', balance)
}
```

### Reset Gateway Instance

```javascript
// Clear the current gateway instance
unisms.reset()

// Initialize with new platform
const newGateway = unisms.init({
    platformId: 'hubtel',
    param: {
        clientId: 'new-client-id',
        clientSecret: 'new-secret'
    }
})
```

## API Reference

### `init(settings: IgatewaySettings): smsPlatform`

Initialize the SMS gateway with your platform configuration.

**Parameters:**
- `platformId`: `'route'` | `'hubtel'` | `'nest'`
- `param`: Platform-specific configuration object

### `getSmsPlatform(): smsPlatform | null`

Get the current gateway instance. Returns `null` if not initialized.

### `reset(): void`

Clear the current gateway instance.

### `quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult>`

Send an SMS message.

**Parameters:**
- `From`: Sender ID/name
- `To`: Recipient phone number (string or number)
- `Content`: Message content
- `Type`: Optional message type (defaults to 0)

**Returns:**
```typescript
{
    success: boolean;
    messageId?: string;
    data?: any;
    error?: string;
}
```

## License

[MIT](https://choosealicense.com/licenses/mit/)