import nodemailer from 'nodemailer';
import { ApiError } from './store';

export function registrationMailer(env: Record<string, string | undefined>) {
  const user = env.PURELYMAIL_SMTP_USER;
  const pass = env.PURELYMAIL_SMTP_PASSWORD;
  const transport =
    user && pass
      ? nodemailer.createTransport({
          host: 'smtp.purelymail.com',
          port: 465,
          secure: true,
          auth: { user, pass },
          connectionTimeout: 7000,
          greetingTimeout: 7000,
          socketTimeout: 10000,
        })
      : null;
  return async (to: string, code: string, requestId: string) => {
    if (!transport)
      throw new ApiError(503, 'MAIL_UNAVAILABLE', 'Отправка писем временно недоступна');
    try {
      await transport.sendMail({
        from: { name: 'Fapix Racing', address: user! },
        to,
        subject: 'Код регистрации в Fapix Racing',
        text: `Код регистрации в Fapix Racing: ${code}\n\nВведите его в игре в течение 10 минут.\nЕсли вы не запрашивали код, проигнорируйте это письмо.`,
      });
      console.info('Registration email', {
        requestId,
        at: new Date().toISOString(),
        status: 'accepted',
      });
    } catch (error) {
      console.warn('Registration email', {
        requestId,
        at: new Date().toISOString(),
        status: 'failed',
      });
      throw error;
    }
  };
}
