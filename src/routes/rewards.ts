import { redis, prisma, logger } from '../lib';
import { FastifyInstance } from 'fastify';

interface rewards {
  name: string;
  indications: number;
}

async function rewardsRoutes(app: FastifyInstance) {
  app.get('/rewards', async (request, response) => {
    try {
      const rewardsCached = await redis.get('rewards');

      if (rewardsCached) {
        const rewards: rewards[] = JSON.parse(rewardsCached);

        return response
          .status(200)
          .send(rewards.sort((a, b) => a.indications - b.indications));
      }

      const rewards = await prisma.rewards.findMany({
        select: {
          name: true,
          indications: true,
        },
      });

      if (rewards.length > 0) {
        const keyTTL = 60 * 60 * 24; // 1 day
        await redis.set('rewards', JSON.stringify(rewards), 'EX', keyTTL);

        logger.info({
          message: 'Rewards cached',
          date: new Date(),
        });
      }

      return response
        .status(200)
        .send(rewards.sort((a, b) => a.indications - b.indications));
    } catch (error) {
      logger.error(error);

      return response.status(500).send({
        error: {
          message:
            'Ocorreu um erro ao buscar as recompensas da Newsletter @dev.calouro',
        },
      });
    }
  });
}

export { rewardsRoutes };
