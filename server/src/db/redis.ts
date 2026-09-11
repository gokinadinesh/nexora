import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Create a single shared Redis client instance
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // Retry up to 3 times, then give up (allows fallback to in-memory)
    if (times > 3) {
      return null;
    }
    const delay = Math.min(times * 100, 2000);
    return delay;
  },
});

export const redisSubClient = redisClient.duplicate();

let isRedisConnected = false;

redisClient.on('error', (err) => {
  // Catch errors to prevent process crash
  isRedisConnected = false;
});

redisSubClient.on('error', (err) => {
  // Catch errors
});

export async function connectRedis(): Promise<boolean> {
  try {
    logger.info(`Attempting to connect to Redis at ${redisUrl}...`);
    await redisClient.connect();
    await redisSubClient.connect();
    isRedisConnected = true;
    logger.info('Successfully connected to Redis');
    return true;
  } catch (error: any) {
    logger.warn(`Failed to connect to Redis: ${error.message}. Falling back to in-memory mode.`);
    isRedisConnected = false;
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return isRedisConnected && redisClient.status === 'ready';
}
