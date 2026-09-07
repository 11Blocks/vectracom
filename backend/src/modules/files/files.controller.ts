import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { FilesService, UPLOAD_CATEGORIES, UploadCategory } from './files.service';

@Controller('files')
@Roles(
  UserRole.ADMIN,
  UserRole.DIRECTION,
  UserRole.CHEF_EQUIPE,
  UserRole.MAGASINIER,
)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category?: string,
  ) {
    if (!file) throw new BadRequestException('Champ « file » requis');
    const cat = (category || 'docs') as UploadCategory;
    if (!UPLOAD_CATEGORIES.includes(cat)) {
      throw new BadRequestException(`Catégorie invalide. Attendu : ${UPLOAD_CATEGORIES.join(', ')}`);
    }
    return this.files.store(file, cat);
  }
}
