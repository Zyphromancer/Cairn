// Fractional indexing for drag-reorder: the new position is the midpoint
// between its neighbors. Simple and fine at MVP scale; a string-based
// fractional index would avoid float-precision limits after very many
// reorders of the same item, which double precision doesn't guard against.
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

export function nextPosition(items: { position: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((i) => i.position)) + 1;
}
