import ejs from 'ejs';
import path from 'path';
import { z } from 'zod';
import { prisma, revueApi, logger, emailSender } from '../lib';
import { errorResponses, CustomError } from '../utils';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { AxiosError } from 'axios';

async function subscribersRoutes(app: FastifyInstance) {
  app.post(
    '/subscriber',
    async (
      request: FastifyRequest<{
        Querystring: {
          referral: string;
        };
      }>,
      response
    ) => {
      try {
        const createSubscriberSchema = z.object({
          email: z.string().email(),
        });

        const { email } = createSubscriberSchema.parse(request.body);

        const existingUser = await prisma.subscribers.findUnique({
          where: {
            email,
          },
          select: {
            id: true,
            confirmedEmail: true,
          },
        });

        if (existingUser?.confirmedEmail) {
          throw errorResponses.ExistingEmail();
        }

        const referralCode = request.query.referral as string;

        const referralSubscriber = referralCode
          ? await prisma.subscribers.findFirst({
              where: {
                id: referralCode,
                confirmedEmail: true,
              },
              select: {
                id: true,
              },
            })
          : null;

        const subscriber =
          existingUser ||
          (await prisma.subscribers.create({
            data: {
              email,
              indicatedBy: referralSubscriber?.id
                ? referralSubscriber.id
                : null,
            },
            select: {
              id: true,
            },
          }));

        const emailTemplatePath = path.join(
          __dirname,
          '../templates/emails/confirmationEmail.ejs'
        );

        const emailTemplateData = {
          confirmationURL: `${process.env.APP_URL}/newsletter/confirm?token=${subscriber.id}`,
          membersURL: `${process.env.APP_URL}/newsletter/membros`,
          indicationsURL: `${process.env.APP_URL}/newsletter/indicacoes`,
          unsubscribeURL: `${process.env.APP_URL}/newsletter/unsubscribe?token=${subscriber.id}`,
          currentYear: new Date().getFullYear(),
        };

        const emailHTML = await ejs.renderFile(
          emailTemplatePath,
          emailTemplateData
        );

        await emailSender({
          email,
          subject: 'Só falta você confirmar seu email!',
          html: emailHTML,
          type: 'Confirmation',
        });

        return response.status(200).send({
          message: `Cadastro realizado com sucesso. Um email de confirmação foi enviado para ${email}.`,
        });
      } catch (error) {
        logger.error(error);

        if (error instanceof CustomError) {
          return response.status(error.statusCode).send(error.data);
        }

        if (error instanceof z.ZodError) {
          return response.status(400).send({
            error: {
              message: 'Informe um email válido.',
            },
          });
        }

        return response.status(500).send({
          error: {
            message:
              'Ocorreu um erro ao cadastrar o email. Tente novamente mais tarde.',
          },
        });
      }
    }
  );

  app.patch(
    '/subscriber/confirm',
    async (
      request: FastifyRequest<{
        Querystring: {
          token: string;
        };
      }>,
      response
    ) => {
      try {
        const token = request.query.token;

        if (!token) {
          throw errorResponses.InvalidToken();
        }

        const subscriber = await prisma.subscribers.findUnique({
          where: {
            id: token,
          },
          select: {
            email: true,
            confirmedEmail: true,
            indicatedBy: true,
          },
        });

        if (!subscriber) {
          throw errorResponses.InvalidToken();
        }

        if (subscriber.confirmedEmail) {
          return response.status(200).send({
            message: 'Email confirmado com sucesso.',
          });
        }

        await revueApi.post('/v2/subscribers', {
          email: subscriber.email,
          double_opt_in: false,
        });

        await prisma.subscribers.update({
          where: {
            id: token,
          },
          data: {
            confirmedEmail: true,
            confirmedEmailAt: new Date(),
          },
        });

        if (subscriber.indicatedBy) {
          const referralSubscriber = await prisma.subscribers.findUnique({
            where: {
              id: subscriber.indicatedBy,
            },
            select: {
              id: true,
              email: true,
              indications: true,
              confirmedEmail: true,
            },
          });

          const referralSubscriberConfirmedEmail =
            referralSubscriber?.email && referralSubscriber?.confirmedEmail;

          if (referralSubscriberConfirmedEmail) {
            await prisma.subscribers.update({
              where: {
                id: referralSubscriber.id,
              },
              data: {
                indications: {
                  increment: 1,
                },
              },
            });

            const reward = await prisma.rewards.findFirst({
              where: {
                indications: ++referralSubscriber.indications,
              },
              select: {
                name: true,
                indications: true,
                url: true,
              },
            });

            if (reward) {
              const emailTemplatePath = path.join(
                __dirname,
                '../templates/emails/rewardIndicationsEmail.ejs'
              );

              const emailTemplateData = {
                rewardName: reward.name,
                rewardUrl: reward.url,
                rewardIndications: reward.indications,
                membersURL: `${process.env.APP_URL}/newsletter/membros`,
                indicationsURL: `${process.env.APP_URL}/newsletter/indicacoes`,
                unsubscribeURL: `${process.env.APP_URL}/newsletter/unsubscribe?token=${referralSubscriber.id}`,
                currentYear: new Date().getFullYear(),
              };

              const emailHTML = await ejs.renderFile(
                emailTemplatePath,
                emailTemplateData
              );

              await emailSender({
                email: referralSubscriber.email,
                subject:
                  'Aqui está a sua recompensa por indicar a Newsletter @dev.calouro',
                html: emailHTML,
                type: 'Reward',
              });
            } else {
              const emailTemplatePath = path.join(
                __dirname,
                '../templates/emails/referralConfirmationEmail.ejs'
              );

              const emailTemplateData = {
                indications: referralSubscriber.indications,
                membersURL: `${process.env.APP_URL}/newsletter/membros`,
                indicationsURL: `${process.env.APP_URL}/newsletter/indicacoes`,
                unsubscribeURL: `${process.env.APP_URL}/newsletter/unsubscribe?token=${referralSubscriber.id}`,
                currentYear: new Date().getFullYear(),
              };

              const emailHTML = await ejs.renderFile(
                emailTemplatePath,
                emailTemplateData
              );

              await emailSender({
                email: referralSubscriber.email,
                subject: 'Obrigado por indicar a Newsletter @dev.calouro',
                html: emailHTML,
                type: 'Confirm indication',
              });
            }
          }
        }

        return response.status(200).send({
          message: 'Email confirmado com sucesso.',
        });
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

        if (error instanceof CustomError) {
          return response.status(error.statusCode).send(error.data);
        }

        return response.status(500).send({
          error: {
            message:
              'Ocorreu um erro ao confirmar o email. Tente novamente mais tarde.',
          },
        });
      }
    }
  );

  app.patch('/subscriber/member', async (request, response) => {
    try {
      const createSubscriberSchema = z.object({
        email: z.string().email(),
        aidedFoundation: z.string().min(3).max(50),
      });

      const { email, aidedFoundation } = createSubscriberSchema.parse(
        request.body
      );

      const subscriber = await prisma.subscribers.findFirst({
        where: {
          email,
        },
        select: {
          email: true,
          confirmedEmail: true,
          member: true,
        },
      });

      if (!subscriber) {
        throw errorResponses.InvalidEmail();
      }

      if (!subscriber.confirmedEmail) {
        throw errorResponses.UnconfirmedEmail();
      }

      if (subscriber.member) {
        throw errorResponses.AlreadyMember();
      }

      await revueApi.patch('/v2/subscribers', {
        email,
        member: true,
      });

      await prisma.subscribers.update({
        where: {
          email,
        },
        data: {
          member: true,
          memberSince: new Date(),
          aidedFoundation,
        },
      });

      return response.status(200).send({
        message: 'Email adicionado à lista VIP de membros com sucesso.',
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.info({
          error: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
        });
      } else {
        logger.error(error);
      }

      if (error instanceof z.ZodError) {
        return response.status(400).send({
          error: {
            message: 'Dados inválidos.',
          },
        });
      }

      if (error instanceof CustomError) {
        return response.status(error.statusCode).send(error.data);
      }

      return response.status(500).send({
        error: {
          message:
            'Ocorreu um erro ao cadastrar o email como membro. Tente novamente mais tarde.',
        },
      });
    }
  });

  app.post('/subscriber/referralLink', async (request, response) => {
    try {
      const createSubscriberSchema = z.object({
        email: z.string().email(),
      });

      const { email } = createSubscriberSchema.parse(request.body);

      const subscriber = await prisma.subscribers.findFirst({
        where: {
          email,
        },
        select: {
          id: true,
          confirmedEmail: true,
        },
      });

      if (!subscriber) {
        throw errorResponses.InvalidEmail();
      }

      if (!subscriber.confirmedEmail) {
        throw errorResponses.UnconfirmedEmail();
      }

      const referralLink = `${process.env.APP_URL}/newsletter/?referral=${subscriber.id}`;

      return response.status(200).send({
        referralLink,
      });
    } catch (error) {
      logger.error(error);

      if (error instanceof z.ZodError) {
        return response.status(400).send({
          error: {
            message: 'Informe um email válido.',
          },
        });
      }

      if (error instanceof CustomError) {
        return response.status(error.statusCode).send(error.data);
      }

      return response.status(500).send({
        error: {
          message:
            'Ocorreu um erro ao cadastrar o email como membro. Tente novamente mais tarde.',
        },
      });
    }
  });

  app.delete(
    '/subscriber',
    async (
      request: FastifyRequest<{
        Querystring: {
          token: string;
        };
      }>,
      response
    ) => {
      try {
        const { token } = request.query;

        const subscriber = await prisma.subscribers.findUnique({
          where: {
            id: token,
          },
          select: {
            email: true,
          },
        });

        if (!subscriber) {
          throw errorResponses.InvalidToken();
        }

        await revueApi.post('/v2/subscribers/unsubscribe', {
          email: subscriber.email,
          double_opt_in: false,
        });

        await revueApi.patch('/v2/subscribers', {
          email: subscriber.email,
          member: false,
        });

        await prisma.subscribers.delete({
          where: {
            id: token,
          },
          select: {
            email: true,
          },
        });

        return response.status(200).send({
          message:
            'Inscrição da cancelada com sucesso. Você não receberá mais emails da Newsletter.',
        });
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

        if (error instanceof CustomError) {
          return response.status(error.statusCode).send(error.data);
        }

        return response.status(500).send({
          error: {
            message:
              'Ocorreu um erro ao remover o email da lista de inscritos da Newsletter. Tente novamente mais tarde.',
          },
        });
      }
    }
  );
}

export { subscribersRoutes };
