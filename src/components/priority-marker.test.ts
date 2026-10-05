import { colors, getIconMode, setIconMode } from "@kud/ink-ui"
import { afterEach, describe, expect, it } from "vitest"
import { priorityMarker } from "./priority-marker.js"

describe("priorityMarker", () => {
  const mode = getIconMode()
  afterEach(() => setIconMode(mode))

  // Text mode keeps Jira's arrows. The top rung moved from warning to error,
  // in both modes, so it reads as more urgent than high rather than the same.
  it("draws text arrows, the top rung in error", () => {
    setIconMode("text")
    expect(priorityMarker("Highest")).toEqual({
      marker: "⇈",
      color: colors.error,
      rank: "highest",
    })
    expect(priorityMarker("High")).toEqual({
      marker: "↑",
      color: colors.warning,
      rank: "high",
    })
    expect(priorityMarker("Medium")).toEqual({
      marker: "=",
      color: colors.muted,
      rank: "medium",
    })
    expect(priorityMarker("Low")).toEqual({
      marker: "↓",
      color: colors.info,
      rank: "low",
    })
    expect(priorityMarker("Lowest")).toEqual({
      marker: "⇊",
      color: colors.info,
      rank: "lowest",
    })
  })

  // Nerd mode draws Material Design chevrons, one column each; the colours
  // match text mode rung for rung.
  it("draws Nerd chevrons in nerd mode, same colours", () => {
    setIconMode("nerd")
    expect(priorityMarker("Highest")).toEqual({
      marker: "\u{F013F}",
      color: colors.error,
      rank: "highest",
    })
    expect(priorityMarker("High")).toEqual({
      marker: "\u{F0143}",
      color: colors.warning,
      rank: "high",
    })
    expect(priorityMarker("Medium")).toEqual({
      marker: "\u{F01FC}",
      color: colors.muted,
      rank: "medium",
    })
    expect(priorityMarker("Low")).toEqual({
      marker: "\u{F0140}",
      color: colors.info,
      rank: "low",
    })
    expect(priorityMarker("Lowest")).toEqual({
      marker: "\u{F013C}",
      color: colors.info,
      rank: "lowest",
    })
  })

  // Always one column, so a host filling every row keeps its grid; the blank
  // carries no colour because there is nothing to paint — in either mode.
  it("draws a one-column blank for a priority it cannot place", () => {
    for (const iconMode of ["text", "nerd"] as const) {
      setIconMode(iconMode)
      expect(priorityMarker(null)).toEqual({ marker: " ", rank: "none" })
      expect(priorityMarker("Someday")).toEqual({ marker: " ", rank: "none" })
    }
  })
})
