import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserRole } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';
import { MailService } from '../../common/mail/mail.service';
import { User } from './entities/user.entity';
import { Company } from './entities/company.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { assertPasswordPolicy } from './password.util';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.audit.log({
        companyId: user?.companyId ?? null,
        actorId: user?.id ?? null,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user?.id ?? null,
        payload: { email, reason: 'bad_credentials' },
        ip,
      });
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (!user.active) {
      throw new UnauthorizedException('Compte désactivé — contactez votre administrateur');
    }

    const company = user.companyId
      ? await this.companyRepository.findOne({ where: { id: user.companyId } })
      : null;
    if (user.companyId) this.assertCompanyCanLogin(company);

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);
    await this.audit.log({
      companyId: user.companyId,
      actorId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ip,
    });

    return {
      accessToken: await this.signToken(user),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        companyName: company?.name ?? null,
        licenseType: user.licenseType,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /** Refus de connexion explicite plutôt qu'un 403 sur chaque écran après login. */
  private assertCompanyCanLogin(company: Company | null) {
    if (!company || company.archivedAt) {
      throw new UnauthorizedException('Compte entreprise archivé — contactez Green-T');
    }
    if (!company.active) {
      throw new UnauthorizedException('Entreprise désactivée — contactez Green-T');
    }
    if (company.subscriptionStatus === 'suspendu') {
      throw new UnauthorizedException('Accès suspendu (impayé) — contactez Green-T pour régulariser');
    }
    if (company.subscriptionStatus === 'resilie') {
      throw new UnauthorizedException('Abonnement résilié — contactez Green-T');
    }
  }

  private signToken(user: Pick<User, 'id' | 'email' | 'role' | 'companyId'>) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  }

  /**
   * Session support : jeton court (30 min) au nom d'un utilisateur du tenant, marqué `imp`
   * (id du super admin) pour que chaque action reste imputable.
   */
  async impersonate(companyId: string, targetUserId: string | undefined, actor: { id: string }, ip?: string) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Tenant introuvable');
    if (company.archivedAt) throw new BadRequestException('Tenant archivé — restaurez-le avant de vous y connecter');

    const target = targetUserId
      ? await this.userRepository.findOne({ where: { id: targetUserId, companyId } })
      : await this.userRepository.findOne({
          where: { companyId, role: UserRole.ADMIN, active: true },
          order: { createdAt: 'ASC' },
        });
    if (!target) throw new NotFoundException(targetUserId ? 'Utilisateur introuvable dans ce tenant' : 'Aucun administrateur actif dans ce tenant');
    if (!target.active) throw new BadRequestException('Utilisateur désactivé');

    const expiresInMinutes = 30;
    const accessToken = await this.jwtService.signAsync(
      { sub: target.id, email: target.email, role: target.role, companyId: target.companyId, imp: actor.id },
      { expiresIn: `${expiresInMinutes}m` },
    );
    await this.audit.log({
      companyId,
      actorId: actor.id,
      action: 'auth.impersonate',
      entityType: 'user',
      entityId: target.id,
      payload: { email: target.email, role: target.role, expiresInMinutes },
      ip,
    });
    return {
      accessToken,
      expiresInMinutes,
      user: {
        id: target.id,
        email: target.email,
        fullName: target.fullName,
        role: target.role,
        companyId: target.companyId,
        companyName: company.name,
        impersonatedBy: actor.id,
      },
    };
  }

  /**
   * Création d'un tenant + son compte admin (Console Green-T).
   * Retourne les identifiants de l'admin créé.
   */
  async register(dto: RegisterDto) {
    const companyName = dto.companyName.trim();
    const adminEmail = dto.adminEmail.toLowerCase().trim();
    assertPasswordPolicy(dto.adminPassword);

    const existingCompany = await this.companyRepository.findOne({ where: { name: companyName } });
    if (existingCompany) {
      throw new ConflictException(`L'entreprise « ${companyName} » existe déjà`);
    }
    const existingUser = await this.userRepository.findOne({ where: { email: adminEmail } });
    if (existingUser) {
      throw new ConflictException(`L'email « ${adminEmail} » est déjà utilisé`);
    }

    const company = this.companyRepository.create({
      name: companyName,
      sonatelSubcontractorName: dto.sonatelSubcontractorName?.trim() ?? null,
      subscriptionStatus: 'trial',
      trialEndDate: this.addDays(new Date(), 30).toISOString().slice(0, 10),
    });
    await this.companyRepository.save(company);

    const admin = this.userRepository.create({
      companyId: company.id,
      email: adminEmail,
      passwordHash: await bcrypt.hash(dto.adminPassword, 10),
      fullName: dto.adminFullName.trim(),
      role: UserRole.ADMIN,
      licenseType: 'web',
      mustChangePassword: dto.mustChangePassword ?? true,
    });
    await this.userRepository.save(admin);

    this.logger.log(`Tenant créé : ${company.name} (${company.id}) — admin ${admin.email}`);

    return {
      company: { id: company.id, name: company.name, subscriptionStatus: company.subscriptionStatus },
      admin: { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role },
    };
  }

  /**
   * Mot de passe oublié : génère un token à usage unique (valide 1 h).
   * L'envoi email/WhatsApp sera branché au module Notifications (Phase 15).
   */
  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase().trim() } });
    // Réponse identique que le compte existe ou non (pas d'énumération d'emails).
    if (!user) return { message: 'Si le compte existe, un lien de réinitialisation a été envoyé.' };

    const resetToken = await this.issueResetToken(user);
    const delivery = await this.deliverResetLink(user, this.buildResetUrl(resetToken));
    await this.audit.log({
      companyId: user.companyId,
      actorId: user.id,
      action: 'auth.forgot_password',
      entityType: 'user',
      entityId: user.id,
      payload: { emailed: delivery.emailed },
    });
    const payload: { message: string; devResetToken?: string } = {
      message: 'Si le compte existe, un lien de réinitialisation a été envoyé.',
    };
    // Hors prod et sans SMTP : exposer le token pour pouvoir tester le parcours.
    if (process.env.NODE_ENV !== 'production' && !delivery.emailed) {
      payload.devResetToken = resetToken;
    }
    return payload;
  }

  async deliverResetLink(user: Pick<User, 'email' | 'fullName'>, resetUrl: string) {
    const result = await this.mail.send(
      user.email,
      'VECTRACOM — Réinitialisation de votre mot de passe',
      `Bonjour ${user.fullName},\n\nPour définir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${resetUrl}\n\n` +
        `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nL'équipe Green-T`,
    );
    return { emailed: result.sent };
  }

  /** Email de bienvenue avec identifiants ; sans SMTP, l'admin transmet lui-même les accès. */
  async deliverWelcome(user: Pick<User, 'email' | 'fullName'>, temporaryPassword: string) {
    const result = await this.mail.send(
      user.email,
      'VECTRACOM — Vos accès',
      `Bonjour ${user.fullName},\n\nVotre compte VECTRACOM est prêt.\nAdresse : ${this.webBaseUrl()}\nIdentifiant : ${user.email}\n` +
        `Mot de passe temporaire : ${temporaryPassword}\n\nVous devrez le changer à la première connexion.\n\nL'équipe Green-T`,
    );
    return { emailed: result.sent };
  }

  /** Génère et enregistre un token de réinitialisation ; retourne le token en clair. */
  async issueResetToken(user: User): Promise<string> {
    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.userRepository.update(user.id, {
      passwordResetToken: await bcrypt.hash(resetToken, 10),
      passwordResetExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    return resetToken;
  }

  buildResetUrl(token: string): string {
    return `${this.webBaseUrl()}/reset-password?token=${token}`;
  }

  private webBaseUrl(): string {
    const base =
      this.config.get<string>('WEB_PUBLIC_URL') ??
      (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3101').split(',')[0].trim();
    return base.replace(/\/$/, '');
  }

  async resetPassword(token: string, newPassword: string) {
    assertPasswordPolicy(newPassword);
    const candidates = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password_reset_token')
      .where('user.password_reset_expires > :now', { now: new Date() })
      .getMany();

    const user = await candidates.reduce<Promise<User | null>>(async (accPromise, candidate) => {
      const acc = await accPromise;
      if (acc) return acc;
      if (candidate.passwordResetToken && (await bcrypt.compare(token, candidate.passwordResetToken))) {
        return candidate;
      }
      return null;
    }, Promise.resolve(null));

    if (!user) throw new UnauthorizedException('Token invalide ou expiré');

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await this.userRepository.save(user);
    await this.audit.log({
      companyId: user.companyId,
      actorId: user.id,
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: user.id,
    });
    return { message: 'Mot de passe réinitialisé.' };
  }

  /** Changement de son propre mot de passe ; retourne un nouveau jeton (les anciens sont révoqués). */
  async changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) throw new UnauthorizedException();
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel");
    }
    assertPasswordPolicy(newPassword);

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await this.userRepository.save(user);
    await this.audit.log({
      companyId: user.companyId,
      actorId: user.id,
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: user.id,
      ip,
    });
    return { message: 'Mot de passe modifié.', accessToken: await this.signToken(user) };
  }

  async updateProfile(userId: string, dto: { fullName?: string; phone?: string | null }) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) user.phone = dto.phone?.trim() || null;
    await this.userRepository.save(user);
    return this.me(userId);
  }

  async me(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const company = user.companyId
      ? await this.companyRepository.findOne({ where: { id: user.companyId } })
      : null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      companyId: user.companyId,
      companyName: company?.name ?? null,
      subscriptionStatus: company?.subscriptionStatus ?? null,
      licenseType: user.licenseType,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
    };
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
