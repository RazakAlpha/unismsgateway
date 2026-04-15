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
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_SOCKETS = 10;
const DEFAULT_RETRIES = 1;

/**
 * Error codes that indicate a stale or broken socket rather than a genuine
 * application-level failure. A single retry on a fresh socket resolves these.
 */
const RETRYABLE_CODES = new Set([
    'ECONNRESET',
    'ECONNABORTED',
    'EPIPE',
    'ENOTCONN',
    'ETIMEDOUT'
]);

interface ResolvedNestConfig {
    host: string;
    protocol: 'http' | 'https';
    apiKey: string;
    debug: boolean;
    timeout: number;
    maxSockets: number;
    retries: number;
    keepAlive: boolean;
}

interface MakeRequestResult {
    statusCode: number;
    body: NestSendResponse;
}

interface HttpError extends Error {
    statusCode?: number;
    rawBody?: string;
    code?: string;
}

export class NestSmsGateway implements ISmsGateway {
    private readonly _cfg: ResolvedNestConfig;
    private _agent: https.Agent | http.Agent;

    constructor(config: NestSmsConfig) {
        this._cfg = {
            host: config.host || DEFAULT_HOST,
            protocol: config.protocol || DEFAULT_PROTOCOL,
            apiKey: config.apiKey,
            debug: config.debug || false,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
            maxSockets: config.maxSockets ?? DEFAULT_MAX_SOCKETS,
            retries: config.retries ?? DEFAULT_RETRIES,
            keepAlive: config.keepAlive !== false
        };
        this._agent = this._createAgent();
    }

    /**
     * Creates a persistent keep-alive connection pool.
     *
     * Why keep-alive instead of `agent: false`:
     *   Each HTTPS request with `agent: false` pays for a full TCP + TLS
     *   handshake (~100–300 ms). With a pooled agent, subsequent requests to the
     *   same host reuse an existing socket and skip the handshake entirely.
     *
     * Stale-socket problem (original reason for `agent: false`):
     *   Servers sometimes close idle sockets, making the next reuse fail with
     *   ECONNABORTED/ECONNRESET. This is handled transparently by the retry
     *   logic in `makeRequest()` rather than paying the handshake penalty on
     *   every single call.
     */
    private _createAgent(): https.Agent | http.Agent {
        const { protocol, maxSockets, keepAlive } = this._cfg;
        const opts = {
            keepAlive,
            maxSockets,
            maxFreeSockets: Math.ceil(maxSockets / 2)
        };
        return protocol === 'https' ? new https.Agent(opts) : new http.Agent(opts);
    }

    /**
     * Destroys all sockets held by the connection pool. Call this when the
     * gateway instance will no longer be used (e.g. during app shutdown) to
     * prevent Node from holding the event loop open.
     */
    destroy(): void {
        this._agent.destroy();
    }

    init(): ISmsGateway {
        return this;
    }

    private log(...args: unknown[]): void {
        if (this._cfg.debug) {
            console.log('[unismsgateway:nest]', ...args);
        }
    }

    /**
     * Performs a single HTTP/S POST to the gateway. Does not retry — see
     * `makeRequest()` for retry orchestration.
     *
     * Key implementation details:
     * - Post body is serialized once to a `Buffer` so `Content-Length` is read
     *   directly from `Buffer.length` (O(1)) rather than re-scanning the string
     *   with `Buffer.byteLength()`.
     * - Response chunks are accumulated in a `Buffer[]` and concatenated once
     *   at the end, avoiding repeated string re-allocation per chunk.
     * - `req.setTimeout()` + `req.destroy()` ensure stalled connections are
     *   aborted within the configured timeout window.
     */
    private _doRequest(
        endpoint: string,
        data?: unknown
    ): Promise<MakeRequestResult> {
        return new Promise((resolve, reject) => {
            const postBuffer = data
                ? Buffer.from(JSON.stringify(data), 'utf8')
                : Buffer.alloc(0);

            const { protocol, timeout } = this._cfg;
            const httpModule = protocol === 'https' ? https : http;
            const defaultPort = protocol === 'https' ? 443 : 80;
            const host = this._cfg.host;
            const hostname = host.includes(':') ? host.split(':')[0] : host;
            const port = host.includes(':')
                ? parseInt(host.split(':')[1], 10)
                : defaultPort;

            const options: https.RequestOptions = {
                hostname,
                port,
                path: `/v5/${endpoint}`,
                method: 'POST',
                agent: this._agent,
                headers: {
                    'Host': hostname,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `key ${this._cfg.apiKey}`,
                    'Content-Length': postBuffer.length
                }
            };

            this.log(`POST /v5/${endpoint}`, data ? JSON.stringify(data) : '(no body)');

            const req = httpModule.request(options, (res) => {
                const chunks: Buffer[] = [];

                res.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    const statusCode = res.statusCode ?? 0;
                    const responseBody = Buffer.concat(chunks).toString('utf8');
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

            req.setTimeout(timeout, () => {
                const err: HttpError = new Error(
                    `Request timed out after ${timeout}ms`
                );
                err.code = 'ETIMEDOUT';
                req.destroy(err);
            });

            req.on('error', (error) => {
                this.log('Network error:', error.message);
                reject(error);
            });

            if (postBuffer.length > 0) {
                req.write(postBuffer);
            }
            req.end();
        });
    }

    /**
     * Wraps `_doRequest` with automatic retry for transient socket errors.
     *
     * When a keep-alive socket is reused and the server has already closed it
     * on its end, the write fails with ECONNABORTED or ECONNRESET. A single
     * retry on a fresh socket (which the agent provisions automatically after
     * destroying the bad one) is sufficient to recover in virtually all cases.
     */
    private async makeRequest(
        endpoint: string,
        data?: unknown,
        attempt = 0
    ): Promise<MakeRequestResult> {
        try {
            return await this._doRequest(endpoint, data);
        } catch (error: unknown) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code && RETRYABLE_CODES.has(code) && attempt < this._cfg.retries) {
                this.log(
                    `Retrying POST /v5/${endpoint} (attempt ${attempt + 1}/${this._cfg.retries}) after ${code}`
                );
                return this.makeRequest(endpoint, data, attempt + 1);
            }
            throw error;
        }
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
