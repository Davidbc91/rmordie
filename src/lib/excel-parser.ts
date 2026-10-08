import * as XLSX from "xlsx";

export type Block = {
  key: string;   // "ZONA MEDIA" | "MOBILITY" | "WARM UP" | "A" | "B" | "C" | "D"
  content: string;
};

export type Day = {
  key: string;   // "LUNES" | "MARTES" | ...
  blocks: Block[];
  isRest: boolean;
  /** Fecha exacta del entrenamiento cuando el origen la proporciona. YYYY-MM-DD. */
  date?: string;
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

function orderMonthNumber(monKey: string) {
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const index = months.indexOf(monKey);
  return index >= 0 ? index + 1 : undefined;
}

function dayKey(v: unknown) {
  const n = norm(v);
  const first = n.split(/\r?\n/)[0].trim();
  const match = first.match(/^(LUNES|MARTES|MIERCOLES|MIÉRCOLES|JUEVES|VIERNES|SABADO|SÁBADO|DOMINGO)\b/i);
  if (!match) return "";
  return match[1].toUpperCase().replace("MIÉRCOLES", "MIERCOLES").replace("SÁBADO", "SABADO");
}

function isDay(v: unknown) {
  return Boolean(dayKey(v));
}

function extractExplicitDate(v: unknown, year?: number) {
  const text = String(v ?? "").replace(/\r/g, "");
  const match = text.match(/(?:^|\n)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/m);
  if (!match) return undefined;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const rawYear = match[3];
  const fullYear = rawYear
    ? (rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear))
    : year;
  if (!fullYear || fullYear < 2000 || fullYear > 2100) return undefined;
  return `${fullYear}-${month}-${day}`;
}

function sheetYear(rows: unknown[][]) {
  for (const row of rows.slice(0, 6)) {
    for (const value of row ?? []) {
      const match = String(value ?? "").match(/\b(20\d{2})\b/);
      if (match) return Number(match[1]);
    }
  }
  return undefined;
}
function isWeekHeader(v: unknown) {
  return /^SEMANA\s*\d+/i.test(String(v ?? "").trim());
}
function isRestContent(s: string) {
  const n = s.trim().toUpperCase();
  return n === "" || n === "-" || n === "REST" || n.startsWith("REST");
}

export function parsePlanningFromArrayBuffer(buf: ArrayBuffer): Planning {
  const wb = XLSX.read(buf, { type: "array", dense: true, nodim: true });
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

    // Los hipervínculos de Excel viven en el objeto celda (cell.l.Target) o en
    // fórmulas HYPERLINK(), no en el texto. Una misma celda (o celda combinada)
    // puede tener varios: los recogemos todos.
    const links = new Map<string, string[]>();
    const addLink = (r: number, c: number, url: string | undefined) => {
      if (!url) return;
      const clean = url.trim();
      if (!/^https?:\/\//i.test(clean)) return;
      const key = `${r}|${c}`;
      const list = links.get(key) ?? [];
      if (!list.includes(clean)) list.push(clean);
      links.set(key, list);
    };

    const refRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"] as string) : null;
    if (refRange) {
      for (let R = refRange.s.r; R <= refRange.e.r; R++) {
        for (let C = refRange.s.c; C <= refRange.e.c; C++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })] as
            | { l?: { Target?: string }; f?: string; h?: string }
            | undefined;
          if (!cell) continue;
          addLink(R, C, cell.l?.Target);
          // Fórmulas =HYPERLINK("url";"texto") — puede haber varias concatenadas
          if (cell.f) {
            for (const m of cell.f.matchAll(/HYPERLINK\(\s*"([^"]+)"/gi)) addLink(R, C, m[1]);
          }
          // Texto enriquecido renderizado a HTML con anclas
          if (cell.h) {
            for (const m of cell.h.matchAll(/href\s*=\s*"([^"]+)"/gi)) addLink(R, C, m[1]);
          }
        }
      }
    }

    // Celdas combinadas: los enlaces de cualquier celda del rango pertenecen a
    // la celda ancla (arriba-izquierda), que es la que aporta el contenido.
    const merges = (ws["!merges"] as XLSX.Range[] | undefined) ?? [];
    for (const mg of merges) {
      for (let R = mg.s.r; R <= mg.e.r; R++) {
        for (let C = mg.s.c; C <= mg.e.c; C++) {
          if (R === mg.s.r && C === mg.s.c) continue;
          const list = links.get(`${R}|${C}`);
          if (!list) continue;
          for (const url of list) addLink(mg.s.r, mg.s.c, url);
          links.delete(`${R}|${C}`);
        }
      }
    }

    const withLink = (r: number, c: number, content: string) => {
      const urls = links.get(`${r}|${c}`);
      if (!urls || urls.length === 0) return content;
      const missing = urls.filter((u) => !content.includes(u));
      if (missing.length === 0) return content;
      return content ? `${content}\n${missing.join("\n")}` : missing.join("\n");
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
    const explicitYear = sheetYear(rows);

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
      const dayCols: { key: string; col: number; date?: string }[] = [];
      for (let c = w.start; c < w.end; c++) {
        const key = dayKey(dayRow[c]);
        if (key) {
          dayCols.push({
            key,
            col: c,
            date: extractExplicitDate(dayRow[c], explicitYear),
          });
        }
      }
      // Collect blocks: first column of each row is block label, unless empty
      const days: Day[] = dayCols.map((d) => ({
        key: d.key,
        blocks: [],
        isRest: false,
        ...(d.date ? { date: d.date } : {}),
      }));

      for (let r = dataStartRow; r < rows.length; r++) {
        const rawLabel = rows[r]?.[0];
        const label = String(rawLabel ?? "").trim();
        if (!label) continue;
        // The template contains explanatory notes after the actual workout rows.
        // They must not become workout blocks.
        const labelNorm = norm(label);
        if (labelNorm === "ORDEN DE EJECUCIÓN" || labelNorm.startsWith("ORDEN DE EJECUCIÓN")) break;
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

      // Some Team Vader sheets intentionally omit Sundays from the day header row
      // and state that Sundays are rest days in the notes below the template.
      // When that rule is explicit and the sheet provides a year, materialize the
      // missing Sunday as an exact rest day so the calendar and planning view stay accurate.
      const hasSundayRestRule = rows.some((row) =>
        row?.some((value) => /DESCANSO/i.test(String(value ?? "")) && /DOMINGO/i.test(String(value ?? ""))),
      );
      if (hasSundayRestRule && explicitYear) {
        const monthNumber = orderMonthNumber(monKey);
        if (monthNumber) {
          const first = new Date(Date.UTC(explicitYear, monthNumber - 1, 1));
          const lastDay = new Date(Date.UTC(explicitYear, monthNumber, 0)).getUTCDate();
          const weekForDate = (day: number) => {
            const weekdayMonday = (first.getUTCDay() + 6) % 7;
            return Math.floor((weekdayMonday + day - 1) / 7) + 1;
          };
          const sunday = Array.from({ length: lastDay }, (_, i) => i + 1).find(
            (day) => weekForDate(day) === w.index && new Date(Date.UTC(explicitYear, monthNumber - 1, day)).getUTCDay() === 0,
          );
          if (sunday) {
            const date = `${explicitYear}-${String(monthNumber).padStart(2, "0")}-${String(sunday).padStart(2, "0")}`;
            const exists = days.some((day) => day.date === date);
            if (!exists) {
              days.push({
                key: "DOMINGO",
                blocks: [{ key: "DESCANSO", content: "Descanso" }],
                isRest: true,
                date,
              });
            }
          }
        }
      }

      return { index: w.index, days };
    });

    months.push({ key: sheetName, label, order, weeks });
  }

  months.sort((a, b) => a.order - b.order);
  return { months, importedAt: new Date().toISOString() };
}
