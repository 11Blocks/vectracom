import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RagChatService } from './rag-chat.service';
import { RAG_DOC_CATEGORIES } from './entities/rag-document.entity';

class AskDto {
  @IsString() @MinLength(3) question!: string;
  @IsOptional() @IsUUID() conversationId?: string;
}

class IngestDocumentDto {
  @IsString() @MinLength(3) title!: string;

  @IsIn(RAG_DOC_CATEGORIES as unknown as string[])
  category!: string;

  @IsString() @MinLength(10) content!: string;

  @IsOptional() @IsString() fileName?: string;
}

/** Dashboard RAG — option payante (licence RAG vérifiée par le service). */
@Controller('rag')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class RagChatController {
  constructor(private readonly rag: RagChatService) {}

  @Post('ask')
  ask(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: AskDto,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.rag.ask(companyId, userId, dto.question, dto.conversationId);
  }

  // ── Base documentaire (retrieval par morceaux, sources citées) ──

  @Get('documents')
  documents(@CurrentUser('companyId') companyId: string | null) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.rag.listDocuments(companyId);
  }

  @Post('documents')
  ingestDocument(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: IngestDocumentDto,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.rag.ingestDocument(companyId, userId, dto);
  }

  @Delete('documents/:id')
  deleteDocument(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.rag.deleteDocument(companyId, id);
  }

  @Get('search')
  search(@CurrentUser('companyId') companyId: string | null, @Query('q') q: string) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    if (!q || q.trim().length < 3) throw new BadRequestException('Requête trop courte');
    return this.rag.retrieve(companyId, q, 8);
  }

  @Get('conversations')
  conversations(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.rag.listConversations(companyId, userId);
  }

  @Get('conversations/:id')
  conversation(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.rag.getConversation(companyId, userId, id);
  }

  @Delete('conversations/:id')
  deleteConversation(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.rag.deleteConversation(companyId, userId, id);
  }
}
