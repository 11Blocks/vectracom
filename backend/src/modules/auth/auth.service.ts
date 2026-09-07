import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserRole } from '../../common/decorators/roles.decorator';
import { User } from './entities/user.entity';
import { Company } from './entities/company.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email.toLowerCase() })
      .getOne();

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (!user.active) {
      throw new UnauthorizedException('Compte désactivé');
    }

    const company = user.companyId
      ? await this.companyRepository.findOne({ where: { id: user.companyId } })
      : null;

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        companyName: company?.name ?? null,
        licenseType: user.licenseType,
      },
    };
  }

  /**
   * Création d'un tenant + son compte admin (Console Green-T).
   * Retourne les identifiants de l'admin créé.
   */
  async register(dto: RegisterDto) {
    const companyName = dto.companyName.trim();
    const adminEmail = dto.adminEmail.toLowerCase();

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
    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
    // Réponse identique que le compte existe ou non (pas d'énumération d'emails).
    if (!user) return { message: 'Si le compte existe, un lien de réinitialisation a été envoyé.' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = await bcrypt.hash(resetToken, 10);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await this.userRepository.save(user);

    this.logger.log(`Reset password demandé pour ${user.email} — token généré (envoi à brancher)`);
    const payload: { message: string; devResetToken?: string } = {
      message: 'Si le compte existe, un lien de réinitialisation a été envoyé.',
    };
    // En démo / hors prod : exposer le token (SMTP non branché).
    if (process.env.NODE_ENV !== 'production') {
      payload.devResetToken = resetToken;
    }
    return payload;
  }

  async resetPassword(token: string, newPassword: string) {
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
    await this.userRepository.save(user);
    return { message: 'Mot de passe réinitialisé.' };
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
      role: user.role,
      companyId: user.companyId,
      companyName: company?.name ?? null,
      subscriptionStatus: company?.subscriptionStatus ?? null,
      licenseType: user.licenseType,
    };
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
