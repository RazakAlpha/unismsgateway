import { IgatewaySettings, IgatewayParam, ISmsGateway, QuickSendParams, SendResult } from './types';
export * from './types';
export declare class smsPlatform implements ISmsGateway {
    private _settings;
    private _gateway;
    constructor(settings: IgatewaySettings);
    private validateSettings;
    private createGateway;
    init(): ISmsGateway;
    quickSend(param: QuickSendParams, callback?: Function): Promise<SendResult>;
    getGateway(): ISmsGateway;
}
export { IgatewaySettings, IgatewayParam };
