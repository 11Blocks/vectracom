import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TEAM_TYPES } from './entities/team.entity';

class ListTeamsQueryDto {
  @IsOptional() @IsString() @IsIn(TEAM_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsBooleanString() active?: string;
}

@Controller('teams')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query() query: ListTeamsQueryDto) {
    this.requireTenant(companyId);
    return this.teamsService.list(companyId!, {
      type: query.type,
      zone: query.zone,
      active: query.active === undefined ? undefined : query.active === 'true',
    });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateTeamDto) {
    this.requireTenant(companyId);
    return this.teamsService.create(companyId!, dto);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.teamsService.findOne(companyId!, id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    this.requireTenant(companyId);
    return this.teamsService.update(companyId!, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.teamsService.remove(companyId!, id);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
