import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlanningService } from './planning.service';
import { MISSION_STATUSES } from '../missions/entities/mission.entity';

class ListMissionsQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @IsIn(MISSION_STATUSES as unknown as string[])
  status?: string;
}

@Controller('planning')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('missions')
  missions(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: ListMissionsQueryDto,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.planningService.listMissions(companyId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      status: query.status,
    });
  }
}
