import { ExternalLink, Play } from "lucide-react";
import { MovementDictionarySegments } from "@/components/MovementDictionaryLink";

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>()"']+[^\s<>()"'.,;:!?])/gi;

function isVideo(href: string) {
  return /youtu\.be|youtube\.com|vimeo\.com|instagram\.com/i.test(href);
}

function label(href: string) {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    if (isVideo(href)) return "Ver vídeo";
    return host;
  } catch {
    return href;
  }
}

/** Renders plain text preserving line breaks, turning every URL into its own clickable link. */
export function LinkedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className={`whitespace-pre-wrap font-sans text-sm leading-relaxed ${className ?? ""}`}>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const href = part.startsWith("http") ? part : `https://${part}`;
          const video = isVideo(href);
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={href}
              className={
                video
                  ? // Vídeos en rojo (como YouTube) para no confundirlos con los ejercicios.
                    "mx-0.5 inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-[#FF5A4E]/45 bg-[#FF5A4E]/15 px-2.5 align-middle text-[13px] font-semibold text-[#FF8A80] no-underline hover:bg-[#FF5A4E]/25"
                  : "mx-0.5 inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-sky-300/35 bg-sky-400/10 px-2.5 align-middle text-[13px] font-medium text-sky-200 no-underline hover:bg-sky-400/20"
              }
            >
              {video ? <Play className="h-3.5 w-3.5 shrink-0" fill="currentColor" /> : <ExternalLink className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{label(href)}</span>
            </a>
          );
        }
        return (
          <span key={i}>
            <MovementDictionarySegments text={part} />
          </span>
        );
      })}
    </p>
  );
}
