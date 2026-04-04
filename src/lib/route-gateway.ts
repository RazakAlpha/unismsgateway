import { routeSms } from 'routemobilesms';
import { ISmsGatewayDelegate, QuickSendParams, SendResult } from './types';

export interface RouteSmsGatewayConfig {
    host: string;
    username: string;
    password: string;
    protocol: 'http' | 'https';
    port: number;
}

/**
 * Adapts routemobilesms static `sendAsync` API to {@link ISmsGatewayDelegate}.
 */
function toRouteDestination(to: string | number): number | number[] {
    if (typeof to === 'number') {
        return to;
    }
    const digits = String(to).replace(/\D/g, '');
    const n = Number(digits);
    return Number.isNaN(n) ? 0 : n;
}

export class RouteSmsGateway implements ISmsGatewayDelegate {
    constructor(config: RouteSmsGatewayConfig) {
        new routeSms({
            host: config.host,
            username: config.username,
            password: config.password,
            protocol: config.protocol,
            port: config.port
        });
    }

    async quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult> {
        const sendParams: {
            From: string;
            To: number | number[];
            Content: string;
            config?: { type: number; dlr: number };
        } = {
            From: params.From,
            To: toRouteDestination(params.To),
            Content: params.Content
        };

        if (params.Type !== undefined) {
            sendParams.config = { type: params.Type, dlr: 0 };
        }

        const raw = await routeSms.sendAsync(sendParams);

        let result: SendResult;

        if (raw === undefined || raw === null) {
            result = { success: false, error: 'No response from route SMS gateway' };
        } else if (Array.isArray(raw) && raw.length > 0) {
            const first = raw[0] as { status?: string; id?: string; code?: string; message?: string };
            const ok = first.status === 'successful';
            result = {
                success: ok,
                messageId: first.id,
                data: raw,
                error: ok ? undefined : (first.message || first.code || 'Send failed')
            };
        } else {
            result = { success: false, error: 'Unexpected response from route SMS gateway', data: raw };
        }

        if (callback) {
            callback(result);
        }

        return result;
    }
}
