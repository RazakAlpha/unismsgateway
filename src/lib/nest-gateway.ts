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

interface MakeRequestResult {
    statusCode: number;
    body: NestSendResponse;
}

interface HttpError extends Error {
    statusCode?: number;
    rawBody?: string;
}

export class NestSmsGateway implements ISmsGateway {
    private config: NestSmsConfig;

    constructor(config: NestSmsConfig) {
        this.config = {
            host: config.host || DEFAULT_HOST,
            protocol: config.protocol || DEFAULT_PROTOCOL,
            apiKey: config.apiKey,
            debug: config.debug || false
        };
    }

    init(): ISmsGateway {
        return this;
    }

    private log(...args: unknown[]): void {
        if (this.config.debug) {
            console.log('[unismsgateway:nest]', ...args);
        }
    }

    private async makeRequest(
        endpoint: string,
        data?: unknown
    ): Promise<MakeRequestResult> {
        return new Promise((resolve, reject) => {
            const postData = data ? JSON.stringify(data) : '';
            const protocol = this.config.protocol || DEFAULT_PROTOCOL;
            const httpModule = protocol === 'https' ? https : http;
            const defaultPort = protocol === 'https' ? 443 : 80;
            const host = this.config.host || DEFAULT_HOST;
            const hostname = host.includes(':') ? host.split(':')[0] : host;
            const port = host.includes(':')
                ? parseInt(host.split(':')[1], 10)
                : defaultPort;

            const options = {
                hostname,
                port,
                path: `/v5/${endpoint}`,
                method: 'POST',
                // Disable keep-alive connection pooling. Node's global agent reuses
                // sockets across calls; when the server closes an idle socket server-side
                // the next write (i.e. the request body in quickSend) gets ECONNABORTED.
                // agent:false forces a fresh connection for every request.
                agent: false,
                headers: {
                    'Host': hostname,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `key ${this.config.apiKey}`,
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            this.log(`POST /v5/${endpoint}`, data ? JSON.stringify(data) : '(no body)');

            const req = httpModule.request(options, (res) => {
                let responseBody = '';

                res.on('data', (chunk) => {
                    responseBody += chunk;
                });

                res.on('end', () => {
                    const statusCode = res.statusCode ?? 0;
                    this.log(`HTTP ${statusCode} response:`, responseBody);

                    try {
                        const parsed: NestSendResponse = JSON.parse(responseBody);

                        if (statusCode >= 200 && statusCode < 300) {
                            resolve({ statusCode, body: parsed });
                        } else {
                            const err: HttpError = new Error(
                                `HTTP ${statusCode}: ${responseBody}`
                            );
                            err.statusCode = statusCode;
                            err.rawBody = responseBody;
                            reject(err);
                        }
                    } catch {
                        const err: HttpError = new Error(
                            `Failed to parse gateway response (HTTP ${statusCode}): ${responseBody}`
                        );
                        err.statusCode = statusCode;
                        err.rawBody = responseBody;
                        reject(err);
                    }
                });
            });

            req.on('error', (error) => {
                this.log('Network error:', error.message);
                reject(error);
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }

    async quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult> {
        const requestBody = {
            text: params.Content,
            type: params.Type ?? 0,
            sender: params.From,
            destinations: [String(params.To)]
        };

        this.log('quickSend params:', JSON.stringify(params));

        let result: SendResult;

        try {
            const { statusCode, body: response } = await this.makeRequest(
                'message/sms/send',
                requestBody
            );

            const handshakeId = response.handshake?.id;
            const handshakeLabel = response.handshake?.label;
            const handshakeOk = Number(handshakeId) === 0;
            const responseData = response.data ?? null;

            const batchId =
                responseData && typeof responseData === 'object'
                    ? (responseData as { batch?: string }).batch
                    : undefined;
            const firstDest =
                responseData && typeof responseData === 'object'
                    ? (
                          responseData as {
                              destinations?: { id?: string }[];
                          }
                      ).destinations?.[0]
                    : undefined;

            let errorMsg: string | undefined;
            if (!handshakeOk) {
                if (handshakeLabel) {
                    errorMsg = `API Error [code ${handshakeId}]: ${handshakeLabel}`;
                } else if (handshakeId !== undefined && handshakeId !== null) {
                    errorMsg = `API Error: handshake code=${handshakeId}`;
                } else {
                    errorMsg = `Unexpected API response: ${JSON.stringify(response)}`;
                }
            }

            result = {
                success: handshakeOk,
                messageId: batchId || firstDest?.id,
                // On failure, expose the full raw response so callers can inspect it.
                data: handshakeOk ? responseData : response,
                error: errorMsg,
                statusCode
            };
        } catch (error: unknown) {
            const httpErr = error as HttpError;
            const errorMessage =
                error instanceof Error ? error.message : String(error);

            result = {
                success: false,
                error: errorMessage,
                statusCode: httpErr.statusCode,
                // Preserve whatever raw body we got for inspection.
                data: httpErr.rawBody !== undefined ? httpErr.rawBody : null
            };
        }

        this.log('quickSend result:', JSON.stringify(result));

        if (callback) {
            callback(result);
        }

        return result;
    }

    async getBalance(): Promise<{ balance: number; model: string }> {
        this.log('getBalance called');
        const { body: response } = await this.makeRequest('account/balance');
        return {
            balance: (response.data as { balance?: number })?.balance ?? 0,
            model: (response.data as { model?: string })?.model ?? 'quantity'
        };
    }
}
