import { Injectable } from '@nestjs/common';

/**
 * Générateur PDF minimal (Helvetica, multi-pages) — zéro dépendance externe.
 * Suffisant pour les PV de recette et rapports textuels ; une lib complète
 * (pdfkit) pourra le remplacer si des tableaux complexes deviennent requis.
 */
@Injectable()
export class PdfGeneratorService {
  private readonly pageWidth = 595.28; // A4
  private readonly pageHeight = 841.89;
  private readonly margin = 56;
  private readonly lineHeight = 16;
  private readonly maxY = this.pageHeight - this.margin;

  /** mono : Courier, pour aligner des colonnes par remplissage d'espaces. */
  generate(lines: Array<{ text: string; size?: number; bold?: boolean; mono?: boolean; spaceBefore?: number }>): Buffer {
    const pages: string[][] = [];
    let current: string[] = [];
    let y = this.margin;

    for (const line of lines) {
      const size = line.size ?? 10;
      const font = line.mono ? (line.bold ? '/F4' : '/F3') : line.bold ? '/F2' : '/F1';
      const leading = Math.max(this.lineHeight, size + 6);
      y += line.spaceBefore ?? 0;
      if (y + leading > this.maxY) {
        pages.push(current);
        current = [];
        y = this.margin;
      }
      current.push(
        `BT ${font} ${size} Tf 1 0 0 1 ${this.margin} ${(this.pageHeight - y - size).toFixed(2)} Tm (${this.escape(line.text)}) Tj ET`,
      );
      y += leading;
    }
    pages.push(current);

    const objects: string[] = [];
    const pageCount = pages.length;
    const firstPageObj = 3;

    // 1: catalogue fontes, 2: pages tree, puis 2 objets par page
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    const kids = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i * 2} 0 R`).join(' ');
    objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

    pages.forEach((content, index) => {
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 ${firstPageObj + pageCount * 2} 0 R /F2 ${firstPageObj + pageCount * 2 + 1} 0 R /F3 ${firstPageObj + pageCount * 2 + 2} 0 R /F4 ${firstPageObj + pageCount * 2 + 3} 0 R >> >> /Contents ${firstPageObj + index * 2 + 1} 0 R >>`,
      );
      const stream = content.join('\n');
      objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    });

    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');

    return this.assemble(objects);
  }

  private assemble(objects: string[]): Buffer {
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((obj, index) => {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xrefStart = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, 'binary');
  }

  private escape(text: string): string {
    // WinAnsi approximatif : les accents Latin-1 passent en un octet, le reste est translittéré.
    return text
      .replace(/[\u00A0\u202F\u2009]/g, ' ')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
      .replace(/\u2192/g, '->')
      .replace(/\u2026/g, '...')
      .replace(/[^\x00-\xFF]/g, '?')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }
}
