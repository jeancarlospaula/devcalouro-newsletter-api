import Redis from 'ioredis';
import { logger } from './logger';

let redis: Redis;
const connectToRedis = () => {
  redis = new Redis(process.env.REDIS_URL as string);
  logger.info({
    message: 'Connected to Redis',
  });
};

export { redis, connectToRedis };
