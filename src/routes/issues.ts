import { AxiosError } from 'axios';
import { redis, revueApi, logger } from '../lib';
import { FastifyInstance } from 'fastify';

interface issues {
  title: string;
  description: string;
  sent_at: string;
  url: string;
}

async function issuesRoutes(app: FastifyInstance) {
  app.get('/issues', async (request, response) => {
    try {
      const cachedIssues = await redis.get('issues');

      if (cachedIssues) {
        const issues = JSON.parse(cachedIssues);

        return response.status(200).send(issues);
      }

      const { data } = await revueApi.get('/v2/issues');

      const issues: issues[] = data
        .map((issue: any) => {
          return {
            title: issue.title,
            description: issue.description,
            sent_at: issue.sent_at,
            url: issue.url,
          };
        })
        .slice(0, Number(process.env.ISSUES_LIMIT));

      if (issues.length > 0) {
        const keyTTL = 60 * 60 * 24; // 1 day
        await redis.set('issues', JSON.stringify(issues), 'EX', keyTTL);

        logger.info({
          message: `${issues.length} issues cached`,
          date: new Date(),
        });
      }

      return response.status(200).send(issues);
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error({
          error: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
        });
      } else {
        logger.error(error);
      }

      return response.status(500).send({
        error: {
          message:
            'Ocorreu um erro ao buscar as edições da Newsletter @dev.calouro',
        },
      });
    }
  });
}

export { issuesRoutes };
