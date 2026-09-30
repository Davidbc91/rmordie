import { useEffect, useState } from "react";
import { Play, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MOVEMENT_VIDEO_BUCKET, type MovementVideo } from "@/lib/admin-videos";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

export function MovementVideoEmbed({
  movementId,
  fallbackUrl,
}: {
  movementId: string;
  fallbackUrl?: string | null;
}) {
  const { data: managed } = useQuery({
    queryKey: ["movement-video", movementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movement_videos")
        .select("*")
        .eq("movement_id", movementId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MovementVideo | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const url =
    managed?.source_type === "youtube"
      ? managed.youtube_url
      : managed?.storage_path
        ? supabase.storage.from(MOVEMENT_VIDEO_BUCKET).getPublicUrl(managed.storage_path).data.publicUrl
        : null;

  if (managed?.source_type === "upload" && url) {
    return <UploadedVideo url={url} />;
  }

  if (managed?.source_type === "youtube" && url) {
    return <YouTubeEmbed videoUrl={url} />;
  }

  return <YouTubeEmbed videoUrl={fallbackUrl} />;
}

function UploadedVideo({ url }: { url: string }) {
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
      <video
        className="h-full w-full object-contain"
        src={url}
        controls
        playsInline
        preload="metadata"
      >
        <track kind="captions" />
      </video>
      <span className="sr-only">
        <Play aria-hidden="true" />
      </span>
    </div>
  );
}
