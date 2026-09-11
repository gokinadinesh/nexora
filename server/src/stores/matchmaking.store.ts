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

import { redisClient } from '../db/redis';

export class RedisMatchmakingStore implements IMatchmakingStore {
  private readonly QUEUE_KEY = 'matchmaking:queue';
  private readonly LOCK_KEY = 'matchmaking:lock';

  async enqueue(entry: QueueEntry): Promise<void> {
    await redisClient.rpush(this.QUEUE_KEY, JSON.stringify(entry));
  }

  async dequeue(userId: string): Promise<boolean> {
    // This is less efficient in Redis, but we need to fetch, filter and rewrite
    // To make this safe, it should be done while locked
    const locked = await this.lockQueue();
    if (!locked) return false;

    try {
      const queueItems = await redisClient.lrange(this.QUEUE_KEY, 0, -1);
      const initialLen = queueItems.length;
      
      const newQueue = queueItems.filter(item => {
        try {
          const entry = JSON.parse(item) as QueueEntry;
          return entry.userId !== userId;
        } catch (e) {
          return true; // Keep malformed items? or filter them. Let's keep to be safe, or filter.
        }
      });

      if (newQueue.length < initialLen) {
        await redisClient.del(this.QUEUE_KEY);
        if (newQueue.length > 0) {
          await redisClient.rpush(this.QUEUE_KEY, ...newQueue);
        }
        return true;
      }
      return false;
    } finally {
      await this.unlockQueue();
    }
  }

  async getQueue(): Promise<QueueEntry[]> {
    const queueItems = await redisClient.lrange(this.QUEUE_KEY, 0, -1);
    return queueItems.map(item => JSON.parse(item));
  }

  async setQueue(queue: QueueEntry[]): Promise<void> {
    await redisClient.del(this.QUEUE_KEY);
    if (queue.length > 0) {
      const stringifiedQueue = queue.map(entry => JSON.stringify(entry));
      await redisClient.rpush(this.QUEUE_KEY, ...stringifiedQueue);
    }
  }

  async getQueueLength(): Promise<number> {
    return await redisClient.llen(this.QUEUE_KEY);
  }

  async clearQueue(): Promise<void> {
    await redisClient.del(this.QUEUE_KEY);
  }

  async lockQueue(): Promise<boolean> {
    // Attempt to acquire lock with 5 second expiry
    const result = await redisClient.set(this.LOCK_KEY, 'locked', 'EX', 5, 'NX');
    return result === 'OK';
  }

  async unlockQueue(): Promise<void> {
    await redisClient.del(this.LOCK_KEY);
  }
}
