import { Injectable } from '@nestjs/common';
import { PdfGeneratorService } from '../../../common/pdf/pdf-generator.service';
import { ReportSection } from '../reports.service';

type PdfLine = { text: string; size?: number; bold?: boolean; spaceBefore?: number };

/** Export PDF des rapports (format présentation direction/SONATEL). */
@Injectable()
export class PdfExporterService {
  constructor(private readonly pdf: PdfGeneratorService) {}

  export(title: string, period: string, sections: ReportSection[]): { buffer: Buffer; fileName: string } {
    const lines: PdfLine[] = [
      { text: 'VECTRACOM', size: 16, bold: true },
      { text: title, size: 14, bold: true, spaceBefore: 4 },
      { text: period, size: 10, spaceBefore: 4 },
    ];

    for (const section of sections) {
      lines.push({ text: section.name, size: 12, bold: true, spaceBefore: 12 });
      if (section.rows.length === 0) {
        lines.push({ text: '(vide)', size: 9 });
        continue;
      }
      const columns = Object.keys(section.rows[0]);
      lines.push({ text: columns.join('   |   '), size: 9, bold: true });
      for (const row of section.rows) {
        lines.push({
          text: columns.map((c) => String(row[c] ?? '')).join('   |   ').slice(0, 110),
          size: 9,
        });
      }
    }

    const buffer = this.pdf.generate(lines);
    return { buffer, fileName: `rapport-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf` };
  }
}
