import { movements } from "./catalog";
import type { MovementMatch } from "./types";

type Token = { value: string; start: number; end: number };
type Candidate = {
  movementId: string;
  matchedName: string;
  words: string[];
  matchType: MovementMatch["matchType"];
};

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Normalizes a movement label while preserving word boundaries. */
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

function tokenize(value: string): Token[] {
  return Array.from(value.matchAll(/[\p{L}\p{N}]+/gu), (match) => ({
    value: normalizeToken(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function wordMatches(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  // Accept ordinary plurals in training descriptions without fuzzy substring matching.
  if (actual === `${expected}s`) return true;
  if (expected.endsWith("y") && actual === `${expected.slice(0, -1)}ies`) return true;
  if (/[sxz]$|ch$|sh$/.test(expected) && actual === `${expected}es`) return true;
  return false;
}

const candidates: Candidate[] = movements.flatMap((movement) =>
  [
    { label: movement.name, matchType: "canonical" as const },
    { label: movement.nameEs, matchType: "canonical" as const },
    ...movement.aliases.map((label) => ({ label, matchType: "alias" as const })),
  ]
    .map(({ label, matchType }) => ({
      movementId: movement.id,
      matchedName: movement.name,
      words: tokenize(normalizeMovementName(label)).map((token) => token.value),
      matchType,
    }))
    .filter((candidate) => candidate.words.length > 0),
);

function collectMatches(text: string): MovementMatch[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  const matches: MovementMatch[] = [];
  for (let startIndex = 0; startIndex < tokens.length; startIndex++) {
    for (const candidate of candidates) {
      const endIndex = startIndex + candidate.words.length;
      if (endIndex > tokens.length) continue;
      const matchesWords = candidate.words.every((word, offset) =>
        wordMatches(word, tokens[startIndex + offset].value),
      );
      if (!matchesWords) continue;

      const exactWholeInput = startIndex === 0 && endIndex === tokens.length;
      const canonicalExact = candidate.matchType === "canonical";
      const confidence = exactWholeInput
        ? canonicalExact
          ? 1
          : 0.98
        : canonicalExact
          ? 0.92
          : 0.88;
      matches.push({
        movementId: candidate.movementId,
        matchedName: candidate.matchedName,
        matchedText: text.slice(tokens[startIndex].start, tokens[endIndex - 1].end),
        confidence,
        matchType: candidate.matchType,
        start: tokens[startIndex].start,
        end: tokens[endIndex - 1].end,
      });
    }
  }

  // Prefer the longest complete phrase, then canonical names. Shorter overlapping
  // hits such as "Clean" inside "Power Clean" or "Squat" inside "Squat Clean" drop out.
  const ranked = matches.sort(
    (a, b) =>
      b.matchedText.length - a.matchedText.length ||
      Number(b.matchType === "canonical") - Number(a.matchType === "canonical") ||
      b.confidence - a.confidence ||
      a.start - b.start,
  );
  const selected: MovementMatch[] = [];
  for (const match of ranked) {
    if (selected.some((other) => match.start < other.end && match.end > other.start)) continue;
    selected.push(match);
  }
  return selected.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Resolves the strongest single movement mention in an exercise label or block. */
export function resolveMovement(exerciseText: string): MovementMatch | null {
  const matches = collectMatches(exerciseText);
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.matchedText.length - a.matchedText.length ||
      a.start - b.start,
  )[0];
}

/** Resolves each distinct non-overlapping movement phrase in a training block. */
export function resolveMovements(trainingText: string): MovementMatch[] {
  return collectMatches(trainingText);
}

/** Backward-compatible helper returning only the stable dictionary ID. */
export function resolveMovementId(exerciseName: string): string | null {
  return resolveMovement(exerciseName)?.movementId ?? null;
}
