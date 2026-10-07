// Leave time for both independent reads and response normalisation within the
// route's 180-second limit. Thought tokens share the provider's output budget.
export const SCAN_DEADLINE_MS = 165_000;
export const SCAN_MODELS = {
  layout: "google/gemini-2.5-flash",
  analysis: "google/gemini-3.1-pro-preview",
  review: "anthropic/claude-opus-5.5",
} as const;

export type VisionStage = "layout" | "analysis" | "review";

export function visionSettings(stage: VisionStage, remainingMs: number, fallback = false) {
  const available = Math.max(0, remainingMs - 1_000);
  // A failed first analysis may retry only while leaving the other reader time.
  const budget = fallback ? Math.floor(available / 2) : available;
  const timeout = Math.min(stage === "layout" ? 18_000 : stage === "review" ? 70_000 : 60_000, budget);
  return {
    timeout,
    canRequest: timeout >= (stage === "layout" ? 3_000 : 12_000),
    max_tokens: stage === "layout" ? 2400 : 8192,
    reasoning: stage === "layout" ? { exclude: true, enabled: false }
      : { exclude: true, effort: "low" },
  };
}
