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
