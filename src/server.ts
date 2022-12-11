import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connectToRedis } from './lib';
import { issuesRoutes, rewardsRoutes, subscribersRoutes } from './routes';

dotenv.config();

async function start() {
  connectToRedis();

  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(issuesRoutes);
  await app.register(rewardsRoutes);
  await app.register(subscribersRoutes);

  app.listen({ port: 3333 });
}

start();
