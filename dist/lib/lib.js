"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSmsPlatform = exports.init = void 0;
const platform_1 = require("./platform");
let smsplatform;
function init(settings) {
    const smsPlatform_ = new platform_1.smsPlatform(settings);
    smsplatform = smsPlatform_;
    return smsPlatform_.init();
}
exports.init = init;
function getSmsPlatform() {
    return smsplatform;
}
exports.getSmsPlatform = getSmsPlatform;
