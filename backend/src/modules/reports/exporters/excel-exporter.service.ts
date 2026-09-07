import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ReportSection } from '../reports.service';

/** Export Excel des rapports (analyse interne) — une feuille par section. */
@Injectable()
export class ExcelExporterService {
  export(title: string, sections: ReportSection[]): { buffer: Buffer; fileName: string } {
    const book = XLSX.utils.book_new();
    for (const section of sections) {
      const sheet = XLSX.utils.json_to_sheet(section.rows.length > 0 ? section.rows : [{ Info: '(vide)' }]);
      XLSX.utils.book_append_sheet(book, sheet, section.name.slice(0, 31));
    }
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return { buffer, fileName: `rapport-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx` };
  }
}
