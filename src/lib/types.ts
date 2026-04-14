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
}

export interface IgatewaySettings {
    platformId: PlatformId;
    param: IgatewayParam;
}

/** Send surface used by the facade; third-party SDKs may omit `init()`. */
export interface ISmsGatewayDelegate {
    quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult>;
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
}

export interface NestSendResponse {
    handshake: {
        id: number;
        label: string;
    };
    data?: any;
}