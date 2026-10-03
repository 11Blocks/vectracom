import { BadRequestException, Body, Controller, Get, Post, Put, Param } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Zone } from './entities/zone.entity';
import { Pilote, PILOTE_TYPES } from './entities/pilote.entity';

class CreateZoneDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() code?: string;
}
class UpdateZoneDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('zones')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class ZonesController {
  constructor(@InjectRepository(Zone) private readonly repo: Repository<Zone>) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.repo.find({ where: { companyId: companyId! }, order: { name: 'ASC' } });
  }

  @Post()
  async create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateZoneDto) {
    this.requireTenant(companyId);
    const name = dto.name.trim();
    if (await this.repo.findOne({ where: { companyId: companyId!, name } })) {
      throw new BadRequestException(`La zone « ${name} » existe déjà`);
    }
    return this.repo.save(this.repo.create({ companyId: companyId!, name, code: dto.code ?? null }));
  }

  @Put(':id')
  async update(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: UpdateZoneDto) {
    this.requireTenant(companyId);
    const zone = await this.repo.findOne({ where: { companyId: companyId!, id } });
    if (!zone) throw new BadRequestException('Zone introuvable');
    if (dto.name !== undefined) zone.name = dto.name;
    if (dto.code !== undefined) zone.code = dto.code;
    if (dto.active !== undefined) zone.active = dto.active;
    return this.repo.save(zone);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

class CreatePiloteDto {
  @IsString() @MinLength(2) name!: string;
  @IsIn(PILOTE_TYPES as unknown as string[]) type!: string;
  @IsOptional() @IsString() partnerId?: string;
}
class UpdatePiloteDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(PILOTE_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsString() partnerId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('pilotes')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class PilotesController {
  constructor(@InjectRepository(Pilote) private readonly repo: Repository<Pilote>) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.repo.find({ where: { companyId: companyId! }, order: { name: 'ASC' } });
  }

  @Post()
  async create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreatePiloteDto) {
    this.requireTenant(companyId);
    return this.repo.save(
      this.repo.create({
        companyId: companyId!,
        name: dto.name.trim(),
        type: dto.type as Pilote['type'],
        partnerId: dto.partnerId ?? null,
      }),
    );
  }

  @Put(':id')
  async update(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: UpdatePiloteDto) {
    this.requireTenant(companyId);
    const pilote = await this.repo.findOne({ where: { companyId: companyId!, id } });
    if (!pilote) throw new BadRequestException('Pilote introuvable');
    if (dto.name !== undefined) pilote.name = dto.name;
    if (dto.type !== undefined) pilote.type = dto.type as Pilote['type'];
    if (dto.partnerId !== undefined) pilote.partnerId = dto.partnerId;
    if (dto.active !== undefined) pilote.active = dto.active;
    return this.repo.save(pilote);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Zone, Pilote])],
  controllers: [ZonesController, PilotesController],
  exports: [TypeOrmModule],
})
export class TerritoryModule {}
