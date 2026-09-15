import { colors } from "@kud/ink-ui"
import { describe, expect, it } from "vitest"
import { priorityMarker } from "./priority-marker.js"

describe("priorityMarker", () => {
  // Shape is the channel, and the hues sit in different bins so the two
  // arrows do not merge for an eye that is moving.
  it("paints the high end warm and the low end muted", () => {
    expect(priorityMarker("High")).toEqual({ marker: "▲", color: colors.warning })
    expect(priorityMarker("Lowest")).toEqual({ marker: "▼", color: colors.muted })
  })

  // Always one column, so a host filling every row keeps its grid; the blank
  // carries no colour because there is nothing to paint.
  it("draws a one-column blank for normal, with no colour", () => {
    expect(priorityMarker("Medium")).toEqual({ marker: " " })
    expect(priorityMarker(null)).toEqual({ marker: " " })
  })
})
