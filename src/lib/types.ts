export type PlatformId = 'route' | 'hubtel' | 'nest';

export interface QuickSendParams {
    From: string;
    To: string | number;
    Content: string;
    Type?: number;
}

export interface SendResult {
    success: boolean;
    messageId?: string;
    data?: any;
    error?: string;
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
}

export interface NestSendResponse {
    handshake: {
        id: number;
        label: string;
    };
    data?: any;
}