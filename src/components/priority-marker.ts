import { colors } from "@kud/ink-ui"
import { priorityGlyph, type PriorityGlyph } from "../lib/board.js"

export type PriorityMarker = {
  /** Always one column wide, so a list filling every row keeps its grid. */
  marker: PriorityGlyph
  /** Absent for the blank: nothing to paint. */
  color?: string
}

// Up in the warm bin, down in the cool one, so the two directions do not merge
// for an eye that is moving; the default rung muted, because it is the answer
// the reader may skip. Within a bin the doubled arrow and the single one share
// a hue — shape is the channel that tells them apart.
const COLOUR: Record<PriorityGlyph, string | undefined> = {
  "⇈": colors.warning,
  "↑": colors.warning,
  "=": colors.muted,
  "↓": colors.info,
  "⇊": colors.info,
  " ": undefined,
}

/**
 * The priority cell as the board draws it — glyph and colour together, so a
 * host filling gh-ink's `marker` / `markerColor` pair and the board's own row
 * cannot disagree on a hue. One site, never a host-side table that drifts;
 * see `priorityGlyph` for what the glyphs say.
 */
export const priorityMarker = (name: string | null): PriorityMarker => {
  const marker = priorityGlyph(name)
  const color = COLOUR[marker]
  return color ? { marker, color } : { marker }
}
