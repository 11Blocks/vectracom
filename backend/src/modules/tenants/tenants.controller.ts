import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { COMPANY_SUBSCRIPTION_STATUSES, CompanySubscriptionStatus } from '../auth/entities/company.entity';
import { IsBoolean, IsIn } from 'class-validator';

class SetActiveDto {
  @IsBoolean()
  active!: boolean;
}

class SetSubscriptionStatusDto {
  @IsIn(COMPANY_SUBSCRIPTION_STATUSES as unknown as string[])
  status!: CompanySubscriptionStatus;
}

@Controller('tenants')
@Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  list() {
    return this.tenantsService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.tenantsService.setActive(id, dto.active);
  }

  @Patch(':id/subscription-status')
  setSubscriptionStatus(@Param('id') id: string, @Body() dto: SetSubscriptionStatusDto) {
    return this.tenantsService.setSubscriptionStatus(id, dto.status);
  }
}
