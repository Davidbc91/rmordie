export type MovementLevel = "Beginner" | "Intermediate" | "Advanced";

export type MovementMatch = {
  movementId: string;
  matchedName: string;
  matchedText: string;
  confidence: number;
  matchType: "canonical" | "alias";
  /** Character offsets in the original input, with end exclusive. */
  start: number;
  end: number;
};

export type Movement = {
  id: string;
  name: string;
  nameEs: string;
  aliases: string[];
  category: string;
  equipment: string[];
  level: MovementLevel;
  rm: boolean;
  description: string;
  technique: string[];
  commonMistakes: string[];
  progressions: string[];
  regressions: string[];
  muscles: string[];
  videoUrl: string;
};
