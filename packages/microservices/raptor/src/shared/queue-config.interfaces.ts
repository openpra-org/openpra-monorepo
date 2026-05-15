export interface QueueConfig {
  name: string;
  exchange: ExchangeConfig;
  durable: boolean;
  messageTtl: number;
  maxLength: number;
  prefetch?: number;
  deadLetter: DeadLetterConfig;
}
export interface ExchangeConfig {
  name: string;
  type: string;
  durable: boolean;
  bindingKey: string;
  routingKey: string;
}
export interface DeadLetterConfig {
  name: string;
  exchange: ExchangeConfig;
  durable: boolean;
}
