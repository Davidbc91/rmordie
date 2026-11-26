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
  "Devil's Press":"https://www.youtube.com/watch?v=-fciGKOxLbA",
  "Sled Push":"https://www.youtube.com/watch?v=ICcfa_o2s_E",
  "Farmer Carry":"https://www.youtube.com/watch?v=vi4X2iSOyiA",
  "Waiter's Carry":"https://www.youtube.com/watch?v=9ZF5DZaOPNc",
  "Running":"https://www.youtube.com/watch?v=9cG-grUiJyI",
};

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

  // Solo el vídeo de ese movimiento exacto; nunca el de otro parecido.
  const exact = videos[name];
  return exact ? getYouTubeVideoId(exact) : null;
}

/** Búsqueda de YouTube con el nombre exacto, para cuando aún no hay vídeo revisado. */
export function youtubeSearchUrl(videoUrl?: string | null): { url: string; name: string } | null {
  const name = movementNameFromSearchUrl(videoUrl);
  if (!name) return null;
  return { name, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} crossfit`)}` };
}
