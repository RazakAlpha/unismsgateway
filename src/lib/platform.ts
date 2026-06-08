import { NestSmsGateway } from './nest-gateway';
import { HubtelSmsGateway } from './hubtel-gateway';
import { RouteSmsGateway } from './route-gateway';
import {
    IgatewaySettings,
    IgatewayParam,
    PlatformId,
    ISmsGateway,
    ISmsGatewayDelegate,
    QuickSendParams,
    QuickSendParamsInput,
    SendParams,
    SendParamsInput,
    SendResult,
    PersonalizedSendParams,
    PersonalizedSendParamsInput,
    normalizePersonalizedSendParams,
    normalizeQuickSendParams,
    normalizeSendParams
} from './types';

export * from './types';

const GATEWAY_CONFIGS: Record<PlatformId, { requiresApiKey?: boolean; requiresClientCredentials?: boolean; requiresUsernamePassword?: boolean }> = {
    route: { requiresUsernamePassword: true },
    hubtel: { requiresClientCredentials: true },
    nest: { requiresApiKey: true }
};

export class smsPlatform implements ISmsGateway {
    private _settings: IgatewaySettings;
    private _gateway: ISmsGatewayDelegate;

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

        if (settings.platformId === 'nest' && param.deliveryCallback) {
            this.validateNestDeliveryCallback(param.deliveryCallback);
        }
    }

    private validateNestDeliveryCallback(
        deliveryCallback: NonNullable<IgatewayParam['deliveryCallback']>
    ): void {
        const url = deliveryCallback.url == null ? '' : String(deliveryCallback.url).trim();
        if (url === '') {
            throw new Error(
                "Platform 'nest': deliveryCallback.url must be a non-empty string"
            );
        }

        const accept = deliveryCallback.accept;
        if (
            accept !== undefined &&
            accept !== 'application/json' &&
            accept !== 'application/xml'
        ) {
            throw new Error(
                "Platform 'nest': deliveryCallback.accept must be 'application/json' or 'application/xml'"
            );
        }
    }

    private createGateway(): ISmsGatewayDelegate {
        const { platformId, param } = this._settings;

        switch (platformId) {
            case 'route':
                return new RouteSmsGateway({
                    host: param.host || 'rslr.connectbind.com',
                    username: param.username!,
                    password: param.password!,
                    protocol: param.protocol || 'http',
                    port: param.port || 8080,
                    debug: param.debug
                });

            case 'hubtel':
                return new HubtelSmsGateway({
                    clientId: param.clientId!,
                    clientSecret: param.clientSecret!,
                    host: param.host,
                    protocol: param.protocol,
                    debug: param.debug,
                    timeout: param.timeout,
                    maxSockets: param.maxSockets,
                    retries: param.retries,
                    keepAlive: param.keepAlive
                });

            case 'nest':
                return new NestSmsGateway({
                    apiKey: param.apiKey!,
                    host: param.host,
                    protocol: param.protocol,
                    debug: param.debug,
                    timeout: param.timeout,
                    maxSockets: param.maxSockets,
                    retries: param.retries,
                    keepAlive: param.keepAlive,
                    deliveryCallback: param.deliveryCallback
                        ? {
                            url: param.deliveryCallback.url.trim(),
                            accept: param.deliveryCallback.accept
                        }
                        : undefined
                });

            default:
                throw new Error(`Unsupported platform: ${platformId}`);
        }
    }

    init(): ISmsGateway {
        return this;
    }

    quickSend(param: QuickSendParamsInput, callback?: Function): Promise<SendResult> {
        if (!this._gateway) {
            throw new Error('Gateway not initialized. Call init() first.');
        }
        const normalized = normalizeQuickSendParams(param);
        return this._gateway.quickSend(normalized, callback);
    }

    send(param: SendParamsInput, callback?: Function): Promise<SendResult> {
        if (!this._gateway) {
            throw new Error('Gateway not initialized. Call init() first.');
        }
        const normalized = normalizeSendParams(param);
        return this._gateway.send(normalized, callback);
    }

    sendPersonalized(
        param: PersonalizedSendParamsInput,
        callback?: Function
    ): Promise<SendResult> {
        if (!this._gateway) {
            throw new Error('Gateway not initialized. Call init() first.');
        }
        const normalized = normalizePersonalizedSendParams(param);
        return this._gateway.sendPersonalized(normalized, callback);
    }

    getGateway(): ISmsGatewayDelegate {
        return this._gateway;
    }
}

export { IgatewaySettings, IgatewayParam };