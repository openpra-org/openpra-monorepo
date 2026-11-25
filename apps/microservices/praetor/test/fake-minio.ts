type FakeBucket = "input" | "output" | "jobs";

class FakeMinio {
  readonly objects = new Map<string, string>();
  readonly writes: string[] = [];
  failWrites: (objectName: string) => boolean = () => false;
  failReads: (objectName: string) => boolean = () => false;
  afterWrite: (objectName: string) => void = () => undefined;

  private key(kind: FakeBucket, objectName: string): string {
    return `${kind}/${objectName}`;
  }

  async putText(kind: FakeBucket, objectName: string, text: string): Promise<void> {
    if (this.failWrites(objectName)) throw new Error(`storage refused to write ${objectName}`);
    this.objects.set(this.key(kind, objectName), text);
    this.writes.push(this.key(kind, objectName));
    this.afterWrite(objectName);
  }

  async getText(kind: FakeBucket, objectName: string): Promise<string | undefined> {
    if (this.failReads(objectName)) throw new Error(`storage refused to read ${objectName}`);
    return this.objects.get(this.key(kind, objectName));
  }

  text(kind: FakeBucket, objectName: string): string | undefined {
    return this.objects.get(this.key(kind, objectName));
  }

  names(): string[] {
    return [...this.objects.keys()].sort();
  }

  remove(kind: FakeBucket, objectName: string): void {
    this.objects.delete(this.key(kind, objectName));
  }
}

export { FakeMinio };
export type { FakeBucket };
