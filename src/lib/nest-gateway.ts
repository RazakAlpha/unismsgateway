import * as https from 'https';
import * as http from 'http';
import { 
    ISmsGateway, 
    QuickSendParams, 
    SendResult, 
    NestSmsConfig, 
    NestSendResponse 
} from './types';

const DEFAULT_HOST = 'api.smsonlinegh.com';
const DEFAULT_PROTOCOL = 'https';

export class NestSmsGateway implements ISmsGateway {
    private config: NestSmsConfig;

    constructor(config: NestSmsConfig) {
        this.config = {
            host: config.host || DEFAULT_HOST,
            protocol: config.protocol || DEFAULT_PROTOCOL,
            apiKey: config.apiKey
        };
    }

    init(): ISmsGateway {
        return this;
    }

    private async makeRequest(
        endpoint: string, 
        data?: any
    ): Promise<NestSendResponse> {
        return new Promise((resolve, reject) => {
            const postData = data ? JSON.stringify(data) : '';
            const protocol = this.config.protocol || DEFAULT_PROTOCOL;
            const httpModule = protocol === 'https' ? https : http;
            const defaultPort = protocol === 'https' ? 443 : 80;

            const options = {
                hostname: this.config.host || DEFAULT_HOST,
                port: this.config.host?.includes(':') 
                    ? parseInt(this.config.host.split(':')[1]) 
                    : defaultPort,
                path: `/v5/${endpoint}`,
                method: 'POST',
                headers: {
                    'Host': this.config.host || DEFAULT_HOST,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `key ${this.config.apiKey}`,
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = httpModule.request(options, (res) => {
                let responseBody = '';

                res.on('data', (chunk) => {
                    responseBody += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            const parsed = JSON.parse(responseBody);
                            resolve(parsed);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${responseBody}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    async quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult> {
        const endpoint = 'message/sms/send';
        // SMSOnlineGH v5 expects: text, sender, destinations[] (see API docs — not from/to/content).
        const requestBody = {
            text: params.Content,
            type: params.Type || 0,
            sender: params.From,
            destinations: [String(params.To)]
        };

        try {
            const response = await this.makeRequest(endpoint, requestBody);
            const handshakeOk = Number(response.handshake?.id) === 0;
            const data = response.data ?? null;
            const batchId = data && typeof data === 'object' ? (data as { batch?: string }).batch : undefined;
            const firstDest = data && typeof data === 'object'
                ? (data as { destinations?: { id?: string }[] }).destinations?.[0]
                : undefined;

            const result: SendResult = {
                success: handshakeOk,
                data,
                messageId: batchId || firstDest?.id,
                error: handshakeOk
                    ? undefined
                    : (response.handshake?.label
                        || `handshake id ${String(response.handshake?.id)}`)
            };

            if (callback) {
                callback(result);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const result: SendResult = {
                success: false,
                error: errorMessage
            };

            if (callback) {
                callback(result);
            }

            return result;
        }
    }

    async getBalance(): Promise<{ balance: number; model: string }> {
        const endpoint = 'account/balance';
        const response = await this.makeRequest(endpoint);
        
        return {
            balance: response.data?.balance || 0,
            model: response.data?.model || 'quantity'
        };
    }
}