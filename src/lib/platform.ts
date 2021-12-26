// const routesms = require('routesms')
import { HubtelSms } from 'hubtel-sms-extended';
import {routeSms} from 'routemobilesms'

// routeSms.engine


export class smsPlatform{
    _settings: IgatewaySettings
    _sms: any;

    constructor(settings: IgatewaySettings){
        this._settings = settings;
    }

    init(){
        if (this._settings.platformId === 'route'){
            // this._sms = routesms;
            this._sms = new routeSms({host:'rslr.connectbind.com', username:'nety-dntc', password: '@Alpha12', protocol: 'http', port: 8080});
            // this._sms = routeSms;
            // console.log(this._sms, this._sms.connection)  
            // this._sms.connection = this._settings.param;
        }else if(this._settings.platformId === 'hubtel'){
            // console.log(this._settings)
            this._sms = new HubtelSms({clientId: this._settings.param.clientId, clientSecret: this._settings.param.clientSecret})
        }

        // console.log({sms: this._sms})
   
        return this;
    }


    
    quickSend(param: {From: string, To: number, Content: string, Type?: number}, callback?: Function) {
        if(this._settings.platformId === 'route'){
            return this._sms.sendAsync({From: param.From, To: param.To, Content: param.Content})
            // return this._sms.send(callback);
        } else if(this._settings.platformId === 'hubtel') {
            return this._sms.quickSend(param);
        }else {
            throw new Error("Platform ID not recognised");
            
        }
    }

}



export interface IgatewaySettings{
    platformId: string;
    param: IgatewayParam
}

export interface IgatewayParam{
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;

}