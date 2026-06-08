"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePersonalizedSendParams = exports.normalizeSendParams = exports.normalizeQuickSendParams = exports.smsPlatform = exports.reset = exports.getSmsPlatform = exports.init = void 0;
const platform_1 = require("./platform");
Object.defineProperty(exports, "smsPlatform", { enumerable: true, get: function () { return platform_1.smsPlatform; } });
Object.defineProperty(exports, "normalizeQuickSendParams", { enumerable: true, get: function () { return platform_1.normalizeQuickSendParams; } });
Object.defineProperty(exports, "normalizeSendParams", { enumerable: true, get: function () { return platform_1.normalizeSendParams; } });
Object.defineProperty(exports, "normalizePersonalizedSendParams", { enumerable: true, get: function () { return platform_1.normalizePersonalizedSendParams; } });
let smsPlatformInstance = null;
function init(settings) {
    smsPlatformInstance = new platform_1.smsPlatform(settings);
    smsPlatformInstance.init();
    return smsPlatformInstance;
}
exports.init = init;
function getSmsPlatform() {
    return smsPlatformInstance;
}
exports.getSmsPlatform = getSmsPlatform;
function reset() {
    smsPlatformInstance = null;
}
exports.reset = reset;
