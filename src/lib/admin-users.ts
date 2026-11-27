import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localDay } from "@/lib/analytics";

/** Una fila del panel de administrador (función admin_users_overview). */
export type AdminUser = {
  id: string;
  name: string;
  created_at: string;
  email: string | null;
  last_sign_in_at: string | null;
  username: string | null;
  box_name: string | null;
  trained_days: number;
  days_7: number;
  first_trained: string | null;
  last_trained: string | null;
  prs: number;
  has_plan: boolean;
  devices: string[];
};

export type UserStatus = "new" | "active" | "idle" | "unstarted";

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: ["admin-users"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminUser[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_users_overview");
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

const DAY = 864e5;
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d);
};
const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return addDays(iso, -((d.getDay() + 6) % 7));
};

export function deviceKind(ua: string): "iPhone" | "Android" | "Ordenador" {
  if (/iphone|ipad|ipod/i.test(ua)) return "iPhone";
  if (/android/i.test(ua)) return "Android";
  return "Ordenador";
}

/** Nuevo (alta en los últimos 7 días) > activo (entrenó en 7 días) > se enfría / sin empezar. */
export function statusOf(u: AdminUser, now = Date.now()): UserStatus {
  if (now - Date.parse(u.created_at) < 7 * DAY) return "new";
  if (u.days_7 > 0) return "active";
  return u.trained_days > 0 ? "idle" : "unstarted";
}

export function summarize(users: AdminUser[], now = Date.now()) {
  const total = users.length;
  const newLast7 = users.filter((u) => now - Date.parse(u.created_at) < 7 * DAY).length;
  const newPrev7 = users.filter((u) => {
    const age = now - Date.parse(u.created_at);
    return age >= 7 * DAY && age < 14 * DAY;
  }).length;
  const active7 = users.filter((u) => u.days_7 > 0).length;
  let iphone = 0;
  let android = 0;
  let other = 0;
  let withPush = 0;
  for (const u of users) {
    if (!u.devices?.length) continue;
    withPush++;
    const kinds = new Set(u.devices.map(deviceKind));
    if (kinds.has("iPhone")) iphone++;
    else if (kinds.has("Android")) android++;
    else other++;
  }

  // Altas por semana (lunes a domingo), últimas 12
  const thisMonday = mondayOf(localDay(new Date(now)));
  const weeks = Array.from({ length: 12 }, (_, i) => ({ monday: addDays(thisMonday, -7 * (11 - i)), count: 0 }));
  for (const u of users) {
    const m = mondayOf(localDay(new Date(u.created_at)));
    const w = weeks.find((x) => x.monday === m);
    if (w) w.count++;
  }

  const funnel = [
    { label: "Se registran", value: total },
    { label: "Tienen un plan", value: users.filter((u) => u.has_plan).length },
    { label: "Apuntan su primer entreno", value: users.filter((u) => u.trained_days > 0).length },
    { label: "Entrenan esta semana", value: active7 },
  ];

  return { total, newLast7, newPrev7, active7, withPush, iphone, android, other, weeks, funnel };
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «Hoy, 10:42», «Ayer», «24 nov» */
export function whenLabel(iso: string | null, withTime = false, now = new Date()): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  const day = localDay(d);
  const today = localDay(now);
  const time = iso.length > 10 ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";
  if (day === today) return withTime && time ? `Hoy, ${time}` : "Hoy";
  if (day === addDays(today, -1)) return "Ayer";
  const diff = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${day}T12:00:00`)) / DAY);
  if (diff < 7 && diff > 0) return `Hace ${diff} días`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}

export function shortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
