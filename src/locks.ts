export interface LockProvider {
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

export class MemoryLockProvider implements LockProvider {
  private readonly sessionLocks = new Map<string, Promise<void>>();

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    while (this.sessionLocks.has(key)) {
      await this.sessionLocks.get(key);
    }

    let release: () => void = () => undefined;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.sessionLocks.set(key, lock);

    try {
      return await fn();
    } finally {
      this.sessionLocks.delete(key);
      release();
    }
  }
}

