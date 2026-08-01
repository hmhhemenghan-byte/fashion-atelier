export const PROCESS_STAGES = [
  { value: "research", label: "研究", english: "RESEARCH" },
  { value: "sketch", label: "草图", english: "SKETCH" },
  { value: "material", label: "材料", english: "MATERIAL" },
  { value: "draping", label: "立裁", english: "DRAPING" },
  { value: "pattern", label: "打版", english: "PATTERN" },
  { value: "fitting", label: "试衣", english: "FITTING" },
  { value: "construction", label: "制作", english: "CONSTRUCTION" },
  { value: "final", label: "定型", english: "FINAL" },
] as const;

export type ProcessStage = (typeof PROCESS_STAGES)[number]["value"];

export function isProcessStage(value: unknown): value is ProcessStage {
  return PROCESS_STAGES.some((stage) => stage.value === value);
}

export function processStageMeta(value: string) {
  return (
    PROCESS_STAGES.find((stage) => stage.value === value) ??
    PROCESS_STAGES[0]
  );
}
