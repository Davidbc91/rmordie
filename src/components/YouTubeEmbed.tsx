import { useEffect, useState } from "react";
import { Play, WifiOff } from "lucide-react";
import { getDictionaryVideoId } from "@/lib/dictionary/videoOverrides";

export function YouTubeEmbed({ videoUrl }: { videoUrl?: string | null }) {
  const videoId = getDictionaryVideoId(videoUrl);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!videoId) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-black/20 p-5 text-center">
        <Play className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Vídeo próximamente</p>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-black/20 p-5 text-center">
        <WifiOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Vídeo no disponible sin conexión</p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black/20">
      <iframe
        className="h-full w-full border-0"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="Demostración del movimiento"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
