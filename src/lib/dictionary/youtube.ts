/** Returns a safe YouTube video ID from a direct video URL. */
export function getYouTubeVideoId(url: string | undefined | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;

    const host = parsed.hostname.toLowerCase();
    let videoId: string | null = null;

    if (
      (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") &&
      parsed.pathname === "/watch"
    ) {
      videoId = parsed.searchParams.get("v");
    } else if (host === "youtu.be") {
      videoId = parsed.pathname.slice(1).split("/")[0] ?? null;
    } else if (
      (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") &&
      parsed.pathname.startsWith("/embed/")
    ) {
      videoId = parsed.pathname.slice("/embed/".length).split("/")[0] ?? null;
    }

    return videoId && /^[A-Za-z0-9_-]{1,64}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}
