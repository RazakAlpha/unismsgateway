export declare class smsPlatform {
    _settings: IgatewaySettings;
    _sms: any;
    constructor(settings: IgatewaySettings);
    init(): this;
    quickSend(param: {
        From: string;
        To: number;
        Content: string;
        Type?: number;
    }, callback?: Function): any;
}
export interface IgatewaySettings {
    platformId: string;
    param: IgatewayParam;
}
export interface IgatewayParam {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
}
