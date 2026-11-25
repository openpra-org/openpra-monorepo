import { EventEmitter } from "node:events";

interface FakeMessageOptions {
  persistent?: boolean;
  messageId?: string;
  contentType?: string;
}

interface FakeDelivery {
  content: Buffer;
  fields: { deliveryTag: number; redelivered: boolean; exchange: string; routingKey: string; consumerTag: string };
  properties: FakeMessageOptions;
}

interface StoredMessage {
  content: Buffer;
  exchange: string;
  routingKey: string;
  properties: FakeMessageOptions;
  redelivered: boolean;
}

interface FakeQueueOptions {
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  messageTtl?: number;
  maxLength?: number;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
}

interface FakeConsumer {
  tag: string;
  channel: FakeChannel;
  deliver: (message: FakeDelivery | null) => void;
  noAck: boolean;
}

interface FakeQueue {
  name: string;
  options: FakeQueueOptions;
  owner: FakeChannel | null;
  messages: StoredMessage[];
  consumers: FakeConsumer[];
  nextConsumer: number;
}

interface FakeExchange {
  type: string;
  durable: boolean;
  bindings: { queue: string; key: string }[];
}

interface FakePublication {
  exchange: string;
  routingKey: string;
  content: string;
  properties: FakeMessageOptions;
}

class FakeBroker {
  readonly exchanges = new Map<string, FakeExchange>();
  readonly queues = new Map<string, FakeQueue>();
  readonly publications: FakePublication[] = [];
  readonly channels: FakeChannel[] = [];
  acceptsPublications = true;
  private generated = 0;
  private consumerTags = 0;

  nextQueueName(): string {
    this.generated += 1;
    return `amq.gen-${this.generated}`;
  }

  nextConsumerTag(): string {
    this.consumerTags += 1;
    return `ctag-${this.consumerTags}`;
  }

  queue(name: string): FakeQueue {
    const found = this.queues.get(name);
    if (found === undefined) throw new Error(`NOT_FOUND - no queue '${name}'`);
    return found;
  }

  readyCount(name: string): number {
    return this.queues.get(name)?.messages.length ?? 0;
  }

  consumerCount(name: string): number {
    return this.queues.get(name)?.consumers.length ?? 0;
  }

  unackedCount(): number {
    return this.channels.reduce((total, channel) => total + channel.unacked.size, 0);
  }

  route(exchange: string, routingKey: string, message: StoredMessage): void {
    if (exchange === "") {
      this.enqueue(routingKey, message);
      return;
    }
    const target = this.exchanges.get(exchange);
    if (target === undefined) throw new Error(`NOT_FOUND - no exchange '${exchange}'`);
    for (const binding of target.bindings) {
      if (target.type === "fanout" || binding.key === routingKey) {
        this.enqueue(binding.queue, { ...message });
      }
    }
  }

  private enqueue(name: string, message: StoredMessage): void {
    const queue = this.queues.get(name);
    if (queue === undefined) return;
    queue.messages.push(message);
    const limit = queue.options.maxLength;
    if (limit !== undefined && queue.messages.length > limit) queue.messages.shift();
    this.dispatch(queue);
  }

  requeue(name: string, message: StoredMessage): void {
    const queue = this.queues.get(name);
    if (queue === undefined) return;
    queue.messages.unshift({ ...message, redelivered: true });
    this.dispatch(queue);
  }

  dispatchAll(): void {
    for (const queue of this.queues.values()) this.dispatch(queue);
  }

  dispatch(queue: FakeQueue): void {
    while (queue.messages.length > 0 && queue.consumers.length > 0) {
      let chosen: FakeConsumer | undefined;
      for (let offset = 0; offset < queue.consumers.length; offset += 1) {
        const candidate = queue.consumers[(queue.nextConsumer + offset) % queue.consumers.length];
        if (candidate !== undefined && (candidate.noAck || candidate.channel.hasCapacity())) {
          chosen = candidate;
          queue.nextConsumer = (queue.nextConsumer + offset + 1) % queue.consumers.length;
          break;
        }
      }
      if (chosen === undefined) return;
      const message = queue.messages.shift();
      if (message === undefined) return;
      const consumer = chosen;
      const delivery: FakeDelivery = {
        content: message.content,
        fields: {
          deliveryTag: consumer.channel.nextDeliveryTag(),
          redelivered: message.redelivered,
          exchange: message.exchange,
          routingKey: message.routingKey,
          consumerTag: consumer.tag,
        },
        properties: message.properties,
      };
      if (!consumer.noAck) consumer.channel.unacked.set(delivery.fields.deliveryTag, { queue: queue.name, message });
      setImmediate(() => consumer.deliver(delivery));
    }
  }

  dropChannel(channel: FakeChannel): void {
    channel.lose();
  }
}

class FakeChannel extends EventEmitter {
  readonly unacked = new Map<number, { queue: string; message: StoredMessage }>();
  readonly calls: string[] = [];
  closed = false;
  private limit = 0;
  private deliveries = 0;

  constructor(private readonly broker: FakeBroker) {
    super();
    broker.channels.push(this);
  }

  hasCapacity(): boolean {
    return !this.closed && (this.limit === 0 || this.unacked.size < this.limit);
  }

  nextDeliveryTag(): number {
    this.deliveries += 1;
    return this.deliveries;
  }

  private open(operation: string): void {
    this.calls.push(operation);
    if (this.closed) throw new Error("Channel closed");
  }

  async assertExchange(name: string, type: string, options: { durable?: boolean } = {}): Promise<{ exchange: string }> {
    this.open(`assertExchange ${name}`);
    const existing = this.broker.exchanges.get(name);
    if (existing === undefined) {
      this.broker.exchanges.set(name, { type, durable: options.durable ?? true, bindings: [] });
    } else if (existing.type !== type) {
      throw new Error(`PRECONDITION_FAILED - inequivalent arg 'type' for exchange '${name}'`);
    }
    return { exchange: name };
  }

  async assertQueue(name: string, options: FakeQueueOptions = {}): Promise<{ queue: string; messageCount: number; consumerCount: number }> {
    this.open(`assertQueue ${name}`);
    const queueName = name === "" ? this.broker.nextQueueName() : name;
    const existing = this.broker.queues.get(queueName);
    if (existing === undefined) {
      this.broker.queues.set(queueName, {
        name: queueName,
        options,
        owner: options.exclusive === true ? this : null,
        messages: [],
        consumers: [],
        nextConsumer: 0,
      });
    } else {
      for (const key of ["messageTtl", "maxLength", "deadLetterExchange", "deadLetterRoutingKey"] as const) {
        if (existing.options[key] !== options[key]) {
          throw new Error(`PRECONDITION_FAILED - inequivalent arg '${key}' for queue '${queueName}'`);
        }
      }
    }
    return { queue: queueName, messageCount: this.broker.readyCount(queueName), consumerCount: this.broker.consumerCount(queueName) };
  }

  async bindQueue(queue: string, exchange: string, key: string): Promise<void> {
    this.open(`bindQueue ${queue} ${exchange}`);
    this.broker.queue(queue);
    const target = this.broker.exchanges.get(exchange);
    if (target === undefined) throw new Error(`NOT_FOUND - no exchange '${exchange}'`);
    if (!target.bindings.some((binding) => binding.queue === queue && binding.key === key)) target.bindings.push({ queue, key });
  }

  async prefetch(count: number): Promise<void> {
    this.open(`prefetch ${count}`);
    this.limit = count;
  }

  publish(exchange: string, routingKey: string, content: Buffer, properties: FakeMessageOptions = {}): boolean {
    this.open(`publish ${exchange}`);
    this.broker.publications.push({ exchange, routingKey, content: content.toString("utf8"), properties });
    this.broker.route(exchange, routingKey, { content, exchange, routingKey, properties, redelivered: false });
    return this.broker.acceptsPublications;
  }

  async consume(queue: string, deliver: (message: FakeDelivery | null) => void, options: { noAck?: boolean } = {}): Promise<{ consumerTag: string }> {
    this.open(`consume ${queue}`);
    const target = this.broker.queue(queue);
    const tag = this.broker.nextConsumerTag();
    target.consumers.push({ tag, channel: this, deliver, noAck: options.noAck === true });
    this.broker.dispatch(target);
    return { consumerTag: tag };
  }

  async cancel(consumerTag: string): Promise<void> {
    this.open(`cancel ${consumerTag}`);
    for (const queue of this.broker.queues.values()) {
      queue.consumers = queue.consumers.filter((consumer) => consumer.tag !== consumerTag);
    }
  }

  ack(message: FakeDelivery): void {
    this.open("ack");
    if (!this.unacked.delete(message.fields.deliveryTag)) throw new Error("PRECONDITION_FAILED - unknown delivery tag");
    this.broker.dispatchAll();
  }

  nack(message: FakeDelivery, _allUpTo = false, requeue = true): void {
    this.open("nack");
    const held = this.unacked.get(message.fields.deliveryTag);
    if (held === undefined) throw new Error("PRECONDITION_FAILED - unknown delivery tag");
    this.unacked.delete(message.fields.deliveryTag);
    if (requeue) {
      this.broker.requeue(held.queue, held.message);
    } else {
      const options = this.broker.queue(held.queue).options;
      if (options.deadLetterExchange !== undefined) {
        this.broker.route(options.deadLetterExchange, options.deadLetterRoutingKey ?? held.message.routingKey, held.message);
      }
    }
    this.broker.dispatchAll();
  }

  async checkQueue(name: string): Promise<{ queue: string; messageCount: number; consumerCount: number }> {
    this.open(`checkQueue ${name}`);
    this.broker.queue(name);
    return { queue: name, messageCount: this.broker.readyCount(name), consumerCount: this.broker.consumerCount(name) };
  }

  async deleteQueue(name: string): Promise<{ messageCount: number }> {
    this.open(`deleteQueue ${name}`);
    const messageCount = this.broker.readyCount(name);
    this.broker.queues.delete(name);
    for (const exchange of this.broker.exchanges.values()) {
      exchange.bindings = exchange.bindings.filter((binding) => binding.queue !== name);
    }
    return { messageCount };
  }

  async deleteExchange(name: string): Promise<void> {
    this.open(`deleteExchange ${name}`);
    this.broker.exchanges.delete(name);
  }

  private release(): void {
    this.closed = true;
    const held = [...this.unacked.values()].reverse();
    this.unacked.clear();
    for (const queue of [...this.broker.queues.values()]) {
      queue.consumers = queue.consumers.filter((consumer) => consumer.channel !== this);
      if (queue.owner === this) {
        this.broker.queues.delete(queue.name);
        for (const exchange of this.broker.exchanges.values()) {
          exchange.bindings = exchange.bindings.filter((binding) => binding.queue !== queue.name);
        }
      }
    }
    for (const entry of held) this.broker.requeue(entry.queue, entry.message);
    this.broker.dispatchAll();
  }

  async close(): Promise<void> {
    if (this.closed) throw new Error("Channel closed");
    this.calls.push("close");
    this.release();
    this.emit("close");
  }

  lose(): void {
    if (this.closed) return;
    this.release();
    this.emit("close");
  }
}

class FakeChannelModel extends EventEmitter {
  readonly channels: FakeChannel[] = [];
  closed = false;

  constructor(private readonly broker: FakeBroker) {
    super();
  }

  async createChannel(): Promise<FakeChannel> {
    if (this.closed) throw new Error("Connection closed");
    const channel = new FakeChannel(this.broker);
    this.channels.push(channel);
    return channel;
  }

  async close(): Promise<void> {
    if (this.closed) throw new Error("Connection closed");
    this.closed = true;
    for (const channel of this.channels) channel.lose();
    this.emit("close");
  }
}

class FakeRabbitMQ {
  readonly models: FakeChannelModel[] = [];
  failConnections = false;

  constructor(readonly broker: FakeBroker) {}

  async getChannelModel(serviceName: string): Promise<FakeChannelModel> {
    if (this.failConnections) throw new Error(`${serviceName} failed to connect to RabbitMQ broker.`);
    const model = new FakeChannelModel(this.broker);
    this.models.push(model);
    return model;
  }

  async getChannel(model: FakeChannelModel, _serviceName: string): Promise<FakeChannel> {
    return model.createChannel();
  }
}

export { FakeBroker, FakeChannel, FakeChannelModel, FakeRabbitMQ };
export type { FakeDelivery, FakePublication };
