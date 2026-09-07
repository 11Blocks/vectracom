import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TechniciansService } from './technicians.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
import { COMPETENCE_DOMAINS } from './entities/technician.entity';

class ListTechniciansQueryDto {
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() @IsIn(COMPETENCE_DOMAINS as unknown as string[]) competence?: string;
  @IsOptional() @IsBooleanString() leadersOnly?: string;
  @IsOptional() @IsBooleanString() active?: string;
}

@Controller('technicians')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query() query: ListTechniciansQueryDto) {
    this.requireTenant(companyId);
    return this.techniciansService.list(companyId!, {
      teamId: query.teamId,
      competence: query.competence,
      leadersOnly: query.leadersOnly === 'true',
      active: query.active === undefined ? undefined : query.active === 'true',
    });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateTechnicianDto) {
    this.requireTenant(companyId);
    return this.techniciansService.create(companyId!, dto);
  }

  @Get('leaders')
  leaders(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.techniciansService.list(companyId!, { leadersOnly: true });
  }

  @Get('by-team/:teamId')
  byTeam(
    @CurrentUser('companyId') companyId: string | null,
    @Param('teamId') teamId: string,
  ) {
    this.requireTenant(companyId);
    return this.techniciansService.byTeam(companyId!, teamId);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.techniciansService.findOne(companyId!, id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianDto,
  ) {
    this.requireTenant(companyId);
    return this.techniciansService.update(companyId!, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.techniciansService.remove(companyId!, id);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
