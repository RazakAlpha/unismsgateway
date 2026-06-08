export type PlatformId = 'route' | 'hubtel' | 'nest';

export interface QuickSendParams {
    From: string;
    To: string | number;
    Content: string;
    Type?: number;
}

/**
 * camelCase variant of {@link QuickSendParams}. Plain JS consumers often pass
 * `{ from, to, content }`; without normalization those would not read `Content`
 * and the nest API would receive no message body (e.g. handshake 1305).
 */
export interface QuickSendParamsCamel {
    from: string;
    to: string | number;
    content: string;
    type?: number;
}

export type QuickSendParamsInput = QuickSendParams | QuickSendParamsCamel;

export interface SendParams {
    From: string;
    To: (string | number)[];
    Content: string;
    Type?: number;
}

/**
 * camelCase variant of {@link SendParams}.
 */
export interface SendParamsCamel {
    from: string;
    to: (string | number)[];
    content: string;
    type?: number;
}

export type SendParamsInput = SendParams | SendParamsCamel;

export interface PersonalizedRecipient {
    To: string | number;
    Values: (string | number)[];
}

export interface PersonalizedSendParams {
    From: string;
    Content: string;
    Destinations: PersonalizedRecipient[];
    Type?: number;
}

/**
 * camelCase variant of {@link PersonalizedSendParams}.
 */
export interface PersonalizedSendParamsCamel {
    from: string;
    content: string;
    destinations: { to: string | number; values: (string | number)[] }[];
    type?: number;
}

export type PersonalizedSendParamsInput =
    | PersonalizedSendParams
    | PersonalizedSendParamsCamel;

/**
 * Maps PascalCase or camelCase quick-send fields to {@link QuickSendParams}.
 * PascalCase wins when both are present.
 */
export function normalizeQuickSendParams(params: QuickSendParamsInput): QuickSendParams {
    const p = params as unknown as Record<string, unknown>;
    const from = p.From ?? p.from;
    const to = p.To ?? p.to;
    const content = p.Content ?? p.content;
    const type = p.Type ?? p.type;

    const contentStr = content == null ? '' : String(content);
    const trimmedBody = contentStr.trim();
    if (trimmedBody === '') {
        throw new Error(
            'quickSend: message body is missing. Pass Content or content with a non-empty string.'
        );
    }

    const fromStr = from == null ? '' : String(from).trim();
    if (fromStr === '') {
        throw new Error(
            'quickSend: sender is missing. Pass From or from with a non-empty string.'
        );
    }

    if (to === null || to === undefined) {
        throw new Error('quickSend: recipient is missing. Pass To or to.');
    }

    const toVal: string | number =
        typeof to === 'number' ? to : String(to).trim();

    let typeNum: number | undefined;
    if (type !== undefined && type !== null) {
        const n = Number(type);
        if (!Number.isNaN(n)) {
            typeNum = n;
        }
    }

    return {
        From: fromStr,
        To: toVal,
        Content: trimmedBody,
        Type: typeNum
    };
}

/**
 * Maps PascalCase or camelCase multi-destination send fields to {@link SendParams}.
 * PascalCase wins when both are present.
 */
export function normalizeSendParams(params: SendParamsInput): SendParams {
    const p = params as unknown as Record<string, unknown>;
    const from = p.From ?? p.from;
    const to = p.To ?? p.to;
    const content = p.Content ?? p.content;
    const type = p.Type ?? p.type;

    const contentStr = content == null ? '' : String(content);
    const trimmedBody = contentStr.trim();
    if (trimmedBody === '') {
        throw new Error(
            'send: message body is missing. Pass Content or content with a non-empty string.'
        );
    }

    const fromStr = from == null ? '' : String(from).trim();
    if (fromStr === '') {
        throw new Error(
            'send: sender is missing. Pass From or from with a non-empty string.'
        );
    }

    if (!Array.isArray(to) || to.length === 0) {
        throw new Error(
            'send: at least one recipient is required. Pass To or to as a non-empty array.'
        );
    }

    const recipients: (string | number)[] = [];
    for (let i = 0; i < to.length; i++) {
        const item = to[i];
        if (item === null || item === undefined) {
            throw new Error(`send: recipient at index ${i} is missing.`);
        }
        if (typeof item === 'number') {
            recipients.push(item);
            continue;
        }
        const trimmed = String(item).trim();
        if (trimmed === '') {
            throw new Error(`send: recipient at index ${i} is empty.`);
        }
        recipients.push(trimmed);
    }

    let typeNum: number | undefined;
    if (type !== undefined && type !== null) {
        const n = Number(type);
        if (!Number.isNaN(n)) {
            typeNum = n;
        }
    }

    return {
        From: fromStr,
        To: recipients,
        Content: trimmedBody,
        Type: typeNum
    };
}

/**
 * Maps PascalCase or camelCase personalised bulk-send fields to
 * {@link PersonalizedSendParams}. PascalCase wins when both are present.
 */
export function normalizePersonalizedSendParams(
    params: PersonalizedSendParamsInput
): PersonalizedSendParams {
    const p = params as unknown as Record<string, unknown>;
    const from = p.From ?? p.from;
    const content = p.Content ?? p.content;
    const destinations = p.Destinations ?? p.destinations;
    const type = p.Type ?? p.type;

    const contentStr = content == null ? '' : String(content);
    const trimmedBody = contentStr.trim();
    if (trimmedBody === '') {
        throw new Error(
            'sendPersonalized: message template is missing. Pass Content or content with a non-empty string.'
        );
    }

    const fromStr = from == null ? '' : String(from).trim();
    if (fromStr === '') {
        throw new Error(
            'sendPersonalized: sender is missing. Pass From or from with a non-empty string.'
        );
    }

    if (!Array.isArray(destinations) || destinations.length === 0) {
        throw new Error(
            'sendPersonalized: at least one destination is required. Pass Destinations or destinations as a non-empty array.'
        );
    }

    const normalizedDestinations: PersonalizedRecipient[] = [];
    for (let i = 0; i < destinations.length; i++) {
        const item = destinations[i] as Record<string, unknown>;
        const to = item.To ?? item.to;
        const values = item.Values ?? item.values;

        if (to === null || to === undefined) {
            throw new Error(
                `sendPersonalized: destination at index ${i} is missing To or to.`
            );
        }

        const toVal: string | number =
            typeof to === 'number' ? to : String(to).trim();
        if (typeof toVal === 'string' && toVal === '') {
            throw new Error(
                `sendPersonalized: destination at index ${i} has an empty To or to.`
            );
        }

        if (!Array.isArray(values)) {
            throw new Error(
                `sendPersonalized: destination at index ${i} requires Values or values as an array.`
            );
        }

        normalizedDestinations.push({
            To: toVal,
            Values: values as (string | number)[]
        });
    }

    let typeNum: number | undefined;
    if (type !== undefined && type !== null) {
        const n = Number(type);
        if (!Number.isNaN(n)) {
            typeNum = n;
        }
    }

    return {
        From: fromStr,
        Content: trimmedBody,
        Destinations: normalizedDestinations,
        Type: typeNum
    };
}

export interface SendResult {
    success: boolean;
    messageId?: string;
    data?: any;
    error?: string;
    /** HTTP status code returned by the gateway (when available). */
    statusCode?: number;
}

export interface IgatewayParam {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    apiKey?: string;
    protocol?: 'http' | 'https';
    /** Set to true to print request/response details to console for debugging. */
    debug?: boolean;
    /**
     * Request timeout in milliseconds. Applies to nest and hubtel gateways.
     * The request is aborted and an ETIMEDOUT error is thrown if the server
     * does not respond within this window. Default: 10 000 ms.
     */
    timeout?: number;
    /**
     * Maximum number of concurrent sockets in the keep-alive pool.
     * Applies to nest and hubtel gateways. Default: 10.
     */
    maxSockets?: number;
    /**
     * How many times to automatically retry on transient socket errors
     * (ECONNRESET, ECONNABORTED, EPIPE, ETIMEDOUT). Applies to nest and hubtel.
     * Default: 1.
     */
    retries?: number;
    /**
     * Enable HTTP keep-alive connection pooling for nest and hubtel gateways.
     * Reuses TCP/TLS connections across requests, eliminating per-call handshake
     * overhead. Stale-socket errors (ECONNABORTED etc.) are recovered via the
     * `retries` setting. Default: true.
     */
    keepAlive?: boolean;
    /** nest only — SMSOnlineGH delivery push webhook */
    deliveryCallback?: NestDeliveryCallbackConfig;
}

export type NestDeliveryCallbackAccept = 'application/json' | 'application/xml';

export interface NestDeliveryCallbackConfig {
    url: string;
    accept?: NestDeliveryCallbackAccept;
}

export interface IgatewaySettings {
    platformId: PlatformId;
    param: IgatewayParam;
}

/** Send surface used by the facade; third-party SDKs may omit `init()`. */
export interface ISmsGatewayDelegate {
    quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult>;
    send(params: SendParams, callback?: Function): Promise<SendResult>;
    sendPersonalized(
        params: PersonalizedSendParams,
        callback?: Function
    ): Promise<SendResult>;
    getBalance?(): Promise<any>;
}

export interface ISmsGateway extends ISmsGatewayDelegate {
    init(): ISmsGateway;
}

export interface NestSmsConfig {
    apiKey: string;
    host?: string;
    protocol?: 'http' | 'https';
    debug?: boolean;
    /** Request timeout in milliseconds. Default: 10 000. */
    timeout?: number;
    /** Max concurrent sockets in the keep-alive pool. Default: 10. */
    maxSockets?: number;
    /** Retry attempts on transient socket errors. Default: 1. */
    retries?: number;
    /** Enable HTTP keep-alive connection pooling. Default: true. */
    keepAlive?: boolean;
    /** SMSOnlineGH delivery push webhook; included in every send when set. */
    deliveryCallback?: NestDeliveryCallbackConfig;
}

export interface NestSendResponse {
    handshake: {
        id: number;
        label: string;
    };
    data?: any;
}

export interface HubtelSmsConfig {
    clientId: string;
    clientSecret: string;
    host?: string;
    protocol?: 'http' | 'https';
    debug?: boolean;
    timeout?: number;
    maxSockets?: number;
    retries?: number;
    keepAlive?: boolean;
}

export interface HubtelSendResponse {
    rate?: number;
    messageId?: string;
    status?: number;
    networkId?: string;
    clientReference?: string | null;
    statusDescription?: string;
}

export interface HubtelBatchMessageResult {
    recipient: string;
    content: string;
    messageId: string;
}

export interface HubtelBatchSendResponse {
    batchId?: string;
    status?: number;
    data?: HubtelBatchMessageResult[];
}

export interface HubtelMessageStatus {
    rate?: number;
    batchId?: string | null;
    messageId?: string;
    content?: string;
    status?: string;
    updateTime?: string;
    time?: string;
    to?: string;
    from?: string;
}

export interface HubtelBatchStatusResponse {
    batchId?: string;
    data?: HubtelMessageStatus[];
}