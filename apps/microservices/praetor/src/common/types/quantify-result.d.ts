import type { ScramResult } from './scram-result';
export interface QuantifyModelFileResult {
    type: 'file';
    path: string;
    size?: number | bigint;
    format?: 'json' | string;
}
export type QuantifyModelResult = QuantifyModelFileResult | ScramResult;
