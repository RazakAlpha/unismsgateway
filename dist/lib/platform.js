"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsPlatform = void 0;
// const routesms = require('routesms')
const hubtel_sms_extended_1 = require("hubtel-sms-extended");
const routeMobileSms_1 = require("routeMobileSms");
// routeSms.engine
class smsPlatform {
    constructor(settings) {
        this._settings = settings;
    }
    init() {
        if (this._settings.platformId === 'route') {
            // this._sms = routesms;
            new routeMobileSms_1.routeSms({ host: 'rslr.connectbind.com', username: 'nety-dntc', password: '@Alpha12', protocol: 'http', port: 8080 });
            this._sms = routeMobileSms_1.routeSms;
            // console.log(this._sms, this._sms.connection)  
            // this._sms.connection = this._settings.param;
        }
        else if (this._settings.platformId === 'hubtel') {
            // console.log(this._settings)
            this._sms = new hubtel_sms_extended_1.HubtelSms({ clientId: this._settings.param.clientId, clientSecret: this._settings.param.clientSecret });
        }
        // console.log({sms: this._sms})
        return this;
    }
    quickSend(param, callback) {
        if (this._settings.platformId === 'route') {
            return this._sms.sendAsync({ From: param.From, To: param.To, Content: param.Content });
            // return this._sms.send(callback);
        }
        else if (this._settings.platformId === 'hubtel') {
            return this._sms.quickSend(param);
        }
        else {
            throw new Error("Platform ID not recognised");
        }
    }
}
exports.smsPlatform = smsPlatform;
