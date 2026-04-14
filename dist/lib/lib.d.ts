import { smsPlatform, IgatewaySettings, IgatewayParam, PlatformId, QuickSendParams, QuickSendParamsInput, QuickSendParamsCamel, normalizeQuickSendParams, SendResult, ISmsGateway } from './platform';
export declare function init(settings: IgatewaySettings): smsPlatform;
export declare function getSmsPlatform(): smsPlatform | null;
export declare function reset(): void;
export { smsPlatform, IgatewaySettings, IgatewayParam, PlatformId, QuickSendParams, QuickSendParamsInput, QuickSendParamsCamel, normalizeQuickSendParams, SendResult, ISmsGateway };
