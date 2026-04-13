import { HubtelSms } from 'hubtel-sms-extended';
import { ISmsGatewayDelegate, QuickSendParams, SendResult } from './types';

export interface HubtelSmsGatewayConfig {
    clientId: string;
    clientSecret: string;
    debug?: boolean;
}

/**
 * Wraps hubtel-sms-extended and maps API responses to {@link SendResult}.
 */
export class HubtelSmsGateway implements ISmsGatewayDelegate {
    private _client: HubtelSms;
    private _debug: boolean;

    constructor(config: HubtelSmsGatewayConfig) {
        this._debug = config.debug || false;
        this._client = new HubtelSms({
            clientId: config.clientId,
            clientSecret: config.clientSecret
        });
    }

    private log(...args: unknown[]): void {
        if (this._debug) {
            console.log('[unismsgateway:hubtel]', ...args);
        }
    }

    async quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult> {
        this.log('quickSend params:', JSON.stringify(params));

        let result: SendResult;

        try {
            const raw = await this._client.quickSend({
                From: params.From,
                To: String(params.To),
                Content: params.Content
            });

            this.log('quickSend raw response:', JSON.stringify(raw));

            const ok = Number(raw?.Status) === 0;
            result = {
                success: ok,
                messageId: raw?.MessageId != null ? String(raw.MessageId) : undefined,
                data: raw,
                error: ok
                    ? undefined
                    : `Hubtel API Error: Status=${raw?.Status}, NetworkId=${raw?.NetworkId ?? 'n/a'}`
            };
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);

            this.log('quickSend error:', errorMessage);

            result = {
                success: false,
                error: errorMessage,
                data: error instanceof Error && (error as any).response
                    ? (error as any).response
                    : null
            };
        }

        this.log('quickSend result:', JSON.stringify(result));

        if (callback) {
            callback(result);
        }

        return result;
    }
}
