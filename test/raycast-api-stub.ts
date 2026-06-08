// Minimal stand-in for @raycast/api so pure utility modules that import `Color`
// can be unit tested with Vitest without pulling in the real Raycast runtime.
export const Color = {
  Blue: "blue",
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
  Magenta: "magenta",
  Purple: "purple",
  PrimaryText: "primaryText",
  SecondaryText: "secondaryText",
} as const;
