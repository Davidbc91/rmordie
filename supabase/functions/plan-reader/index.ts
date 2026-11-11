// Lector inteligente de planificaciones: recibe el contenido de cualquier
// archivo (texto de Excel/CSV/PDF/WhatsApp o fotos) y devuelve las sesiones
// con fecha, día y bloques, tal cual vienen escritas. Usa Lovable AI.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Body = {
  text?: string;
  images?: string[]; // data URLs
  filename?: string;
  today?: string; // YYYY-MM-DD
  part?: number;
  parts?: number;
  hint?: string;
};

const SYSTEM = `Eres el lector de planificaciones de RM OR DIE, una app de CrossFit y fuerza en español.
Te llega una planificación de entrenamiento en CUALQUIER formato: tablas de Excel convertidas a texto (celdas separadas por " | ", filas por saltos de línea, con su hoja), PDFs, fotos de una pizarra o de un papel, capturas de WhatsApp, programaciones de coach en inglés o español, por semanas, por meses, por días sueltos, por columnas o por filas.

Tu trabajo: sacar CADA sesión de entrenamiento y devolverla con la función save_plan.

Reglas:
- Fidelidad total. Copia los ejercicios, series, repeticiones, porcentajes, cargas, tiempos, rondas, descansos y notas tal como vienen. No inventes, no resumas, no traduzcas, no añadas ejercicios. Corrige solo errores evidentes de OCR (p. ej. "Back Sguat" -> "Back Squat").
- Una sesión = un día de entrenamiento. Si en una misma celda/día hay varias partes (calentamiento, fuerza, WOD, accesorios…), son bloques distintos de esa sesión, en el orden en que aparecen.
- Bloques: label es la etiqueta que trae el plan (A, B, C, "STRENGTH", "WOD", "METCON", "WARM UP"…). Si no trae etiqueta, deja label vacío. kind: fuerza | wod | gimnastico | accesorios | calentamiento | cardio | movilidad | skill | otro. content: el texto del bloque, una línea por ejercicio o instrucción; la primera línea puede ser el título/formato ("AMRAP 12'", "EMOM 10'", "For time · cap 15'", "5x5 @75%").
- Fechas: si el plan trae fechas (aunque sea "12/11", "Lunes 3", "Semana del 10 al 16 de noviembre"), calcula la fecha completa YYYY-MM-DD. Si falta el año, usa el que haga la planificación más cercana a la fecha de hoy que te paso (normalmente el año actual, o el siguiente si los meses ya han pasado de largo). Si no hay ninguna pista de fecha, date = null.
- weekday: LUNES, MARTES, MIERCOLES, JUEVES, VIERNES, SABADO o DOMINGO si se sabe (por la fecha o porque lo pone). Si no, null.
- week: número de semana del plan si lo indica (Semana 1, W2, Week 3, microciclo 4…). Si no, null.
- order: posición de la sesión en el documento (1, 2, 3…), para no perder el orden cuando no hay fechas.
- Días de descanso explícitos ("REST", "Descanso", "OFF"): rest = true y blocks vacío. No inventes descansos para días que no aparecen.
- Ignora cabeceras de marca, logos, pies de página, publicidad y texto que no sea entrenamiento.
- plan_name: el nombre del plan si aparece (o uno corto y descriptivo en español).
- notes: avisos breves en español sobre lo que no hayas podido leer bien o lo que hayas supuesto (por ejemplo el año). Vacío si todo está claro.`;

const TOOL = {
  type: "function",
  function: {
    name: "save_plan",
    description: "Guarda las sesiones de entrenamiento leídas de la planificación.",
    parameters: {
      type: "object",
      properties: {
        plan_name: { type: "string" },
        notes: { type: "array", items: { type: "string" } },
        sessions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              order: { type: "integer" },
              date: { type: ["string", "null"], description: "YYYY-MM-DD o null" },
              weekday: { type: ["string", "null"], enum: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO", null] },
              week: { type: ["integer", "null"] },
              title: { type: ["string", "null"] },
              rest: { type: "boolean" },
              blocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    kind: { type: "string", enum: ["fuerza", "wod", "gimnastico", "accesorios", "calentamiento", "cardio", "movilidad", "skill", "otro"] },
                    content: { type: "string" },
                  },
                  required: ["label", "kind", "content"],
                },
              },
            },
            required: ["order", "date", "weekday", "week", "rest", "blocks"],
          },
        },
      },
      required: ["plan_name", "sessions", "notes"],
    },
  },
};

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.default) return parsed.default as string;
    } catch { /* formato antiguo */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // Solo usuarios con sesión iniciada en la app
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey());
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json({ error: "Inicia sesión para usar el lector." }, 401);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "El lector inteligente no está activado (falta Lovable AI).", code: "no_ai" }, 503);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Petición no válida" }, 400);
  }
  const text = (body.text ?? "").slice(0, 120_000);
  const images = (body.images ?? []).filter((s) => typeof s === "string" && s.startsWith("data:image/")).slice(0, 8);
  if (!text.trim() && images.length === 0) return json({ error: "No hay contenido que leer." }, 400);

  const intro = [
    `Hoy es ${body.today ?? new Date().toISOString().slice(0, 10)}.`,
    body.filename ? `Archivo: ${body.filename}.` : "",
    body.parts && body.parts > 1 ? `Esta es la parte ${body.part} de ${body.parts} del mismo documento; lee solo lo que hay aquí.` : "",
    body.hint ? `Indicación del atleta: ${body.hint}` : "",
  ].filter(Boolean).join(" ");

  const content: unknown[] = [{ type: "text", text: `${intro}\n\n${text ? `CONTENIDO:\n${text}` : "La planificación está en las imágenes."}` }];
  for (const url of images) content.push({ type: "image_url", image_url: { url } });

  const model = images.length ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "save_plan" } },
    }),
  });

  if (res.status === 429) return json({ error: "Demasiadas lecturas seguidas. Espera un minuto y vuelve a probar.", code: "rate" }, 429);
  if (res.status === 402) return json({ error: "Se han agotado los créditos de IA del proyecto en Lovable.", code: "credits" }, 402);
  if (!res.ok) {
    console.error("[plan-reader] AI error", res.status, await res.text());
    return json({ error: "El lector no ha podido procesar el archivo." }, 502);
  }

  const out = await res.json();
  const call = out?.choices?.[0]?.message?.tool_calls?.[0];
  try {
    const parsed = JSON.parse(call?.function?.arguments ?? "{}");
    if (!Array.isArray(parsed.sessions)) throw new Error("sin sesiones");
    return json({ ...parsed, model });
  } catch (e) {
    console.error("[plan-reader] respuesta no válida", e, JSON.stringify(out).slice(0, 2000));
    return json({ error: "La lectura ha salido incompleta. Prueba otra vez." }, 502);
  }
});
