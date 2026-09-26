import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

class UpdateCompanyProfileDto {
  @IsOptional() @IsString() @MaxLength(120) contactName?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== '' && v !== null) @IsEmail() contactEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(250) address?: string | null;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
  @IsOptional() @IsString() @MaxLength(40) ninea?: string | null;
  @IsOptional() @IsString() @MaxLength(60) rccm?: string | null;
  @IsOptional() @IsString() @MaxLength(120) bankName?: string | null;
  @IsOptional() @IsString() @MaxLength(80) bankAccount?: string | null;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(600) invoiceFooter?: string | null;
}

@Controller('company-profile')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class CompanyProfileController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.settings.getCompanyProfile(companyId!);
  }

  @Put()
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string | undefined,
    @Body() dto: UpdateCompanyProfileDto,
  ) {
    this.requireTenant(companyId);
    return this.settings.updateCompanyProfile(companyId!, dto, { userId, userEmail: userEmail ?? null });
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
