import { routeSms } from 'routemobilesms';
import { ISmsGatewayDelegate, QuickSendParams, SendResult } from './types';

export interface RouteSmsGatewayConfig {
    host: string;
    username: string;
    password: string;
    protocol: 'http' | 'https';
    port: number;
    debug?: boolean;
}

function toRouteDestination(to: string | number): number | number[] {
    if (typeof to === 'number') {
        return to;
    }
    const digits = String(to).replace(/\D/g, '');
    const n = Number(digits);
    return Number.isNaN(n) ? 0 : n;
}

/**
 * Adapts routemobilesms to {@link ISmsGatewayDelegate}.
 *
 * NOTE: routemobilesms stores config in module-level state via the constructor,
 * then exposes `routeSms.sendAsync` as a static-style call. The instance is
 * intentionally discarded after construction.
 */
export class RouteSmsGateway implements ISmsGatewayDelegate {
    private _debug: boolean;

    constructor(config: RouteSmsGatewayConfig) {
        this._debug = config.debug || false;
        // routemobilesms configures itself through its constructor and exposes
        // sendAsync as a static method — the returned instance is not needed.
        new routeSms({
            host: config.host,
            username: config.username,
            password: config.password,
            protocol: config.protocol,
            port: config.port
        });
    }

    private log(...args: unknown[]): void {
        if (this._debug) {
            console.log('[unismsgateway:route]', ...args);
        }
    }

    async quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult> {
        this.log('quickSend params:', JSON.stringify(params));

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

        let result: SendResult;

        try {
            const raw = await routeSms.sendAsync(sendParams);

            this.log('quickSend raw response:', JSON.stringify(raw));

            if (raw === undefined || raw === null) {
                result = {
                    success: false,
                    error: 'No response received from Route SMS gateway',
                    data: null
                };
            } else if (Array.isArray(raw) && raw.length > 0) {
                const first = raw[0] as {
                    status?: string;
                    id?: string;
                    code?: string;
                    message?: string;
                };
                const ok = first.status === 'successful';
                result = {
                    success: ok,
                    messageId: first.id,
                    data: raw,
                    error: ok
                        ? undefined
                        : `Route SMS Error [${first.code ?? 'unknown'}]: ${first.message ?? 'Send failed'}`
                };
            } else {
                result = {
                    success: false,
                    error: 'Unexpected response format from Route SMS gateway',
                    data: raw
                };
            }
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);

            this.log('quickSend error:', errorMessage);

            result = {
                success: false,
                error: errorMessage,
                data: null
            };
        }

        this.log('quickSend result:', JSON.stringify(result));

        if (callback) {
            callback(result);
        }

        return result;
    }
}
