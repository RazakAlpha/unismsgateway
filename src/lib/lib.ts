import {smsPlatform, IgatewaySettings, IgatewayParam} from './platform'
let smsplatform: smsPlatform

export function init(settings: IgatewaySettings) {

    const smsPlatform_ = new smsPlatform(settings);
    smsplatform = smsPlatform_;
    return smsPlatform_.init();
}

export function getSmsPlatform() {
    return smsplatform
}

export function quickSend(param: {From: string, To: number, Content: string, Type?: number}, callback?: Function) {
    return smsplatform.quickSend(param, callback)
}
