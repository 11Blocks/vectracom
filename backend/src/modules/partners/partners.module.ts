import { BadRequestException, Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from '@nestjs/common';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Partner, PRICE_GRIDS } from './entities/partner.entity';

class CreatePartnerDto {
  @IsString() @MinLength(2) code!: string;

  @IsString() @MinLength(2) name!: string;

  @IsOptional() @IsString() description?: string;

  @IsIn(PRICE_GRIDS as unknown as string[])
  priceGrid!: string;

  @IsOptional() @IsString() exclusiveZone?: string;
}

class UpdatePartnerDto {
  @IsOptional() @IsString() name?: string;

  @IsOptional() @IsString() description?: string | null;

  @IsOptional()
  @IsIn(PRICE_GRIDS as unknown as string[])
  priceGrid?: string;

  @IsOptional() @IsString() exclusiveZone?: string | null;

  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('partners')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class PartnersController {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
  ) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.partnerRepository.find({ where: { companyId: companyId! }, order: { name: 'ASC' } });
  }

  @Post()
  async create(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: CreatePartnerDto,
  ) {
    this.requireTenant(companyId);
    const code = dto.code.trim().toUpperCase();
    const existing = await this.partnerRepository.findOne({ where: { companyId: companyId!, code } });
    if (existing) throw new BadRequestException(`Le partenaire « ${code} » existe déjà`);
    return this.partnerRepository.save(
      this.partnerRepository.create({
        companyId: companyId!,
        code,
        name: dto.name.trim(),
        description: dto.description ?? null,
        priceGrid: dto.priceGrid as Partner['priceGrid'],
        exclusiveZone: dto.exclusiveZone ?? null,
      }),
    );
  }

  @Put(':id')
  async update(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdatePartnerDto,
  ) {
    this.requireTenant(companyId);
    const partner = await this.partnerRepository.findOne({ where: { companyId: companyId!, id } });
    if (!partner) throw new BadRequestException('Partenaire introuvable');
    if (dto.name !== undefined) partner.name = dto.name;
    if (dto.description !== undefined) partner.description = dto.description;
    if (dto.priceGrid !== undefined) partner.priceGrid = dto.priceGrid as Partner['priceGrid'];
    if (dto.exclusiveZone !== undefined) partner.exclusiveZone = dto.exclusiveZone;
    if (dto.active !== undefined) partner.active = dto.active;
    return this.partnerRepository.save(partner);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Partner])],
  controllers: [PartnersController],
  exports: [TypeOrmModule],
})
export class PartnersModule {}
