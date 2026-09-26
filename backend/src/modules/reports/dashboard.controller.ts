import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

class DashboardSummaryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([7, 14, 30]) days?: number;
}

/** Rôles autorisés à lire les incidents (cf. IncidentsController). */
const INCIDENT_ROLES: string[] = [UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE];

@Controller('dashboard')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: DashboardSummaryQueryDto,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.dashboard.summary(companyId, query.days ?? 7, INCIDENT_ROLES.includes(role));
  }
}
