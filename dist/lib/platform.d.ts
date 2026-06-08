import { IgatewaySettings, IgatewayParam, ISmsGateway, ISmsGatewayDelegate, QuickSendParamsInput, SendParamsInput, SendResult, PersonalizedSendParamsInput } from './types';
export * from './types';
export declare class smsPlatform implements ISmsGateway {
    private _settings;
    private _gateway;
    constructor(settings: IgatewaySettings);
    private validateSettings;
    private validateNestDeliveryCallback;
    private createGateway;
    init(): ISmsGateway;
    quickSend(param: QuickSendParamsInput, callback?: Function): Promise<SendResult>;
    send(param: SendParamsInput, callback?: Function): Promise<SendResult>;
    sendPersonalized(param: PersonalizedSendParamsInput, callback?: Function): Promise<SendResult>;
    getGateway(): ISmsGatewayDelegate;
}
export { IgatewaySettings, IgatewayParam };
