"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsPlatform = void 0;
const nest_gateway_1 = require("./nest-gateway");
const hubtel_gateway_1 = require("./hubtel-gateway");
const route_gateway_1 = require("./route-gateway");
const types_1 = require("./types");
__exportStar(require("./types"), exports);
const GATEWAY_CONFIGS = {
    route: { requiresUsernamePassword: true },
    hubtel: { requiresClientCredentials: true },
    nest: { requiresApiKey: true }
};
class smsPlatform {
    constructor(settings) {
        this.validateSettings(settings);
        this._settings = settings;
        this._gateway = this.createGateway();
    }
    validateSettings(settings) {
        const validPlatforms = ['route', 'hubtel', 'nest'];
        if (!validPlatforms.includes(settings.platformId)) {
            throw new Error(`Invalid platform ID. Supported platforms: ${validPlatforms.join(', ')}`);
        }
        const config = GATEWAY_CONFIGS[settings.platformId];
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
    validateNestDeliveryCallback(deliveryCallback) {
        const url = deliveryCallback.url == null ? '' : String(deliveryCallback.url).trim();
        if (url === '') {
            throw new Error("Platform 'nest': deliveryCallback.url must be a non-empty string");
        }
        const accept = deliveryCallback.accept;
        if (accept !== undefined &&
            accept !== 'application/json' &&
            accept !== 'application/xml') {
            throw new Error("Platform 'nest': deliveryCallback.accept must be 'application/json' or 'application/xml'");
        }
    }
    createGateway() {
        const { platformId, param } = this._settings;
        switch (platformId) {
            case 'route':
                return new route_gateway_1.RouteSmsGateway({
                    host: param.host || 'rslr.connectbind.com',
                    username: param.username,
                    password: param.password,
                    protocol: param.protocol || 'http',
                    port: param.port || 8080,
                    debug: param.debug
                });
            case 'hubtel':
                return new hubtel_gateway_1.HubtelSmsGateway({
                    clientId: param.clientId,
                    clientSecret: param.clientSecret,
                    host: param.host,
                    protocol: param.protocol,
                    debug: param.debug,
                    timeout: param.timeout,
                    maxSockets: param.maxSockets,
                    retries: param.retries,
                    keepAlive: param.keepAlive
                });
            case 'nest':
                return new nest_gateway_1.NestSmsGateway({
                    apiKey: param.apiKey,
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
    init() {
        return this;
    }
    quickSend(param, callback) {
        if (!this._gateway) {
            throw new Error('Gateway not initialized. Call init() first.');
        }
        const normalized = (0, types_1.normalizeQuickSendParams)(param);
        return this._gateway.quickSend(normalized, callback);
    }
    send(param, callback) {
        if (!this._gateway) {
            throw new Error('Gateway not initialized. Call init() first.');
        }
        const normalized = (0, types_1.normalizeSendParams)(param);
        return this._gateway.send(normalized, callback);
    }
    sendPersonalized(param, callback) {
        if (!this._gateway) {
            throw new Error('Gateway not initialized. Call init() first.');
        }
        const normalized = (0, types_1.normalizePersonalizedSendParams)(param);
        return this._gateway.sendPersonalized(normalized, callback);
    }
    getGateway() {
        return this._gateway;
    }
}
exports.smsPlatform = smsPlatform;
