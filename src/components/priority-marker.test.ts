import { colors, getIconMode, priorityColors, setIconMode } from "@kud/ink-ui"
import { afterEach, describe, expect, it } from "vitest"
import { priorityMarker } from "./priority-marker.js"

describe("priorityMarker", () => {
  const mode = getIconMode()
  afterEach(() => setIconMode(mode))

  // Text mode keeps Jira's arrows. Each rung wears ink-ui's priority tone, in
  // both modes: lightness steps down the ladder, the glyph carries the rank.
  it("draws text arrows in the priority tones", () => {
    setIconMode("text")
    expect(priorityMarker("Highest")).toEqual({
      marker: "⇈",
      color: priorityColors.highest,
      rank: "highest",
    })
    expect(priorityMarker("High")).toEqual({
      marker: "↑",
      color: priorityColors.high,
      rank: "high",
    })
    expect(priorityMarker("Medium")).toEqual({
      marker: "=",
      color: priorityColors.medium,
      rank: "medium",
    })
    expect(priorityMarker("Low")).toEqual({
      marker: "↓",
      color: priorityColors.low,
      rank: "low",
    })
    expect(priorityMarker("Lowest")).toEqual({
      marker: "⇊",
      color: priorityColors.lowest,
      rank: "lowest",
    })
  })

  // A red or amber chevron reads as a failure or a warning beside a status
  // that says neither, which is why the ladder left the state hues.
  it("never paints a rung in a state hue", () => {
    for (const name of ["Highest", "High", "Medium", "Low", "Lowest"]) {
      const { color } = priorityMarker(name)
      expect(color).not.toBe(colors.error)
      expect(color).not.toBe(colors.warning)
    }
  })

  // Nerd mode draws Material Design chevrons, one column each; the colours
  // match text mode rung for rung.
  it("draws Nerd chevrons in nerd mode, same colours", () => {
    setIconMode("nerd")
    expect(priorityMarker("Highest")).toEqual({
      marker: "\u{F013F}",
      color: priorityColors.highest,
      rank: "highest",
    })
    expect(priorityMarker("High")).toEqual({
      marker: "\u{F0143}",
      color: priorityColors.high,
      rank: "high",
    })
    expect(priorityMarker("Medium")).toEqual({
      marker: "\u{F01FC}",
      color: priorityColors.medium,
      rank: "medium",
    })
    expect(priorityMarker("Low")).toEqual({
      marker: "\u{F0140}",
      color: priorityColors.low,
      rank: "low",
    })
    expect(priorityMarker("Lowest")).toEqual({
      marker: "\u{F013C}",
      color: priorityColors.lowest,
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
