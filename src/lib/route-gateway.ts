import { routeSms } from 'routemobilesms';
import { ISmsGatewayDelegate, QuickSendParams, SendParams, PersonalizedSendParams, SendResult } from './types';

export interface RouteSmsGatewayConfig {
    host: string;
    username: string;
    password: string;
    protocol: 'http' | 'https';
    port: number;
    debug?: boolean;
}

function toRouteDestination(to: string | number): number {
    if (typeof to === 'number') {
        return to;
    }
    const digits = String(to).replace(/\D/g, '');
    const n = Number(digits);
    return Number.isNaN(n) ? 0 : n;
}

function toRouteDestinations(to: (string | number)[]): number[] {
    return to.map(toRouteDestination);
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
        return this._send(
            [toRouteDestination(params.To)],
            params.From,
            params.Content,
            params.Type,
            callback,
            'quickSend',
            params
        );
    }

    async send(params: SendParams, callback?: Function): Promise<SendResult> {
        return this._send(
            toRouteDestinations(params.To),
            params.From,
            params.Content,
            params.Type,
            callback,
            'send',
            params
        );
    }

    private async _send(
        destinations: number[],
        from: string,
        content: string,
        type: number | undefined,
        callback: Function | undefined,
        logLabel: 'quickSend' | 'send',
        logParams: QuickSendParams | SendParams
    ): Promise<SendResult> {
        this.log(`${logLabel} params:`, JSON.stringify(logParams));

        const sendParams: {
            From: string;
            To: number | number[];
            Content: string;
            config?: { type: number; dlr: number };
        } = {
            From: from,
            To: destinations.length === 1 ? destinations[0] : destinations,
            Content: content
        };

        if (type !== undefined) {
            sendParams.config = { type, dlr: 0 };
        }

        let result: SendResult;

        try {
            const raw = await routeSms.sendAsync(sendParams);

            this.log(`${logLabel} raw response:`, JSON.stringify(raw));

            if (raw === undefined || raw === null) {
                result = {
                    success: false,
                    error: 'No response received from Route SMS gateway',
                    data: null
                };
            } else if (Array.isArray(raw) && raw.length > 0) {
                const allOk = raw.every(item => item.status === 'successful');
                const first = raw[0] as {
                    status?: string;
                    id?: string;
                    code?: string;
                    message?: string;
                };
                const failed = raw.filter(item => item.status !== 'successful');
                result = {
                    success: allOk,
                    messageId: first.id,
                    data: raw,
                    error: allOk
                        ? undefined
                        : failed.length === raw.length
                            ? `Route SMS Error [${first.code ?? 'unknown'}]: ${first.message ?? 'Send failed'}`
                            : `Route SMS: ${failed.length} of ${raw.length} destinations failed`
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

            this.log(`${logLabel} error:`, errorMessage);

            result = {
                success: false,
                error: errorMessage,
                data: null
            };
        }

        this.log(`${logLabel} result:`, JSON.stringify(result));

        if (callback) {
            callback(result);
        }

        return result;
    }

    async sendPersonalized(
        _params: PersonalizedSendParams,
        _callback?: Function
    ): Promise<SendResult> {
        throw new Error(
            'Route Mobile does not support sendPersonalized(). Use send() with the same content for all recipients.'
        );
    }
}
