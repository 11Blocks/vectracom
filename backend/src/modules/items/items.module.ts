import { BadRequestException, Body, Controller, Get, Post, Put, Param } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Item, ITEM_CODES, TeamRoleComposition } from './entities/item.entity';
import { findCompositionProblems, findMissionTypeProblems, normalizeComposition } from './item-validation';

class CreateItemDto {
  @IsIn(ITEM_CODES as unknown as string[])
  code!: string;

  @IsString() @MinLength(2)
  label!: string;

  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsArray() missionTypes?: string[];

  @IsOptional() @IsArray() teamComposition?: TeamRoleComposition[];
}

class UpdateItemDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsArray() missionTypes?: string[];
  @IsOptional() @IsArray() teamComposition?: TeamRoleComposition[];
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('items')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class ItemsController {
  constructor(
    @InjectRepository(Item)
    private readonly repo: Repository<Item>,
  ) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.repo.find({ where: { companyId: companyId! }, order: { code: 'ASC' } });
  }

  @Post()
  async create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateItemDto) {
    this.requireTenant(companyId);
    const code = dto.code.trim().toUpperCase() as Item['code'];
    if (await this.repo.findOne({ where: { companyId: companyId!, code } })) {
      throw new BadRequestException(`L'item « ${code} » existe déjà`);
    }
    const missionTypes = dto.missionTypes ?? [];
    const teamComposition = dto.teamComposition ?? [];
    await this.validate(companyId!, null, missionTypes, teamComposition);
    return this.repo.save(
      this.repo.create({
        companyId: companyId!,
        code,
        label: dto.label.trim(),
        description: dto.description ?? null,
        missionTypes,
        teamComposition: normalizeComposition(teamComposition),
      }),
    );
  }

  @Put(':id')
  async update(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    this.requireTenant(companyId);
    const item = await this.repo.findOne({ where: { companyId: companyId!, id } });
    if (!item) throw new BadRequestException('Item introuvable');
    await this.validate(
      companyId!,
      item.id,
      dto.missionTypes ?? null,
      dto.teamComposition ?? null,
    );
    if (dto.label !== undefined) item.label = dto.label;
    if (dto.description !== undefined) item.description = dto.description;
    if (dto.missionTypes !== undefined) item.missionTypes = dto.missionTypes;
    if (dto.teamComposition !== undefined) item.teamComposition = normalizeComposition(dto.teamComposition);
    if (dto.active !== undefined) item.active = dto.active;
    return this.repo.save(item);
  }

  /**
   * ITM-1 : types de mission (liste fermée, sans doublon, un seul item par type
   * dans le tenant) et composition d'équipe (rôles connus, sans doublon, effectif
   * 1–50). Une valeur `null` = champ non modifié, donc non revalidé.
   */
  private async validate(
    companyId: string,
    selfId: string | null,
    missionTypes: string[] | null,
    teamComposition: TeamRoleComposition[] | null,
  ): Promise<void> {
    const problems: string[] = [];
    if (missionTypes !== null) {
      const others = await this.repo.find({ where: { companyId } });
      problems.push(...findMissionTypeProblems(missionTypes, selfId, others));
    }
    if (teamComposition !== null) problems.push(...findCompositionProblems(teamComposition));
    if (problems.length) throw new BadRequestException(problems.join(' ; '));
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Item])],
  controllers: [ItemsController],
  exports: [TypeOrmModule],
})
export class ItemsModule {}
