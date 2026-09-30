import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { resolveMovement, resolveMovements } from "@/lib/dictionary/resolve";

type MovementDictionaryLinkProps = {
  exerciseName: string;
  children?: ReactNode;
  className?: string;
};

/** Links a textual exercise label to its local dictionary page when recognized. */
export function MovementDictionaryLink({
  exerciseName,
  children,
  className,
}: MovementDictionaryLinkProps) {
  const match = resolveMovement(exerciseName);
  const label = children ?? exerciseName;

  if (!match) return <>{label}</>;

  return (
    <Link
      to="/dictionary/$movementId"
      params={{ movementId: match.movementId }}
      title={`${match.matchedName} · Ver en el diccionario`}
      className={`inline-flex min-h-9 items-center underline decoration-current/30 underline-offset-2 transition-colors hover:text-gold focus-visible:rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold ${className ?? ""}`}
    >
      {label}
    </Link>
  );
}

/** Adds subtle dictionary links to recognized movement phrases inside free text. */
export function MovementDictionarySegments({ text }: { text: string }) {
  const matches = resolveMovements(text);
  if (matches.length === 0) return <>{text}</>;

  const segments: ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (cursor < match.start) segments.push(text.slice(cursor, match.start));
    segments.push(
      <Link
        key={`${match.start}-${match.end}-${match.movementId}`}
        to="/dictionary/$movementId"
        params={{ movementId: match.movementId }}
        title={`${match.matchedName} · Ver en el diccionario`}
        className="rounded-sm px-0.5 py-1 underline decoration-current/30 underline-offset-2 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold"
      >
        {text.slice(match.start, match.end)}
      </Link>,
    );
    cursor = match.end;
  }
  if (cursor < text.length) segments.push(text.slice(cursor));
  return <>{segments}</>;
}
