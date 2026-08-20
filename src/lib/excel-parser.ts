import * as XLSX from "xlsx";

export type Block = {
  key: string;   // "ZONA MEDIA" | "MOBILITY" | "WARM UP" | "A" | "B" | "C" | "D"
  content: string;
};

export type Day = {
  key: string;   // "LUNES" | "MARTES" | ...
  blocks: Block[];
  isRest: boolean;
};

export type Week = {
  index: number; // 1..N (order in sheet)
  days: Day[];
};

export type Month = {
  key: string;    // "1. NOV"
  label: string;  // "Noviembre"
  order: number;  // 1..N
  weeks: Week[];
};

export type Planning = {
  months: Month[];
  importedAt: string;
};

const DAY_ORDER = ["LUNES", "MARTES", "MIERCOLES", "MIÉRCOLES", "JUEVES", "VIERNES", "SABADO", "SÁBADO", "DOMINGO"];
const MONTH_NAMES: Record<string, string> = {
  ENE: "Enero", FEB: "Febrero", MAR: "Marzo", ABR: "Abril", MAY: "Mayo", JUN: "Junio",
  JUL: "Julio", AGO: "Agosto", SEP: "Septiembre", OCT: "Octubre", NOV: "Noviembre", DIC: "Diciembre",
};

const norm = (s: unknown) => String(s ?? "").trim().toUpperCase();

function isDay(v: unknown) {
  const n = norm(v);
  return DAY_ORDER.includes(n);
}
function isWeekHeader(v: unknown) {
  return /^SEMANA\s*\d+/i.test(String(v ?? "").trim());
}
function isRestContent(s: string) {
  const n = s.trim().toUpperCase();
  return n === "" || n === "-" || n === "REST" || n.startsWith("REST");
}

export function parsePlanningFromArrayBuffer(buf: ArrayBuffer): Planning {
  const wb = XLSX.read(buf, { type: "array" });
  const months: Month[] = [];

  for (const sheetName of wb.SheetNames) {
    // Month sheets look like "1. NOV", "2. DIC", ...
    const m = sheetName.match(/^(\d+)\.\s*([A-ZÁÉÍÓÚÑ]+)/i);
    if (!m) continue;

    const order = Number(m[1]);
    const monKey = m[2].toUpperCase().slice(0, 3);
    const label = MONTH_NAMES[monKey] ?? sheetName;

    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: true });

    // Excel hyperlinks live on the cell object (cell.l.Target), not in the text.
    // Collect them so we can append the URL to the cell content.
    const links = new Map<string, string>();
    const refRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"] as string) : null;
    if (refRange) {
      for (let R = refRange.s.r; R <= refRange.e.r; R++) {
        for (let C = refRange.s.c; C <= refRange.e.c; C++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })] as
            | { l?: { Target?: string } }
            | undefined;
          const target = cell?.l?.Target;
          if (target && /^https?:\/\//i.test(target)) links.set(`${R}|${C}`, target);
        }
      }
    }
    const withLink = (r: number, c: number, content: string) => {
      const url = links.get(`${r}|${c}`);
      if (!url) return content;
      if (content.includes(url)) return content;
      return content ? `${content}\n${url}` : url;
    };

    // Row 0 typically has "SEMANA 1", "", ..., "SEMANA 2", ...
    // Row 1 has day headers repeated per week
    // Rows 2..N: first col is block label; other cols are content
    if (rows.length < 3) continue;

    // Locate the SEMANA header row and the day row dynamically (some sheets
    // have blank leading rows, so we can't assume row 0/1).
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      if ((rows[r] ?? []).some(isWeekHeader)) { headerRowIdx = r; break; }
    }
    let dayRowIdx = -1;
    const dayScanStart = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
    for (let r = dayScanStart; r < Math.min(rows.length, dayScanStart + 5); r++) {
      if ((rows[r] ?? []).some(isDay)) { dayRowIdx = r; break; }
    }
    if (dayRowIdx < 0) continue;
    if (headerRowIdx < 0) headerRowIdx = dayRowIdx;

    const headerRow = rows[headerRowIdx] ?? [];
    const dayRow = rows[dayRowIdx] ?? [];
    const dataStartRow = dayRowIdx + 1;

    // Detect week column ranges from headerRow
    const weekStarts: { index: number; col: number }[] = [];
    for (let c = 0; c < headerRow.length; c++) {
      if (isWeekHeader(headerRow[c])) {
        const wm = String(headerRow[c]).match(/(\d+)/);
        weekStarts.push({ index: wm ? Number(wm[1]) : weekStarts.length + 1, col: c });
      }
    }
    if (weekStarts.length === 0) {
      // Fallback: detect from day row groupings
      let cur = -1;
      for (let c = 0; c < dayRow.length; c++) {
        if (norm(dayRow[c]) === "LUNES") {
          cur++;
          weekStarts.push({ index: cur + 1, col: c });
        }
      }
    }

    // Compute [start,end) col ranges per week
    const weekRanges = weekStarts.map((w, i) => ({
      index: w.index,
      start: w.col,
      end: i + 1 < weekStarts.length ? weekStarts[i + 1].col : Math.max(headerRow.length, dayRow.length),
    }));

    // Build day column map per week
    const weeks: Week[] = weekRanges.map((w) => {
      const dayCols: { key: string; col: number }[] = [];
      for (let c = w.start; c < w.end; c++) {
        if (isDay(dayRow[c])) {
          const k = norm(dayRow[c]).replace("MIÉRCOLES", "MIERCOLES").replace("SÁBADO", "SABADO");
          dayCols.push({ key: k, col: c });
        }
      }
      // Collect blocks: first column of each row is block label, unless empty
      const days: Day[] = dayCols.map((d) => ({ key: d.key, blocks: [], isRest: false }));

      for (let r = dataStartRow; r < rows.length; r++) {
        const rawLabel = rows[r]?.[0];
        const label = String(rawLabel ?? "").trim();
        if (!label) continue;
        // Skip if label looks like another header
        if (isWeekHeader(label) || isDay(label)) continue;
        const blockKey = label.toUpperCase();

        dayCols.forEach((d, di) => {
          const raw = rows[r]?.[d.col];
          const content = withLink(r, d.col, String(raw ?? "").trim());
          if (content) {
            days[di].blocks.push({ key: blockKey, content });
          }
        });
      }

      // Mark rest days (empty or all "-"/"REST"/"REST Y MOVILIDAD")
      days.forEach((d) => {
        const total = d.blocks.length;
        const restLike = d.blocks.filter((b) => isRestContent(b.content)).length;
        d.isRest = total === 0 || restLike === total || d.blocks.every((b) => /REST/i.test(b.content));
      });

      return { index: w.index, days };
    });

    months.push({ key: sheetName, label, order, weeks });
  }

  months.sort((a, b) => a.order - b.order);
  return { months, importedAt: new Date().toISOString() };
}
