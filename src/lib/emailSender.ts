import nodemailer from 'nodemailer';
import { logger } from './logger';

interface EmailSenderProps {
  email: string;
  subject: string;
  html: string;
  type: string;
}

const emailSender = async ({
  email,
  subject,
  html,
  type,
}: EmailSenderProps) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: true,
    auth: {
      user: process.env.EMAIL_AUTH,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter
    .sendMail({
      from: `Jean Carlos de Paula <${process.env.EMAIL_AUTH}>`,
      to: email,
      subject,
      html,
    })
    .then(() => {
      logger.info({
        message: `${type} email sent to ${email} via nodemailer`,
      });
    })
    .catch((error) => {
      throw error;
    });
};

export { emailSender };
