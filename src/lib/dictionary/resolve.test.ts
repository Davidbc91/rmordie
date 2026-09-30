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
