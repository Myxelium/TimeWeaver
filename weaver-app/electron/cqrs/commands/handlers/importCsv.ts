import { DataSource } from 'typeorm';
import { ImportCsvCommand } from '../../types';
import { Task } from '../../../entities/Task';

interface ParsedRow {
  date: string; // yyyy-MM-dd
  title: string;
  description?: string;
  hours: number;
  created_at?: string;
}

function parseCsv(content: string): ParsedRow[] {
  const lines = content.split(/\r?\n/).filter(l => !!l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('date') && header.includes('title');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: ParsedRow[] = [];
  for (const line of dataLines) {
    // naive CSV split respecting simple quoted commas
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let idx = 0; idx < line.length; idx++) {
      const ch = line[idx];
      if (ch === '"') {
        if (inQuotes && line[idx + 1] === '"') { // escaped quote
          current += '"';
          idx++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    if (cells.length < 4) continue; // need at least date,title,desc,hours
    const [dateRaw, titleRaw, descriptionRaw, hoursRaw, createdRaw] = cells;
    const date = dateRaw.replace(/"/g, '').trim();
    const title = titleRaw.replace(/"/g, '').trim();
    if (!date || !title) continue;
    const hours = parseFloat(hoursRaw.replace(/"/g, '').trim()) || 0;
    const description = (descriptionRaw || '').replace(/"/g, '').trim();
    const created_at = createdRaw ? createdRaw.replace(/"/g, '').trim() : undefined;
    rows.push({ date, title, description, hours, created_at });
  }
  return rows;
}

export async function handleImportCsv(
  command: ImportCsvCommand,
  dataSource: DataSource
): Promise<{ imported: number; updated: number; skipped: number; total: number }> {
  const { contentBase64, overwrite } = command.payload;
  const content = Buffer.from(contentBase64, 'base64').toString('utf8');
  const rows = parseCsv(content);
  const taskRepo = dataSource.getRepository(Task);

  let imported = 0; let updated = 0; let skipped = 0;
  for (const row of rows) {
    // existing match by same date + title (simple heuristic)
    const existing = await taskRepo.findOne({ where: { date: row.date, title: row.title } });
    if (existing) {
      if (overwrite) {
        existing.description = row.description || '';
        existing.hours = row.hours;
        await taskRepo.save(existing);
        updated++;
      } else {
        skipped++;
      }
    } else {
      const entity = taskRepo.create({
        title: row.title,
        description: row.description,
        date: row.date,
        hours: row.hours
      });
      await taskRepo.save(entity);
      imported++;
    }
  }
  return { imported, updated, skipped, total: rows.length };
}
