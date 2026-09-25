import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  companyId: string | null;
  iat?: number;
  /** Id du super admin en session support (impersonation). */
  imp?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: [
        'id', 'email', 'fullName', 'role', 'companyId', 'active', 'licenseType', 'licenseActive',
        'mustChangePassword', 'passwordChangedAt',
      ],
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Compte invalide ou désactivé');
    }
    // iat est en secondes : tolérance d'1 s pour le jeton ré-émis juste après le changement.
    if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      throw new UnauthorizedException('Session expirée — mot de passe modifié, reconnectez-vous');
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
      licenseType: user.licenseType,
      mustChangePassword: payload.imp ? false : user.mustChangePassword,
      impersonatedBy: payload.imp ?? null,
    };
  }
}
