import { HubtelSms } from 'hubtel-sms-extended';
import { ISmsGatewayDelegate, QuickSendParams, SendResult } from './types';

export interface HubtelSmsGatewayConfig {
    clientId: string;
    clientSecret: string;
}

/**
 * Wraps hubtel-sms-extended and maps API responses to {@link SendResult}.
 */
export class HubtelSmsGateway implements ISmsGatewayDelegate {
    private _client: HubtelSms;

    constructor(config: HubtelSmsGatewayConfig) {
        this._client = new HubtelSms({
            clientId: config.clientId,
            clientSecret: config.clientSecret
        });
    }

    async quickSend(params: QuickSendParams, callback?: Function): Promise<SendResult> {
        try {
            const raw = await this._client.quickSend({
                From: params.From,
                To: String(params.To),
                Content: params.Content
            });

            const ok = Number(raw.Status) === 0;
            const result: SendResult = {
                success: ok,
                messageId: String(raw.MessageId),
                data: raw,
                error: ok ? undefined : `Hubtel Status=${raw.Status}`
            };

            if (callback) {
                callback(result);
            }

            return result;
        } catch (error) {
            const result: SendResult = {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };

            if (callback) {
                callback(result);
            }

            return result;
        }
    }
}
