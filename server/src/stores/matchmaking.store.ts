import { QueueEntry } from '@nexora/shared';

export interface IMatchmakingStore {
  enqueue(entry: QueueEntry): Promise<void>;
  dequeue(userId: string): Promise<boolean>;
  getQueue(): Promise<QueueEntry[]>;
  setQueue(queue: QueueEntry[]): Promise<void>;
  getQueueLength(): Promise<number>;
  clearQueue(): Promise<void>;
  lockQueue(): Promise<boolean>;
  unlockQueue(): Promise<void>;
}

export class InMemoryMatchmakingStore implements IMatchmakingStore {
  private waitingQueue: QueueEntry[] = [];
  private isLocked = false;

  async enqueue(entry: QueueEntry): Promise<void> {
    this.waitingQueue.push(entry);
  }

  async dequeue(userId: string): Promise<boolean> {
    const initialLen = this.waitingQueue.length;
    this.waitingQueue = this.waitingQueue.filter((entry) => entry.userId !== userId);
    return this.waitingQueue.length < initialLen;
  }

  async getQueue(): Promise<QueueEntry[]> {
    return [...this.waitingQueue];
  }

  async setQueue(queue: QueueEntry[]): Promise<void> {
    this.waitingQueue = queue;
  }

  async getQueueLength(): Promise<number> {
    return this.waitingQueue.length;
  }

  async clearQueue(): Promise<void> {
    this.waitingQueue = [];
  }

  async lockQueue(): Promise<boolean> {
    if (this.isLocked) return false;
    this.isLocked = true;
    return true;
  }

  async unlockQueue(): Promise<void> {
    this.isLocked = false;
  }
}
