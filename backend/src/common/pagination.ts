import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Response } from 'express';

/**
 * Pagination des listes : ?limit=&offset=. Le corps reste un tableau (compatibilité mobile) ;
 * le nombre total de lignes correspondant aux filtres est renvoyé dans l'en-tête X-Total-Count.
 */
export const TOTAL_COUNT_HEADER = 'X-Total-Count';

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export function pageParams(q: { limit?: number; offset?: number }, defaultLimit: number, maxLimit = 5000) {
  return { take: Math.min(q.limit ?? defaultLimit, maxLimit), skip: q.offset ?? 0 };
}

export function withTotal<T>(res: Response, [items, total]: [T[], number]): T[] {
  res.setHeader(TOTAL_COUNT_HEADER, String(total));
  return items;
}
