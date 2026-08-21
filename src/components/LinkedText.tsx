import { ExternalLink, Play } from "lucide-react";

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
          const Icon = isVideo(href) ? Play : ExternalLink;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={href}
              className="mr-1 inline-flex max-w-full items-center gap-1 rounded-full border border-current/25 px-2 py-0.5 align-middle text-[12px] font-medium underline-offset-2 hover:underline"
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{label(href)}</span>
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
