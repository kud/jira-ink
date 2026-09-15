import { colors } from "@kud/ink-ui"
import { priorityGlyph } from "../lib/board.js"

export type PriorityMarker = {
  /** Always one column wide, so a list filling every row keeps its grid. */
  marker: "▲" | "▼" | " "
  /** Absent for the blank: nothing to paint. */
  color?: string
}

/**
 * The priority cell as the board draws it — glyph and colour together, so a
 * host filling gh-ink's `marker` / `markerColor` pair and the board's own row
 * cannot disagree on a hue. Shape is the channel (`▲` above normal, `▼`
 * below, nothing for normal); the hues sit in different bins so the two arrows
 * do not merge at row-scan speed, and a warm one on the high end so it clears
 * the row text. The hex-vs-token question was settled with the pill map: one
 * site, here, never a host-side table that drifts.
 */
export const priorityMarker = (name: string | null): PriorityMarker => {
  const marker = priorityGlyph(name)
  return marker === "▲"
    ? { marker, color: colors.warning }
    : marker === "▼"
      ? { marker, color: colors.muted }
      : { marker }
}
