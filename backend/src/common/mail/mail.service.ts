import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailResult {
  sent: boolean;
  detail: string;
}

/**
 * Envoi SMTP (nodemailer). Configuration : SMTP_URL (ex. smtps://user:pass@smtp.host:465)
 * ou SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS ; expéditeur MAIL_FROM.
 * Sans configuration : aucun envoi, `sent=false` (l'appelant affiche le lien à transmettre).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null | undefined;

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(this.config.get('SMTP_URL') || this.config.get('SMTP_HOST'));
  }

  private getTransporter(): Transporter | null {
    if (this.transporter !== undefined) return this.transporter;
    const url = this.config.get<string>('SMTP_URL');
    const host = this.config.get<string>('SMTP_HOST');
    if (url) {
      this.transporter = nodemailer.createTransport(url);
    } else if (host) {
      const port = Number(this.config.get('SMTP_PORT') ?? 587);
      const user = this.config.get<string>('SMTP_USER');
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass: this.config.get<string>('SMTP_PASS') ?? '' } : undefined,
      });
    } else {
      this.transporter = null;
    }
    return this.transporter;
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<MailResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.log(`Email non envoyé (SMTP non configuré) : ${to} → ${subject}`);
      return { sent: false, detail: 'SMTP non configuré' };
    }
    try {
      await transporter.sendMail({
        from: this.config.get<string>('MAIL_FROM') ?? 'VECTRACOM <no-reply@green-t.sn>',
        to,
        subject,
        text,
        html,
      });
      return { sent: true, detail: 'envoyé' };
    } catch (err) {
      this.logger.warn(`Échec envoi email à ${to} : ${(err as Error).message}`);
      return { sent: false, detail: (err as Error).message };
    }
  }
}
