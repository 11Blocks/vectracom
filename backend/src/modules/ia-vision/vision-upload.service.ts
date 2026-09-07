import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { VisionUpload } from './entities/vision-upload.entity';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'ia-vision');
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export interface Dimensions {
  width: number | null;
  height: number | null;
  format: 'jpeg' | 'png' | 'webp' | 'inconnu';
}

/** Lecture réelle des octets : magic bytes + dimensions (PNG IHDR / JPEG SOF). */
export function inspectImage(buffer: Buffer): Dimensions {
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      format: 'png',
    };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    // Scan des marqueurs SOF (dimensions).
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), format: 'jpeg' };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength <= 0) break;
      offset += 2 + segmentLength;
    }
    return { width: null, height: null, format: 'jpeg' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { width: null, height: null, format: 'webp' };
  }
  return { width: null, height: null, format: 'inconnu' };
}

/**
 * Pré-audit photo : analyse déterministe des octets réels (dimensions,
 * ratio, poids, format) complétée par les indices du nom de fichier.
 * Branchement Gemini possible ensuite — le verdict reste une proposition.
 */
@Injectable()
export class VisionUploadService {
  constructor(
    @InjectRepository(VisionUpload)
    private readonly uploadRepository: Repository<VisionUpload>,
  ) {}

  async audit(
    companyId: string,
    file: Express.Multer.File,
    uploadedBy: string | null,
    missionId?: string,
    note?: string,
  ): Promise<VisionUpload> {
    if (!file || !file.buffer || file.size === 0) throw new BadRequestException('Fichier vide');
    if (file.size > MAX_BYTES) throw new BadRequestException('Fichier trop lourd (8 Mo maximum)');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Format ${file.mimetype} non supporté (JPEG, PNG ou WebP)`);
    }

    const inspected = inspectImage(file.buffer);
    if (inspected.format === 'inconnu') {
      throw new BadRequestException('Contenu image illisible — fichier corrompu ?');
    }

    const flags: string[] = [];
    let score = 95;

    // Nom de fichier : indices de qualité signalés par le terrain.
    const name = decodeURIComponent(file.originalname).toLowerCase();
    if (/flou|blur/.test(name)) { flags.push('nettete_insuffisante'); score -= 60; }
    if (/sombre|dark|nuit/.test(name)) { flags.push('luminosite_faible'); score -= 35; }
    if (/tourne|rotated/.test(name)) { flags.push('cadrage_incline'); score -= 20; }
    if (/selfie|visage/.test(name)) { flags.push('photo_hors_sujet'); score -= 50; }

    // Octets réels : résolution et cadrage.
    if (inspected.width != null && inspected.height != null) {
      const minSide = Math.min(inspected.width, inspected.height);
      if (minSide < 480) { flags.push('resolution_insuffisante'); score -= 60; }
      else if (minSide < 720) { flags.push('resolution_limitee'); score -= 25; }
      const ratio = inspected.width / inspected.height;
      if (ratio > 3 || ratio < 1 / 3) { flags.push('ratio_inhabituel'); score -= 20; }
    } else {
      flags.push('dimensions_illisibles');
      score -= 10;
    }

    if (file.size > 4 * 1024 * 1024) { flags.push('fichier_trop_lourd'); score -= 10; }
    if (inspected.format === 'webp') { flags.push('format_webp_a_verifier'); }

    score = Math.max(0, Math.min(100, score));

    // Persistance du fichier : uploads/ia-vision/<uuid>.<ext> (dédupliqué par hash).
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = inspected.format === 'jpeg' ? 'jpg' : inspected.format === 'png' ? 'png' : 'webp';
    const hash = createHash('sha256').update(file.buffer).digest('hex').slice(0, 16);
    const fileName = `${hash}-${randomUUID().slice(0, 8)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), file.buffer);
    const imageUrl = `/uploads/ia-vision/${fileName}`;

    return this.uploadRepository.save(
      this.uploadRepository.create({
        companyId,
        originalName: file.originalname,
        imageUrl,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        width: inspected.width,
        height: inspected.height,
        verdict: score >= 60 ? 'accepte' : 'a_reprendre',
        score,
        flags,
        note: note ?? null,
        missionId: missionId ?? null,
        uploadedBy,
      }),
    );
  }

  list(companyId: string, verdict?: string) {
    const where: Record<string, unknown> = { companyId };
    if (verdict) where.verdict = verdict;
    return this.uploadRepository.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  async remove(companyId: string, id: string) {
    const upload = await this.uploadRepository.findOne({ where: { companyId, id } });
    if (!upload) throw new NotFoundException('Analyse introuvable');
    const filePath = path.join(process.cwd(), upload.imageUrl.replace(/^\//, ''));
    try {
      if (upload.imageUrl.startsWith('/uploads/') && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Fichier déjà absent : on supprime l'enregistrement quand même.
    }
    await this.uploadRepository.remove(upload);
    return { deleted: true };
  }
}
