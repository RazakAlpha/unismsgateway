// const routesms = require('routesms')
import { HubtelSms } from 'hubtel-sms-extended';
import {routeSms} from 'routemobilesms'
import * as nestsms from 'nestsms'
import { throws } from 'assert';

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
            this._sms = new routeSms({
                host:this._settings.param.host, 
                username: this._settings.param.username, 
                password: this._settings.param.password, 
                protocol: 'http', 
                port: 8080});
            // this._sms = routeSms;
            // console.log(this._sms, this._sms.connection)  
            // this._sms.connection = this._settings.param;
        }else if(this._settings.platformId === 'hubtel'){
            // console.log(this._settings)
            this._sms = new HubtelSms({clientId: this._settings.param.clientId, clientSecret: this._settings.param.clientSecret})
        
        }else if(this._settings.platformId === 'nest'){
            // console.log(this._settings)
            this._sms = nestsms.init(
                {
                    host: this._settings.param.host,
                    version: this._settings.param.version,
                    authModel: this._settings.param.authModel
                }
                )
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
        
        }else if(this._settings.platformId === 'nest') {
            return this._sms.quickSend(param);
        }else {
            throw new Error("Platform ID not recognised");
            
        }
    }
    
    sendPersonalized(body: IQuickSendPersonalized) {
        if(this._settings.platformId !== 'nest'){
            throw new Error("Specified platform does not support personalisation");
        } 
        
        return this._sms.sendPersonalized(body)




    }

}



export interface IgatewaySettings{
    platformId: string;
    param: IgatewayParam
}

export interface IgatewayParam{
    host: string;
    port?: number;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    version: string;
    authModel: AuthModel;


}

export interface AuthModel {
    type: AuthTypes;
    username?: string;
    password?: string;
    key?: string;
}

export enum AuthTypes {
    factor = "factor",
    key ="key"
}


export interface IQuickSendPersonalized {
    From: string;
    Content: string;
    Type: MessageTypes
    To: IPersonalizedDestination | IPersonalizedDestination[]
}

export interface IPersonalizedDestination {
    to: number;
    values: (string|number)[]

}

export enum MessageTypes{
    Text,
    flash
}