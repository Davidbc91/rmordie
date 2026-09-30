import { movements } from "./catalog";

export function normalizeMovementName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const movementNames = new Map<string, string>();
for (const movement of movements) {
  for (const name of [movement.name, movement.nameEs]) {
    movementNames.set(normalizeMovementName(name), movement.id);
  }
}
for (const movement of movements) {
  for (const alias of movement.aliases) {
    const key = normalizeMovementName(alias);
    if (key && !movementNames.has(key)) movementNames.set(key, movement.id);
  }
}

/** Resolves an exercise label to the stable local dictionary ID. */
export function resolveMovementId(exerciseName: string): string | null {
  return movementNames.get(normalizeMovementName(exerciseName)) ?? null;
}
