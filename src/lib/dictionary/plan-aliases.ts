import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pin-gate";

/** Enlace corregido a mano: un texto del plan apunta a un movimiento del diccionario. */
export type MovementAlias = { id: string; alias: string; movement_id: string; created_at: string };

let cachedAliases: MovementAlias[] = [];
let aliasVersion = 0;

export function normalizeAlias(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getMovementAliases(): MovementAlias[] {
  return cachedAliases;
}

export function getMovementAliasVersion(): number {
  return aliasVersion;
}

function setAliases(value: MovementAlias[]) {
  cachedAliases = value;
  aliasVersion += 1;
}

export async function fetchMovementAliases(): Promise<MovementAlias[]> {
  const { data, error } = await (supabase as any)
    .from("movement_aliases")
    .select("id, alias, movement_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as MovementAlias[];
  setAliases(rows);
  return rows;
}

export function useMovementAliases(enabled = true) {
  return useQuery({ queryKey: ["movement-aliases"], queryFn: fetchMovementAliases, enabled, staleTime: 60_000 });
}

export function useAddMovementAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ alias, movementId }: { alias: string; movementId: string }) => {
      const clean = alias.trim();
      const norm = normalizeAlias(clean);
      if (!norm) throw new Error("Escribe el texto que quieres enlazar");
      // Si ya existía ese texto, se reemplaza por el nuevo movimiento.
      await (supabase as any).from("movement_aliases").delete().eq("alias_norm", norm);
      const { error } = await (supabase as any)
        .from("movement_aliases")
        .insert({ alias: clean, alias_norm: norm, movement_id: movementId, created_by: getCurrentUserId() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movement-aliases"] }),
  });
}

export function useDeleteMovementAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("movement_aliases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movement-aliases"] }),
  });
}
