import { colors } from "@kud/ink-ui"
import { describe, expect, it } from "vitest"
import { priorityMarker } from "./priority-marker.js"

describe("priorityMarker", () => {
  // Up warm, down cool, so the two directions sit in different hue bins; the
  // default rung muted. Within a bin the shape tells the doubled arrow apart.
  it("paints by direction, and the default muted", () => {
    expect(priorityMarker("Highest")).toEqual({ marker: "⇈", color: colors.warning })
    expect(priorityMarker("High")).toEqual({ marker: "↑", color: colors.warning })
    expect(priorityMarker("Medium")).toEqual({ marker: "=", color: colors.muted })
    expect(priorityMarker("Low")).toEqual({ marker: "↓", color: colors.info })
    expect(priorityMarker("Lowest")).toEqual({ marker: "⇊", color: colors.info })
  })

  // Always one column, so a host filling every row keeps its grid; the blank
  // carries no colour because there is nothing to paint.
  it("draws a one-column blank for a priority it cannot place", () => {
    expect(priorityMarker(null)).toEqual({ marker: " " })
    expect(priorityMarker("Someday")).toEqual({ marker: " " })
  })
})
