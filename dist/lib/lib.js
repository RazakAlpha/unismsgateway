"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsPlatform = exports.reset = exports.getSmsPlatform = exports.init = void 0;
const platform_1 = require("./platform");
Object.defineProperty(exports, "smsPlatform", { enumerable: true, get: function () { return platform_1.smsPlatform; } });
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
