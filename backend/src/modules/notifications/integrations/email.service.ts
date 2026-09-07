import { Injectable, Logger } from '@nestjs/common';

/** Envoi email — SMTP/relayeur à brancher (nodemailer) ; simulé sans configuration. */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendEmail(to: string, subject: string, body: string) {
    if (!process.env.SMTP_URL) {
      this.logger.log(`Email simulé (SMTP_URL absent) : ${to} → ${subject}`);
      return { status: 'simulated' as const, detail: 'SMTP non configuré' };
    }
    // Branchement nodemailer à venir (Phase 16+/infra) — structure déjà en place.
    return { status: 'simulated' as const, detail: 'transporteur non implémenté' };
  }
}
