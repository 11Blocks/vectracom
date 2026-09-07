import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const UPLOAD_CATEGORIES = [
  'docs',
  'receipts',
  'vehicles',
  'compliance',
  'hr',
  'missions',
  'logos',
] as const;
export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number];

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function extFromMime(mime: string, original: string): string {
  const fromName = path.extname(original).replace('.', '').toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  return map[mime] ?? 'bin';
}

@Injectable()
export class FilesService {
  store(file: Express.Multer.File, category: UploadCategory = 'docs') {
    if (!file?.buffer?.length) throw new BadRequestException('Fichier vide');
    if (file.size > MAX_BYTES) throw new BadRequestException('Fichier trop lourd (12 Mo max)');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Type non supporté : ${file.mimetype}`);
    }
    if (!UPLOAD_CATEGORIES.includes(category)) {
      throw new BadRequestException(`Catégorie invalide : ${category}`);
    }

    const dir = path.join(process.cwd(), 'uploads', category);
    fs.mkdirSync(dir, { recursive: true });
    const hash = createHash('sha256').update(file.buffer).digest('hex').slice(0, 16);
    const ext = extFromMime(file.mimetype, file.originalname);
    const fileName = `${hash}-${randomUUID().slice(0, 8)}.${ext}`;
    fs.writeFileSync(path.join(dir, fileName), file.buffer);
    const url = `/uploads/${category}/${fileName}`;

    return {
      url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      category,
    };
  }
}
