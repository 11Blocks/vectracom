import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { Roles, UserRole } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ColumnMappingService } from './column-mapping.service';
import { ColumnMappingDto } from './dto/column-mapping.dto';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReplaceMappingsBodyDto {
  @ValidateNested({ each: true })
  @Type(() => ColumnMappingDto)
  @IsArray()
  @ArrayNotEmpty()
  mappings!: ColumnMappingDto[];
}

@Controller('planning/import/mappings')
@Roles(UserRole.ADMIN)
export class ColumnMappingController {
  constructor(private readonly mappingService: ColumnMappingService) {}

  /** Mapping effectif du tenant (ses règles, sinon les défauts SONATEL). */
  @Get()
  get(@CurrentUser('companyId') companyId: string | null) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.mappingService.getEffective(companyId);
  }

  /** Remplace le mapping d'un onglet pour ce tenant. */
  @Put()
  async replace(
    @CurrentUser('companyId') companyId: string | null,
    @Body() body: ReplaceMappingsBodyDto,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    const planning = body.mappings.filter((m) => m.sheetType === 'planning');
    const affect = body.mappings.filter((m) => m.sheetType === 'affect');

    if (planning.length > 0) {
      await this.mappingService.replace(companyId, 'planning', planning);
    }
    if (affect.length > 0) {
      await this.mappingService.replace(companyId, 'affect', affect);
    }
    return this.mappingService.getEffective(companyId);
  }
}
