export const VALUES_LIBRARY = Object.freeze([
  { id: "growth", label: "Growth", signals: ["grow", "advance", "challenge", "improve", "level up"] },
  { id: "security", label: "Security", signals: ["safe", "stable", "salary", "risk", "secure"] },
  { id: "freedom", label: "Freedom", signals: ["freedom", "autonomy", "independent", "flexible", "choice"] },
  { id: "recognition", label: "Recognition", signals: ["prestige", "status", "recognized", "title", "brand"] },
  { id: "impact", label: "Impact", signals: ["impact", "help", "change", "meaning", "useful"] },
  { id: "creativity", label: "Creativity", signals: ["create", "design", "build", "original", "craft"] },
  { id: "learning", label: "Learning", signals: ["learn", "skill", "curious", "study", "master"] },
  { id: "community", label: "Community", signals: ["team", "community", "belong", "people", "network"] },
  { id: "stability", label: "Stability", signals: ["routine", "predictable", "consistent", "long term", "steady"] },
  { id: "achievement", label: "Achievement", signals: ["win", "achieve", "goal", "perform", "success"] },
]);

const VALUE_TENSIONS = Object.freeze([
  ["growth", "security", "Growth may ask for risk while Security may ask for protection."],
  ["freedom", "stability", "Freedom may ask for options while Stability may ask for consistency."],
  ["recognition", "impact", "Recognition may focus on external approval while Impact may focus on usefulness."],
  ["achievement", "community", "Achievement may focus on individual progress while Community may focus on belonging."],
]);

export function inferValueAlignment(text = "", { max = 4 } = {}) {
  const lower = String(text || "").toLowerCase();
  const alignedValues = VALUES_LIBRARY
    .map((value) => {
      const signalCount = value.signals.filter((signal) => lower.includes(signal)).length;
      if (!signalCount) return null;
      return {
        id: value.id,
        label: value.label,
        confidence: signalCount >= 2 ? "medium" : "low",
        reflectionQuestion: `How important is ${value.label.toLowerCase()} in this decision compared with your other priorities?`,
      };
    })
    .filter(Boolean)
    .slice(0, max);

  const ids = new Set(alignedValues.map((value) => value.id));
  const possibleTensions = VALUE_TENSIONS
    .filter(([a, b]) => ids.has(a) && ids.has(b))
    .map(([a, b, framing]) => ({
      values: [a, b],
      framing,
      reflectionQuestion: "Which side of this tension matters more for the next season of your life?",
    }));

  return {
    alignedValues,
    possibleTensions,
    confidence: alignedValues.length >= 3 ? "medium" : "low",
  };
}
