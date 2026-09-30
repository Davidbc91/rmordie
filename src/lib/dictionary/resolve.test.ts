import assert from "node:assert/strict";
import test from "node:test";
import { movements } from "./catalog";
import {
  normalizeMovementName,
  resolveMovement,
  resolveMovementId,
  resolveMovements,
} from "./resolve";

function movementId(name: string) {
  const movement = movements.find((item) => item.name === name);
  assert.ok(movement, `missing fixture movement: ${name}`);
  return movement.id;
}

test("resolves canonical and Spanish labels despite case, accents and punctuation", () => {
  const expected = movementId("Back Squat");
  for (const text of ["Back Squat", "BACK SQUAT", "back-squat", "Sentadilla trasera"]) {
    assert.equal(resolveMovementId(text), expected, text);
  }
  assert.equal(resolveMovementId("Back   Squat"), expected);
  assert.equal(normalizeMovementName("  BACK__SQUAT!!  "), "back squat");
});

test("separates a movement phrase from set, rep and percentage metadata", () => {
  const expected = movementId("Back Squat");
  for (const text of ["Back Squat 5x5", "Back Squat 5 x 5 @ 80%", "Back Squat 5 sets x 5 reps"]) {
    assert.equal(resolveMovementId(text), expected, text);
    assert.equal(resolveMovement(text)?.matchedName, "Back Squat");
  }
});

test("uses explicit aliases for equipment and abbreviations", () => {
  assert.equal(resolveMovement("DB Snatch 3x10")?.matchedName, "Dumbbell Snatch");
  assert.equal(resolveMovement("Dumbbell Snatch 3x10")?.matchedName, "Dumbbell Snatch");
  assert.equal(resolveMovementId("KB Swing"), movementId("Kettlebell Swing"));
  assert.equal(resolveMovementId("Toes-to-Bar"), movementId("Toes-to-Bar"));
  assert.equal(resolveMovementId("T2B"), movementId("Toes-to-Bar"));
  assert.equal(resolveMovementId("C2B"), movementId("Chest-to-Bar"));
  assert.equal(resolveMovementId("HSPU"), movementId("Handstand Push-Up"));
  assert.equal(resolveMovementId("BMU"), movementId("Bar Muscle-Up"));
  assert.equal(resolveMovementId("RMU"), movementId("Ring Muscle-Up"));
  assert.equal(resolveMovementId("DU"), movementId("Double Under"));
  assert.equal(resolveMovementId("SU"), movementId("Single Under"));
  assert.equal(resolveMovementId("MU"), null);
});

test("prefers specific phrases and does not return overlapping shorter matches", () => {
  assert.equal(resolveMovement("Power Clean")?.matchedName, "Power Clean");
  assert.equal(resolveMovement("Power Clean 5x3")?.matchedName, "Power Clean");
  assert.equal(resolveMovement("Squat Clean")?.matchedName, "Squat Clean");
  assert.deepEqual(
    resolveMovements("Power Clean").map((match) => match.matchedName),
    ["Power Clean"],
  );
  assert.deepEqual(
    resolveMovements("Squat Clean").map((match) => match.matchedName),
    ["Squat Clean"],
  );
});

test("finds each movement phrase in a block without parsing its workout format", () => {
  assert.deepEqual(
    resolveMovements("AMRAP 10: 10 Wall Balls + 10 Burpees").map((match) => match.matchedName),
    ["Wall Ball", "Burpee"],
  );
  assert.deepEqual(
    resolveMovements("3 Rounds - 10 Toes to Bar").map((match) => match.matchedName),
    ["Toes-to-Bar"],
  );
});

test("returns structured match data and null for unknown text", () => {
  const match = resolveMovement("Back Squat 5x5");
  assert.ok(match);
  assert.equal(match.movementId, movementId("Back Squat"));
  assert.equal(match.matchedName, "Back Squat");
  assert.equal(match.matchedText, "Back Squat");
  assert.ok(match.confidence > 0 && match.confidence <= 1);
  assert.equal(resolveMovementId("ejercicio inventado xyz"), null);
});

test("catalog additions preserve stable IDs and all required typed fields", () => {
  assert.equal(movements.length, 180);
  assert.deepEqual(
    movements.slice(0, 72).map((movement) => movement.id),
    Array.from({ length: 72 }, (_, index) => `move-${String(index + 1).padStart(3, "0")}`),
  );
  assert.deepEqual(
    movements.slice(72).map((movement) => movement.id),
    Array.from({ length: 108 }, (_, index) => `move-${String(index + 73).padStart(3, "0")}`),
  );
  assert.equal(new Set(movements.map((movement) => movement.id)).size, movements.length);
  for (const movement of movements) {
    assert.ok(movement.name && movement.nameEs && movement.category);
    assert.ok(movement.aliases.length > 0 && movement.equipment.length > 0);
    assert.ok(["Beginner", "Intermediate", "Advanced"].includes(movement.level));
    assert.equal(typeof movement.rm, "boolean");
    assert.ok(movement.description && movement.videoUrl);
    for (const field of [
      movement.technique,
      movement.commonMistakes,
      movement.progressions,
      movement.regressions,
      movement.muscles,
    ]) {
      assert.ok(field.length > 0, `${movement.name} must have non-empty movement guidance`);
    }
  }
  const normalizedNames = movements.map((movement) => normalizeMovementName(movement.name));
  assert.equal(
    new Set(normalizedNames).size,
    movements.length,
    "canonical movement names are unique",
  );
});

test("resolves new English, Spanish and abbreviation labels", () => {
  const cases: Array<[string, string]> = [
    ["Air Squat", "Air Squat"],
    ["Sentadilla a cajón", "Box Squat"],
    ["Peso muerto con piernas rígidas", "Stiff-Leg Deadlift"],
    ["Single Leg RDL", "Single-Leg Romanian Deadlift"],
    ["HPC", "Hang Power Clean"],
    ["Hang Power Snatch", "Hang Power Snatch"],
    ["Clean High Pull", "Clean High Pull"],
    ["Press inclinado", "Incline Bench Press"],
    ["HRPU", "Hand-Release Push-Up"],
    ["Strict Pull Up", "Strict Pull-Up"],
    ["Butterfly Pullup", "Butterfly Pull-Up"],
    ["Hanging Knee Raise", "Hanging Knee Raise"],
    ["Pino libre", "Freestanding Handstand"],
    ["Plancha lateral", "Side Plank"],
    ["American Swing", "American Kettlebell Swing"],
    ["KB Push Jerk", "Kettlebell Push Jerk"],
    ["DB Hang Clean", "Dumbbell Hang Clean"],
    ["Zancada con barra", "Barbell Lunge"],
    ["Bar-facing burpee", "Bar-Facing Burpee"],
    ["Wall Ball Shot", "Wall Ball"],
    ["medicine ball clean", "Med Ball Clean"],
    ["Sandbag to Shoulder", "Sandbag Shouldering"],
  ];
  for (const [query, expected] of cases) {
    assert.equal(resolveMovement(query)?.matchedName, expected, query);
  }
});

test("specific Olympic variants beat their general movement names in workout text", () => {
  const cases: Array<[string, string]> = [
    ["Power Clean", "Power Clean"],
    ["Squat Clean", "Squat Clean"],
    ["Hang Clean", "Hang Clean"],
    ["Clean", "Clean"],
    ["Power Snatch", "Power Snatch"],
    ["Squat Snatch", "Squat Snatch"],
    ["Hang Snatch", "Hang Snatch"],
    ["Snatch", "Snatch"],
  ];
  for (const [query, expected] of cases) {
    assert.equal(resolveMovement(query)?.matchedName, expected, query);
    assert.equal(resolveMovement(`${query} 5x3 @ 80%`)?.matchedName, expected, query);
  }
});

test("finds multiple specific movements among workout prescription numbers", () => {
  assert.deepEqual(
    resolveMovements("5 rounds: 3 Power Clean @ 80% + 6 Box Squat + 10 Burpees").map(
      (match) => match.matchedName,
    ),
    ["Power Clean", "Box Squat", "Burpee"],
  );
});

test("RM flags are limited to movements with a meaningful loaded max", () => {
  const expectedRmMovements = new Set([
    "Back Squat",
    "Front Squat",
    "Overhead Squat",
    "Deadlift",
    "Sumo Deadlift",
    "Clean",
    "Power Clean",
    "Squat Clean",
    "Snatch",
    "Power Snatch",
    "Squat Snatch",
    "Clean & Jerk",
    "Split Jerk",
    "Push Jerk",
    "Strict Press",
    "Push Press",
    "Bench Press",
  ]);
  assert.deepEqual(
    movements
      .filter((movement) => movement.rm)
      .map((movement) => movement.name)
      .sort(),
    [...expectedRmMovements].sort(),
  );
});

test("all 108 new entries use movement-pattern guidance instead of category boilerplate", () => {
  const additions = movements.slice(72);
  assert.equal(additions.length, 108);
  for (const movement of additions) {
    assert.ok(movement.description.length > 40, movement.name);
    assert.ok(movement.technique.length >= 3, movement.name);
    assert.ok(movement.commonMistakes.length >= 3, movement.name);
    assert.ok(movement.progressions.length >= 2, movement.name);
    assert.ok(movement.regressions.length >= 2, movement.name);
    assert.ok(movement.muscles.length >= 3, movement.name);
    assert.ok(!movement.description.includes("Equipamiento habitual"), movement.name);
  }
  assert.ok(new Set(additions.map((movement) => movement.description)).size > 20);
  for (const movement of movements) {
    assert.ok(!movement.description.startsWith(`${movement.name}:`), movement.name);
  }
});

test("specific clean and snatch names never collapse to a more general variant", () => {
  const cleanCases = [
    ["Clean", "Clean"],
    ["Power Clean", "Power Clean"],
    ["Squat Clean", "Squat Clean"],
    ["Hang Clean", "Hang Clean"],
    ["Hang Power Clean", "Hang Power Clean"],
  ];
  const snatchCases = [
    ["Snatch", "Snatch"],
    ["Power Snatch", "Power Snatch"],
    ["Squat Snatch", "Squat Snatch"],
    ["Hang Snatch", "Hang Snatch"],
    ["Hang Power Snatch", "Hang Power Snatch"],
  ];
  for (const [query, expected] of [...cleanCases, ...snatchCases]) {
    assert.equal(resolveMovement(query)?.matchedName, expected, query);
    assert.equal(resolveMovement(`${query} 5x2 @ 80%`)?.matchedName, expected, query);
  }
  assert.equal(resolveMovementId("MU"), null);
});

test("catalog labels do not assign the same normalized alias to different movements", () => {
  const owners = new Map<string, string>();
  for (const movement of movements) {
    for (const label of [movement.name, movement.nameEs, ...movement.aliases]) {
      const key = normalizeMovementName(label);
      const owner = owners.get(key);
      assert.ok(
        !owner || owner === movement.id,
        `${label} is shared by ${owner} and ${movement.id}`,
      );
      owners.set(key, movement.id);
    }
  }
});
