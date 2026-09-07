import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { BusinessMonitoringService } from './business.service';

class TenantQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

/** Console Green-T : KPI business SaaS (super_admin / finance_admin). */
@Controller('business')
@Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
export class BusinessController {
  constructor(private readonly businessService: BusinessMonitoringService) {}

  @Get('dashboard')
  dashboard() {
    return this.businessService.getBusinessDashboard();
  }

  @Get('mrr')
  async mrr(@Query() query: TenantQueryDto) {
    return { mrr: await this.businessService.calculateMRR(query.companyId) };
  }

  @Get('arr')
  async arr(@Query() query: TenantQueryDto) {
    return { arr: await this.businessService.calculateARR(query.companyId) };
  }

  @Get('churn')
  async churn(@Query() query: TenantQueryDto) {
    return { churn: await this.businessService.calculateChurn(query.companyId) };
  }

  @Get('nrr')
  async nrr(@Query() query: TenantQueryDto) {
    return this.businessService.calculateNRR(query.companyId);
  }

  @Get('arpu')
  async arpu(@Query() query: TenantQueryDto) {
    return this.businessService.calculateARPU(query.companyId);
  }

  @Get('ltv')
  async ltv(@Query() query: TenantQueryDto) {
    return this.businessService.calculateLTV(query.companyId);
  }

  @Get('cac')
  async cac(@Query() query: TenantQueryDto) {
    return this.businessService.calculateCAC(query.companyId);
  }
}
