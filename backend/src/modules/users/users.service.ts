import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../common/decorators/roles.decorator';
import { JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/audit/audit.service';
import { User } from '../auth/entities/user.entity';
import { Company } from '../auth/entities/company.entity';
import { AuthService } from '../auth/auth.service';
import { assertPasswordPolicy, generateTemporaryPassword } from '../auth/password.util';
import {
  CONSOLE_ROLES,
  CreateUserDto,
  SetUserPasswordDto,
  TENANT_ROLES,
  UpdateUserDto,
} from './dto/users.dto';

export interface ActorContext {
  user: JwtPayloadUser;
  ip?: string;
}

/** companyId null = équipe Green-T (IS NULL, pas « = NULL »). */
const scoped = (companyId: string | null) => companyId ?? IsNull();

const PUBLIC_FIELDS: (keyof User)[] = [
  'id', 'companyId', 'email', 'fullName', 'phone', 'role', 'active', 'licenseType', 'licenseActive',
  'lastLoginAt', 'mustChangePassword', 'passwordChangedAt', 'createdAt', 'updatedAt',
];

/**
 * Gestion des comptes utilisateurs, partagée entre la console Green-T
 * (companyId = tenant ciblé ou null pour l'équipe Green-T) et l'admin tenant (son propre companyId).
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  /** companyId null = comptes de l'équipe Green-T. */
  async list(companyId: string | null) {
    const users = await this.userRepository.find({
      where: { companyId: scoped(companyId) },
      select: PUBLIC_FIELDS,
      order: { role: 'ASC', fullName: 'ASC' },
    });
    if (!companyId || users.length === 0) return users;

    const techs: { id: string; fullName: string; userId: string }[] = await this.dataSource.query(
      `SELECT id, full_name AS "fullName", user_id AS "userId"
         FROM technicians WHERE company_id = $1 AND user_id IS NOT NULL`,
      [companyId],
    );
    return users.map((u) => ({
      ...u,
      technicians: techs.filter((t) => t.userId === u.id).map(({ id, fullName }) => ({ id, fullName })),
    }));
  }

  async findOne(companyId: string | null, userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, companyId: scoped(companyId) },
      select: PUBLIC_FIELDS,
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async create(companyId: string | null, dto: CreateUserDto, actor: ActorContext) {
    this.assertRoleAllowed(companyId, dto.role);
    const email = dto.email.toLowerCase().trim();

    if (companyId) {
      const company = await this.requireCompany(companyId);
      if (company.maxUsers) {
        const activeCount = await this.userRepository.count({ where: { companyId, active: true } });
        if (activeCount >= company.maxUsers) {
          throw new BadRequestException(
            `Limite de ${company.maxUsers} utilisateurs actifs atteinte pour ce tenant — contactez Green-T`,
          );
        }
      }
    }
    await this.assertEmailFree(email);

    const generated = !dto.password;
    const password = dto.password ?? generateTemporaryPassword();
    assertPasswordPolicy(password);

    const user = this.userRepository.create({
      companyId,
      email,
      fullName: dto.fullName.trim(),
      phone: dto.phone?.trim() || null,
      role: dto.role,
      passwordHash: await bcrypt.hash(password, 10),
      licenseType: dto.licenseType ?? this.defaultLicense(dto.role),
      mustChangePassword: dto.mustChangePassword ?? true,
      active: true,
    });
    await this.userRepository.save(user);
    const delivery = dto.sendWelcomeEmail === false
      ? { emailed: false }
      : await this.authService.deliverWelcome(user, password);

    await this.audit.log({
      companyId,
      actorId: actor.user.id,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      payload: { email, role: dto.role, fullName: user.fullName, generatedPassword: generated, emailed: delivery.emailed },
      ip: actor.ip,
    });

    return {
      user: await this.findOne(companyId, user.id),
      temporaryPassword: generated ? password : undefined,
      emailed: delivery.emailed,
    };
  }

  async update(companyId: string | null, userId: string, dto: UpdateUserDto, actor: ActorContext) {
    const user = await this.userRepository.findOne({
      where: { id: userId, companyId: scoped(companyId) },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const track = (field: string, from: unknown, to: unknown) => {
      if (from !== to) changes[field] = { from, to };
    };

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      if (email !== user.email) {
        await this.assertEmailFree(email, user.id);
        track('email', user.email, email);
        user.email = email;
      }
    }
    if (dto.fullName !== undefined) {
      track('fullName', user.fullName, dto.fullName.trim());
      user.fullName = dto.fullName.trim();
    }
    if (dto.phone !== undefined) {
      const phone = dto.phone?.trim() || null;
      track('phone', user.phone, phone);
      user.phone = phone;
    }
    if (dto.licenseType !== undefined) {
      track('licenseType', user.licenseType, dto.licenseType);
      user.licenseType = dto.licenseType;
    }
    if (dto.role !== undefined && dto.role !== user.role) {
      this.assertRoleAllowed(companyId, dto.role);
      if (user.id === actor.user.id) {
        throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle');
      }
      if (user.role === UserRole.ADMIN && user.active) await this.assertNotLastAdmin(companyId, user.id);
      if (user.role === UserRole.SUPER_ADMIN && user.active) await this.assertNotLastAdmin(companyId, user.id);
      track('role', user.role, dto.role);
      user.role = dto.role;
    }

    if (Object.keys(changes).length === 0) return this.findOne(companyId, user.id);

    await this.userRepository.save(user);
    await this.audit.log({
      companyId,
      actorId: actor.user.id,
      action: 'user.update',
      entityType: 'user',
      entityId: user.id,
      payload: { email: user.email, changes },
      ip: actor.ip,
    });
    return this.findOne(companyId, user.id);
  }

  async setActive(companyId: string | null, userId: string, active: boolean, actor: ActorContext) {
    const user = await this.userRepository.findOne({
      where: { id: userId, companyId: scoped(companyId) },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.active === active) return this.findOne(companyId, user.id);

    if (!active) {
      if (user.id === actor.user.id) throw new ForbiddenException('Vous ne pouvez pas désactiver votre propre compte');
      if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
        await this.assertNotLastAdmin(companyId, user.id);
      }
    } else if (companyId) {
      const company = await this.requireCompany(companyId);
      if (company.maxUsers) {
        const activeCount = await this.userRepository.count({ where: { companyId, active: true } });
        if (activeCount >= company.maxUsers) {
          throw new BadRequestException(`Limite de ${company.maxUsers} utilisateurs actifs atteinte`);
        }
      }
    }

    user.active = active;
    await this.userRepository.save(user);
    await this.audit.log({
      companyId,
      actorId: actor.user.id,
      action: active ? 'user.activate' : 'user.deactivate',
      entityType: 'user',
      entityId: user.id,
      payload: { email: user.email },
      ip: actor.ip,
    });
    return this.findOne(companyId, user.id);
  }

  /** Définit (ou génère) un nouveau mot de passe ; révoque les sessions en cours. */
  async setPassword(companyId: string | null, userId: string, dto: SetUserPasswordDto, actor: ActorContext) {
    const user = await this.userRepository.findOne({
      where: { id: userId, companyId: scoped(companyId) },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const generated = !dto.password;
    const password = dto.password ?? generateTemporaryPassword();
    assertPasswordPolicy(password);

    user.passwordHash = await bcrypt.hash(password, 10);
    user.mustChangePassword = dto.mustChangePassword ?? true;
    user.passwordChangedAt = new Date();
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);

    await this.audit.log({
      companyId,
      actorId: actor.user.id,
      action: 'user.password_set',
      entityType: 'user',
      entityId: user.id,
      payload: { email: user.email, generated, mustChangePassword: user.mustChangePassword },
      ip: actor.ip,
    });
    return {
      userId: user.id,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      temporaryPassword: generated ? password : undefined,
    };
  }

  /** Lien de réinitialisation (1 h) à transmettre à l'utilisateur. */
  async createResetLink(companyId: string | null, userId: string, actor: ActorContext) {
    const user = await this.userRepository.findOne({
      where: { id: userId, companyId: scoped(companyId) },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const token = await this.authService.issueResetToken(user);
    const resetUrl = this.authService.buildResetUrl(token);
    const delivery = await this.authService.deliverResetLink(user, resetUrl);

    await this.audit.log({
      companyId,
      actorId: actor.user.id,
      action: 'user.reset_link',
      entityType: 'user',
      entityId: user.id,
      payload: { email: user.email, emailed: delivery.emailed },
      ip: actor.ip,
    });
    return {
      email: user.email,
      resetUrl,
      emailed: delivery.emailed,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  /** Associe un compte (mobile) à un technicien du tenant ; null = détacher. */
  async linkTechnician(companyId: string, userId: string, technicianId: string | null, actor: ActorContext) {
    await this.findOne(companyId, userId);
    if (technicianId) {
      const found = await this.dataSource.query(
        `SELECT id FROM technicians WHERE id = $1 AND company_id = $2`,
        [technicianId, companyId],
      );
      if (!found.length) throw new NotFoundException('Technicien introuvable pour ce tenant');
      await this.dataSource.query(
        `UPDATE technicians SET user_id = $1, updated_at = now() WHERE id = $2 AND company_id = $3`,
        [userId, technicianId, companyId],
      );
    } else {
      await this.dataSource.query(
        `UPDATE technicians SET user_id = NULL, updated_at = now() WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId],
      );
    }
    await this.audit.log({
      companyId,
      actorId: actor.user.id,
      action: technicianId ? 'user.link_technician' : 'user.unlink_technician',
      entityType: 'user',
      entityId: userId,
      payload: { technicianId },
      ip: actor.ip,
    });
    return this.list(companyId).then((users) => users.find((u) => u.id === userId));
  }

  async countByCompany(): Promise<Record<string, { total: number; active: number }>> {
    const rows: { companyId: string; total: string; active: string }[] = await this.dataSource.query(
      `SELECT company_id AS "companyId", COUNT(*) AS total, COUNT(*) FILTER (WHERE active) AS active
         FROM users WHERE company_id IS NOT NULL GROUP BY company_id`,
    );
    return Object.fromEntries(rows.map((r) => [r.companyId, { total: Number(r.total), active: Number(r.active) }]));
  }

  private assertRoleAllowed(companyId: string | null, role: string) {
    const allowed: readonly string[] = companyId ? TENANT_ROLES : CONSOLE_ROLES;
    if (!allowed.includes(role)) {
      throw new BadRequestException(
        companyId
          ? `Rôle invalide pour un tenant (autorisés : ${TENANT_ROLES.join(', ')})`
          : `Rôle invalide pour l'équipe Green-T (autorisés : ${CONSOLE_ROLES.join(', ')})`,
      );
    }
  }

  private async assertEmailFree(email: string, exceptUserId?: string) {
    const existing = await this.userRepository.findOne({
      where: exceptUserId ? { email, id: Not(exceptUserId) } : { email },
    });
    if (existing) throw new ConflictException(`L'email « ${email} » est déjà utilisé`);
  }

  /** Un tenant garde au moins un admin actif ; la console garde au moins un super_admin actif. */
  private async assertNotLastAdmin(companyId: string | null, userId: string) {
    const role = companyId ? UserRole.ADMIN : UserRole.SUPER_ADMIN;
    const others = await this.userRepository.count({
      where: {
        companyId: scoped(companyId),
        role,
        active: true,
        id: Not(userId),
      },
    });
    if (others === 0) {
      throw new BadRequestException(
        companyId
          ? 'Impossible : ce compte est le dernier administrateur actif du tenant'
          : 'Impossible : ce compte est le dernier super admin actif',
      );
    }
  }

  private async requireCompany(companyId: string) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Tenant introuvable');
    if (company.archivedAt) throw new BadRequestException('Tenant archivé');
    return company;
  }

  private defaultLicense(role: string) {
    if (role === UserRole.CHEF_EQUIPE) return 'mobile' as const;
    if ((CONSOLE_ROLES as readonly string[]).includes(role)) return null;
    return 'web' as const;
  }
}
