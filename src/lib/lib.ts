import { 
    smsPlatform, 
    IgatewaySettings, 
    IgatewayParam,
    PlatformId,
    QuickSendParams,
    QuickSendParamsInput,
    QuickSendParamsCamel,
    normalizeQuickSendParams,
    SendResult,
    ISmsGateway
} from './platform';

let smsPlatformInstance: smsPlatform | null = null;

export function init(settings: IgatewaySettings): smsPlatform {
    smsPlatformInstance = new smsPlatform(settings);
    smsPlatformInstance.init();
    return smsPlatformInstance;
}

export function getSmsPlatform(): smsPlatform | null {
    return smsPlatformInstance;
}

export function reset(): void {
    smsPlatformInstance = null;
}

export {
    smsPlatform,
    IgatewaySettings,
    IgatewayParam,
    PlatformId,
    QuickSendParams,
    QuickSendParamsInput,
    QuickSendParamsCamel,
    normalizeQuickSendParams,
    SendResult,
    ISmsGateway
};