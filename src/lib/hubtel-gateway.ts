import * as https from 'https';
import * as http from 'http';
import {
    ISmsGatewayDelegate,
    QuickSendParams,
    SendParams,
    PersonalizedSendParams,
    SendResult,
    HubtelSmsConfig,
    HubtelSendResponse,
    HubtelBatchSendResponse,
    HubtelMessageStatus,
    HubtelBatchStatusResponse
} from './types';

const DEFAULT_HOST = 'sms.hubtel.com';
const DEFAULT_PROTOCOL = 'https';
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_SOCKETS = 10;
const DEFAULT_RETRIES = 1;
const MAX_SENDER_LENGTH = 11;

const PLACEHOLDER_RE = /\{\$([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

const RETRYABLE_CODES = new Set([
    'ECONNRESET',
    'ECONNABORTED',
    'EPIPE',
    'ENOTCONN',
    'ETIMEDOUT'
]);

const HUBTEL_STATUS_MESSAGES: Record<number, string> = {
    1: 'Invalid destination address',
    2: 'Invalid source address — Sender ID must be 11 characters or fewer',
    3: 'Message body too long',
    4: 'Message is not routable on the Hubtel gateway',
    5: 'Delivery time specified was not a valid timestamp',
    6: 'Message content rejected or invalid',
    7: 'One or more parameters not allowed in the message',
    8: 'One or more parameters not valid for the message',
    12: 'Insufficient balance — fund your SMS API account',
    100: 'General invalid request'
};

interface ResolvedHubtelConfig {
    host: string;
    protocol: 'http' | 'https';
    clientId: string;
    clientSecret: string;
    debug: boolean;
    timeout: number;
    maxSockets: number;
    retries: number;
    keepAlive: boolean;
    authHeader: string;
}

interface MakeRequestResult<T = unknown> {
    statusCode: number;
    body: T;
}

interface HttpError extends Error {
    statusCode?: number;
    rawBody?: string;
    code?: string;
}

export class HubtelSmsGateway implements ISmsGatewayDelegate {
    private readonly _cfg: ResolvedHubtelConfig;
    private _agent: https.Agent | http.Agent;

    constructor(config: HubtelSmsConfig) {
        if (!config.clientId || !config.clientSecret) {
            throw new Error('Hubtel requires clientId and clientSecret');
        }

        const credentials = `${config.clientId}:${config.clientSecret}`;
        this._cfg = {
            host: config.host || DEFAULT_HOST,
            protocol: config.protocol || DEFAULT_PROTOCOL,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            debug: config.debug || false,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
            maxSockets: config.maxSockets ?? DEFAULT_MAX_SOCKETS,
            retries: config.retries ?? DEFAULT_RETRIES,
            keepAlive: config.keepAlive !== false,
            authHeader: `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`
        };
        this._agent = this._createAgent();
    }

    private _createAgent(): https.Agent | http.Agent {
        const { protocol, maxSockets, keepAlive } = this._cfg;
        const opts = {
            keepAlive,
            maxSockets,
            maxFreeSockets: Math.ceil(maxSockets / 2)
        };
        return protocol === 'https' ? new https.Agent(opts) : new http.Agent(opts);
    }

    destroy(): void {
        this._agent.destroy();
    }

    private log(...args: unknown[]): void {
        if (this._cfg.debug) {
            console.log('[unismsgateway:hubtel]', ...args);
        }
    }

    private _normalizePhone(to: string | number): string {
        const digits = String(to).replace(/\D/g, '');
        if (digits === '') {
            throw new Error(`Invalid recipient number: ${to}`);
        }
        return digits;
    }

    private _validateSender(from: string): string {
        const trimmed = from.trim();
        if (trimmed === '') {
            throw new Error('Sender ID (From) must be a non-empty string');
        }
        if (trimmed.length > MAX_SENDER_LENGTH) {
            throw new Error(
                `Sender ID must be ${MAX_SENDER_LENGTH} characters or fewer (got ${trimmed.length})`
            );
        }
        return trimmed;
    }

    private _doRequest<T = unknown>(
        method: 'GET' | 'POST',
        path: string,
        data?: unknown
    ): Promise<MakeRequestResult<T>> {
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

            const headers: Record<string, string | number> = {
                'Host': hostname,
                'Accept': 'application/json',
                'Authorization': this._cfg.authHeader
            };

            if (method === 'POST') {
                headers['Content-Type'] = 'application/json';
                headers['Content-Length'] = postBuffer.length;
            }

            const options: https.RequestOptions = {
                hostname,
                port,
                path,
                method,
                agent: this._agent,
                headers
            };

            this.log(`${method} ${path}`, data ? JSON.stringify(data) : '(no body)');

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
                        const parsed = responseBody
                            ? (JSON.parse(responseBody) as T)
                            : ({} as T);

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

    private async makeRequest<T = unknown>(
        method: 'GET' | 'POST',
        path: string,
        data?: unknown,
        attempt = 0
    ): Promise<MakeRequestResult<T>> {
        try {
            return await this._doRequest<T>(method, path, data);
        } catch (error: unknown) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code && RETRYABLE_CODES.has(code) && attempt < this._cfg.retries) {
                this.log(
                    `Retrying ${method} ${path} (attempt ${attempt + 1}/${this._cfg.retries}) after ${code}`
                );
                return this.makeRequest<T>(method, path, data, attempt + 1);
            }
            throw error;
        }
    }

    private _hubtelStatusError(
        status: number | undefined,
        statusDescription?: string
    ): string {
        if (statusDescription) {
            return `Hubtel API Error: ${statusDescription}`;
        }
        if (status !== undefined && HUBTEL_STATUS_MESSAGES[status]) {
            return `Hubtel API Error [${status}]: ${HUBTEL_STATUS_MESSAGES[status]}`;
        }
        if (status !== undefined) {
            return `Hubtel API Error: status=${status}`;
        }
        return 'Hubtel API Error: unexpected response';
    }

    private _parseSendResponse(
        statusCode: number,
        response: HubtelSendResponse
    ): SendResult {
        const apiStatus = Number(response.status);
        const ok = apiStatus === 0;

        return {
            success: ok,
            messageId: response.messageId != null ? String(response.messageId) : undefined,
            data: response,
            error: ok
                ? undefined
                : this._hubtelStatusError(apiStatus, response.statusDescription),
            statusCode
        };
    }

    private _parseBatchResponse(
        statusCode: number,
        response: HubtelBatchSendResponse
    ): SendResult {
        const apiStatus = Number(response.status);
        const ok = apiStatus === 0;

        return {
            success: ok,
            messageId: response.batchId != null ? String(response.batchId) : undefined,
            data: response,
            error: ok
                ? undefined
                : this._hubtelStatusError(apiStatus),
            statusCode
        };
    }

    private _failureResult(error: unknown): SendResult {
        const httpErr = error as HttpError;
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        return {
            success: false,
            error: errorMessage,
            statusCode: httpErr.statusCode,
            data: httpErr.rawBody !== undefined ? httpErr.rawBody : null
        };
    }

    private _extractTemplateVariables(template: string): string[] {
        const seen = new Set<string>();
        const vars: string[] = [];
        const re = new RegExp(PLACEHOLDER_RE.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = re.exec(template)) !== null) {
            const name = match[1];
            if (!seen.has(name)) {
                seen.add(name);
                vars.push(name);
            }
        }

        return vars;
    }

    private _expandTemplate(
        template: string,
        variables: string[],
        values: (string | number)[],
        destinationIndex: number
    ): string {
        if (values.length !== variables.length) {
            throw new Error(
                `sendPersonalized: destination at index ${destinationIndex} has ${values.length} value(s) but the template has ${variables.length} placeholder(s): ${variables.map(v => `{$${v}}`).join(', ')}`
            );
        }

        const valueMap = new Map<string, string>();
        for (let i = 0; i < variables.length; i++) {
            valueMap.set(variables[i], String(values[i]));
        }

        return template.replace(PLACEHOLDER_RE, (full, name: string) => {
            const val = valueMap.get(name);
            return val !== undefined ? val : full;
        });
    }

    private _buildPersonalizedRecipients(
        params: PersonalizedSendParams
    ): { To: string; Content: string }[] {
        const variables = this._extractTemplateVariables(params.Content);

        return params.Destinations.map((dest, index) => ({
            To: this._normalizePhone(dest.To),
            Content: this._expandTemplate(
                params.Content,
                variables,
                dest.Values,
                index
            )
        }));
    }

    async quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult> {
        this.log('quickSend params:', JSON.stringify(params));

        let result: SendResult;

        try {
            const from = this._validateSender(params.From);
            const to = this._normalizePhone(params.To);

            const { statusCode, body } = await this.makeRequest<HubtelSendResponse>(
                'POST',
                '/v1/messages/send',
                {
                    From: from,
                    To: to,
                    Content: params.Content
                }
            );

            result = this._parseSendResponse(statusCode, body);
        } catch (error: unknown) {
            result = this._failureResult(error);
        }

        this.log('quickSend result:', JSON.stringify(result));

        if (callback) {
            callback(result);
        }

        return result;
    }

    async send(params: SendParams, callback?: Function): Promise<SendResult> {
        this.log('send params:', JSON.stringify(params));

        let result: SendResult;

        try {
            const from = this._validateSender(params.From);
            const recipients = params.To.map((to) => this._normalizePhone(to));

            const { statusCode, body } = await this.makeRequest<HubtelBatchSendResponse>(
                'POST',
                '/v1/messages/batch/simple/send',
                {
                    From: from,
                    Recipients: recipients,
                    Content: params.Content
                }
            );

            result = this._parseBatchResponse(statusCode, body);
        } catch (error: unknown) {
            result = this._failureResult(error);
        }

        this.log('send result:', JSON.stringify(result));

        if (callback) {
            callback(result);
        }

        return result;
    }

    async sendPersonalized(
        params: PersonalizedSendParams,
        callback?: Function
    ): Promise<SendResult> {
        this.log('sendPersonalized params:', JSON.stringify(params));

        let result: SendResult;

        try {
            const from = this._validateSender(params.From);
            const personalizedRecipients = this._buildPersonalizedRecipients(params);

            const { statusCode, body } = await this.makeRequest<HubtelBatchSendResponse>(
                'POST',
                '/v1/messages/batch/personalized/send',
                {
                    From: from,
                    personalizedRecipients
                }
            );

            result = this._parseBatchResponse(statusCode, body);
        } catch (error: unknown) {
            result = this._failureResult(error);
        }

        this.log('sendPersonalized result:', JSON.stringify(result));

        if (callback) {
            callback(result);
        }

        return result;
    }

    async getMessageStatus(messageId: string): Promise<HubtelMessageStatus> {
        this.log('getMessageStatus:', messageId);
        const { body } = await this.makeRequest<HubtelMessageStatus>(
            'GET',
            `/v1/messages/${encodeURIComponent(messageId)}`
        );
        return body;
    }

    async getBatchStatus(batchId: string): Promise<HubtelBatchStatusResponse> {
        this.log('getBatchStatus:', batchId);
        const { body } = await this.makeRequest<HubtelBatchStatusResponse>(
            'GET',
            `/v1/messages/batch/${encodeURIComponent(batchId)}`
        );
        return body;
    }
}
