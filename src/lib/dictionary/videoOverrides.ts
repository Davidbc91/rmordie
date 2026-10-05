import { getYouTubeVideoId } from "./youtube";

const videos: Record<string, string> = {
  "Back Squat":"https://www.youtube.com/watch?v=QmZAiBqPvZw",
  "Overhead Squat":"https://www.youtube.com/watch?v=pn8mqlG0nkE",
  "Sumo Deadlift":"https://www.youtube.com/watch?v=wQHSYDSgDn8",
  "Strict Press":"https://www.youtube.com/watch?v=Y5xpE2K660s",
  "Bench Press":"https://www.youtube.com/watch?v=SCVCLChPQFY",
  "Dumbbell Press":"https://www.youtube.com/watch?v=AqzDJHxynwo",
  "Ring Row":"https://www.youtube.com/watch?v=sEAOZc77wk8",
  "Box Step-Up":"https://www.youtube.com/watch?v=5qjqDHOUh-A",
  "Burpee Box Jump Over":"https://www.youtube.com/watch?v=GLktGkmcvWE",
  "Single Under":"https://www.youtube.com/watch?v=hCuXYrTOMxI",
  "Legless Rope Climb":"https://www.youtube.com/watch?v=rfr-Tw3Pxh8",
  "Back Extension":"https://www.youtube.com/watch?v=toEkwEL7KKw",
  "GHD Hip Extension":"https://www.youtube.com/watch?v=yCoUpLutVo8",
  "Dumbbell Clean":"https://www.youtube.com/watch?v=SYxObzJ3gn0",
  "Dumbbell Deadlift":"https://www.youtube.com/watch?v=JNpUNRPQkAk",
  "Dumbbell Front Squat":"https://www.youtube.com/watch?v=B86Zj72LwzA",
  "Dumbbell Power Clean":"https://www.youtube.com/watch?v=viWI2rEt-HU",
  "Dumbbell Push Press":"https://www.youtube.com/watch?v=4tCaD42ghlc",
  "Turkish Get-Up":"https://www.youtube.com/watch?v=VQq8I_n_hRE",
  "Kettlebell Snatch":"https://www.youtube.com/watch?v=GhxhiehJcQY",
  "Devil's Press":"https://www.youtube.com/watch?v=-fciGKOxLbA",
  "Sled Push":"https://www.youtube.com/watch?v=ICcfa_o2s_E",
  "Farmer Carry":"https://www.youtube.com/watch?v=vi4X2iSOyiA",
  "Waiter's Carry":"https://www.youtube.com/watch?v=9ZF5DZaOPNc",
  "Running":"https://www.youtube.com/watch?v=9cG-grUiJyI",
};

const fallback: Array<[RegExp, string]> = [
  [/overhead squat|overhead carry/i, "Overhead Squat"],
  [/back squat|box squat|zercher squat/i, "Back Squat"],
  [/goblet squat|air squat|split squat|cossack squat|lunge|step-up/i, "Box Step-Up"],
  [/sumo deadlift/i, "Sumo Deadlift"],
  [/deadlift|good morning|hip thrust|glute bridge/i, "Deadlift"],
  [/clean.*jerk/i, "Clean & Jerk"],
  [/power clean|hang power clean/i, "Power Clean"],
  [/hang clean|squat clean|muscle clean|clean pull|clean high pull/i, "Clean"],
  [/snatch/i, "Snatch"],
  [/strict press/i, "Strict Press"],
  [/bench press|floor press|incline bench/i, "Bench Press"],
  [/dumbbell.*press|shoulder press|arnold press|z-press/i, "Dumbbell Press"],
  [/push press/i, "Push Press"],
  [/push jerk|power jerk|jerk balance/i, "Push Jerk"],
  [/strict chest-to-bar/i, "Strict Chest-to-Bar"],
  [/chest-to-bar/i, "Strict Chest-to-Bar"],
  [/toes-to-bar/i, "Toes-to-Bar"],
  [/knees-to-elbows|hanging knee|scapular pull|dead hang|active hang|towel hang/i, "Pull-up"],
  [/pull-up|muscle-up/i, "Pull-up"],
  [/ring row/i, "Ring Row"],
  [/handstand push-up/i, "Strict Handstand Push-Up"],
  [/handstand walk/i, "Handstand Walk"],
  [/handstand hold|freestanding handstand|wall walk|handstand shoulder tap/i, "Handstand Hold"],
  [/pistol/i, "Pistol Squat"],
  [/burpee box jump over/i, "Burpee Box Jump Over"],
  [/box jump over/i, "Box Jump"],
  [/box jump|broad jump|squat jump/i, "Box Jump"],
  [/burpee/i, "Burpee"],
  [/wall ball/i, "Wall Ball"],
  [/devil.*press/i, "Devil's Press"],
  [/turkish get-up/i, "Turkish Get-Up"],
  [/kettlebell.*snatch/i, "Kettlebell Snatch"],
  [/kettlebell|swing/i, "Kettlebell Swing"],
  [/dumbbell.*clean/i, "Dumbbell Clean"],
  [/dumbbell.*snatch/i, "Dumbbell Snatch"],
  [/dumbbell.*push/i, "Dumbbell Push Press"],
  [/dumbbell/i, "Dumbbell Press"],
  [/farmer|suitcase|waiter|zercher carry|carry/i, "Farmer Carry"],
  [/sled/i, "Sled Push"],
  [/rope climb/i, "Rope Climb"],
  [/ghd hip extension/i, "GHD Hip Extension"],
  [/ghd sit-up/i, "GHD Sit-Up"],
  [/back extension/i, "Back Extension"],
  [/sit-up|v-up|plank|russian twist|l-sit/i, "Sit-Up"],
  [/single under/i, "Single Under"],
  [/double under/i, "Double Under"],
  [/triple under/i, "Double Under"],
  [/row|skierg|bikeerg|assault bike/i, "Row"],
  [/running|sprint|swimming/i, "Running"],
  [/med ball/i, "Med Ball Clean"],
  [/sandbag/i, "Deadlift"],
];

function movementNameFromSearchUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("youtube.com")) return null;
    const query = parsed.searchParams.get("search_query");
    if (!query) return null;
    return decodeURIComponent(query).replace(/\s+CrossFit movement demo\s*$/i, "").trim();
  } catch {
    return null;
  }
}

export function getDictionaryVideoId(videoUrl?: string | null): string | null {
  const direct = getYouTubeVideoId(videoUrl);
  if (direct) return direct;

  const name = movementNameFromSearchUrl(videoUrl);
  if (!name) return null;

  const exact = videos[name];
  if (exact) return getYouTubeVideoId(exact);

  const match = fallback.find(([pattern]) => pattern.test(name));
  if (!match) return null;
  return getYouTubeVideoId(videos[match[1] as string]);
}
