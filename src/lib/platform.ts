import { HubtelSms } from 'hubtel-sms-extended';
import { routeSms } from 'routemobilesms';
import { NestSmsGateway } from './nest-gateway';
import {
    IgatewaySettings,
    IgatewayParam,
    PlatformId,
    ISmsGateway,
    QuickSendParams,
    SendResult
} from './types';

export * from './types';

const GATEWAY_CONFIGS: Record<PlatformId, { requiresApiKey?: boolean; requiresClientCredentials?: boolean; requiresUsernamePassword?: boolean }> = {
    route: { requiresUsernamePassword: true },
    hubtel: { requiresClientCredentials: true },
    nest: { requiresApiKey: true }
};

export class smsPlatform implements ISmsGateway {
    private _settings: IgatewaySettings;
    private _gateway: ISmsGateway;

    constructor(settings: IgatewaySettings) {
        this.validateSettings(settings);
        this._settings = settings;
        this._gateway = this.createGateway();
    }

    private validateSettings(settings: IgatewaySettings): void {
        const validPlatforms: PlatformId[] = ['route', 'hubtel', 'nest'];
        if (!validPlatforms.includes(settings.platformId as PlatformId)) {
            throw new Error(`Invalid platform ID. Supported platforms: ${validPlatforms.join(', ')}`);
        }

        const config = GATEWAY_CONFIGS[settings.platformId as PlatformId];
        const param = settings.param;

        if (config.requiresApiKey && !param.apiKey) {
            throw new Error(`Platform '${settings.platformId}' requires 'apiKey' in param`);
        }

        if (config.requiresClientCredentials && (!param.clientId || !param.clientSecret)) {
            throw new Error(`Platform '${settings.platformId}' requires 'clientId' and 'clientSecret' in param`);
        }

        if (config.requiresUsernamePassword && (!param.username || !param.password)) {
            throw new Error(`Platform '${settings.platformId}' requires 'username' and 'password' in param`);
        }
    }

    private createGateway(): ISmsGateway {
        const { platformId, param } = this._settings;

        switch (platformId) {
            case 'route':
                return new routeSms({
                    host: param.host || 'rslr.connectbind.com',
                    username: param.username!,
                    password: param.password!,
                    protocol: param.protocol || 'http',
                    port: param.port || 8080
                });

            case 'hubtel':
                return new HubtelSms({
                    clientId: param.clientId!,
                    clientSecret: param.clientSecret!
                });

            case 'nest':
                return new NestSmsGateway({
                    apiKey: param.apiKey!,
                    host: param.host,
                    protocol: param.protocol
                });

            default:
                throw new Error(`Unsupported platform: ${platformId}`);
        }
    }

    init(): ISmsGateway {
        return this;
    }

    quickSend(param: QuickSendParams, callback?: Function): Promise<SendResult> {
        if (!this._gateway) {
            throw new Error('Gateway not initialized. Call init() first.');
        }
        return this._gateway.quickSend(param, callback);
    }

    getGateway(): ISmsGateway {
        return this._gateway;
    }
}

export { IgatewaySettings, IgatewayParam };