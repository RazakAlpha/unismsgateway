import { IgatewaySettings, IgatewayParam, ISmsGateway, ISmsGatewayDelegate, QuickSendParamsInput, SendResult } from './types';
export * from './types';
export declare class smsPlatform implements ISmsGateway {
    private _settings;
    private _gateway;
    constructor(settings: IgatewaySettings);
    private validateSettings;
    private createGateway;
    init(): ISmsGateway;
    quickSend(param: QuickSendParamsInput, callback?: Function): Promise<SendResult>;
    getGateway(): ISmsGatewayDelegate;
}
export { IgatewaySettings, IgatewayParam };
