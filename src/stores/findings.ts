import { nanoid } from "nanoid";
import { acceptHMRUpdate, defineStore } from "pinia";
import type { Finding, BasicFinding, InternalRepr } from "~/utils";
import {
  findingToBasicFinding,
  customFindingsStringify,
  getRandomColor,
} from "~/utils";

export function formatFindings(findings: (Finding | BasicFinding)[]): string {
  return `<output>\n${customFindingsStringify(findings)}\n</output>`;
}

export function formatForExport(internalRepr: InternalRepr): string | null {
  if (!internalRepr.output) return null;

  const cleaned = internalRepr.output.map(findingToBasicFinding);
  const formattedOutput = customFindingsStringify(cleaned);

  return `<think>\n${internalRepr.think}\n</think>\n<output>\n${formattedOutput}\n</output>`;
}

export const useFindingsStore = defineStore("findings", () => {
  const findings = ref<Finding[]>([]);
  const thinkText = ref<string>("");

  // The internal representation is the single source of truth
  const internalRepr = computed<InternalRepr>(() => ({
    think: thinkText.value,
    output: findings.value,
  }));

  function setThinkText(text: string) {
    thinkText.value = text;
  }

  function setInternalRepr(repr: InternalRepr) {
    thinkText.value = repr.think || "";
    updateAllFindings(repr.output || []);
  }

  const getInternalRepr = computed(() => internalRepr.value);
  const formattedForExport = () => formatForExport(internalRepr.value);

  function addFinding(finding: BasicFinding) {
    const id = nanoid();
    const color = getRandomColor();

    findings.value.push({ ...finding, id, color });
    return id;
  }

  function addBox(bbox: [number, number, number, number]) {
    const id = nanoid();
    const color = getRandomColor();

    findings.value.push({
      id,
      color,
      bounding_box: bbox,
      label: "",
      severity: 5,
      description: "",
      explanation: "",
    });
    return id;
  }

  function addFindings(basicFindings: BasicFinding[]) {
    const ids = [];
    for (const finding of basicFindings) {
      const id = nanoid();
      const color = getRandomColor();
      findings.value.push({ ...finding, id, color });
      ids.push(id);
    }
    return ids;
  }

  // Now only formats the findings part, not the full text with tags
  const findingsFormatted = computed(() => formatFindings(findings.value));

  const findingsBoxes = computed(() => {
    return findings.value.map((finding) => {
      const { id, color, bounding_box, label } = finding;
      const [x_min, y_min, x_max, y_max] = bounding_box;
      return {
        id,
        color,
        label,
        x_min,
        y_min,
        x_max,
        y_max,
      };
    });
  });

  function getBox(id: string | null) {
    if (!id) return null;

    const finding = findings.value.find((f) => f.id === id);
    if (!finding) return null;
    const { color, bounding_box, label } = finding;
    const [x_min, y_min, x_max, y_max] = bounding_box;
    return {
      id,
      color,
      label,
      x_min,
      y_min,
      x_max,
      y_max,
    };
  }

  function updateBox(
    id: string | null,
    newBox: [number, number, number, number],
  ) {
    if (!id) return;

    const finding = findings.value.find((f) => f.id === id);
    if (!finding) return;
    finding.bounding_box = newBox;
  }

  function updateAllFindings(updatedFindings: Finding[]) {
    findings.value = updatedFindings;
  }

  function updateFinding(updatedFinding: Finding) {
    const index = findings.value.findIndex((f) => f.id === updatedFinding.id);
    if (index !== -1) {
      findings.value[index] = updatedFinding;
    }
  }

  function removeFinding(id: string) {
    findings.value = findings.value.filter((f) => f.id !== id);
  }

  function clearFindings() {
    findings.value = [];
  }

  function $reset() {
    findings.value = [];
    thinkText.value = "";
  }

  return {
    findings,
    addFinding,
    addBox,
    removeFinding,
    clearFindings,
    addFindings,
    findingsFormatted,
    findingsBoxes,
    getBox,
    updateBox,
    updateFinding,
    setThinkText,
    setInternalRepr,
    getInternalRepr,
    internalRepr,
    thinkText,
    updateAllFindings,
    formattedForExport,
    $reset,
  };
});

if (import.meta.hot)
  import.meta.hot.accept(
    acceptHMRUpdate(useFindingsStore as any, import.meta.hot),
  );
