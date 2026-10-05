import { colors, getIconMode } from "@kud/ink-ui"
import { priorityRank, type PriorityRank } from "../lib/board.js"

export type PriorityMarker = {
  /** Always one column wide, so a list filling every row keeps its grid. */
  marker: string
  /** Absent for the blank: nothing to paint. */
  color?: string
  /** The rank the marker was drawn from, for callers that branch on it. */
  rank: PriorityRank
}

const TEXT: Record<PriorityRank, string> = {
  highest: "⇈",
  high: "↑",
  medium: "=",
  low: "↓",
  lowest: "⇊",
  none: " ",
}

const NERD: Record<PriorityRank, string> = {
  highest: "\u{F013F}",
  high: "\u{F0143}",
  medium: "\u{F01FC}",
  low: "\u{F0140}",
  lowest: "\u{F013C}",
  none: " ",
}

// The top rung in error, high in warning, the default rung muted, the two
// below in info — urgency reads top-down, and the doubled chevron tells the
// top rung apart from high within its own bin by shape, not by a second hue.
const COLOUR: Record<PriorityRank, string | undefined> = {
  highest: colors.error,
  high: colors.warning,
  medium: colors.muted,
  low: colors.info,
  lowest: colors.info,
  none: undefined,
}

/**
 * The priority cell as the board draws it — glyph and colour together, so a
 * host filling gh-ink's `marker` / `markerColor` pair and the board's own row
 * cannot disagree on a hue. One site, never a host-side table that drifts;
 * see `priorityRank` for what the ranks say. The glyph follows the icon mode:
 * Nerd Font mode draws Material Design chevrons, text mode Jira's arrows.
 */
export const priorityMarker = (name: string | null): PriorityMarker => {
  const rank = priorityRank(name)
  const marker = getIconMode() === "nerd" ? NERD[rank] : TEXT[rank]
  const color = COLOUR[rank]
  return color ? { marker, color, rank } : { marker, rank }
}
