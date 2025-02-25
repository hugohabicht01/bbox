import { acceptHMRUpdate, defineStore } from "pinia";
import type { Finding, BasicFinding } from "~/utils";
import { getSection, safeParseJSON, findingList } from "~/utils";
import { getRandomColor } from "~/utils";

function customFindingsStringify(findings: (Finding | BasicFinding)[]): string {
  return JSON.stringify(findings, null, 4).replace(
    /"bounding_box": \[\s*([^\]]+?)\s*\]/gs,
    (match, arrayContent) => {
      return `"bounding_box": [${arrayContent.replace(/,\s*/g, ", ")}]`;
    },
  );
}

export function formatFindings(findings: (Finding | BasicFinding)[]): string {
  return `<output>\n${customFindingsStringify(findings)}\n</output>`;
}

export const getStructured = (text: string) => {
  const output = safeParseJSON(getSection(text, "output"));
  if (!output) {
    return null;
  }

  const res = findingList.safeParse(output);
  if (!res.success) return null;
  return res.data;
};

export function formatForExport(rawText: string): string | null {
  const structured = getStructured(rawText);
  if (!structured) return null;

  const cleaned = structured.map((finding) => ({
    label: finding.label,
    description: finding.description,
    explanation: finding.explanation,
    bounding_box: finding.bounding_box,
    severity: finding.severity,
  }));

  const formattedCleaned = formatFindings(cleaned);

  return rawText.replace(/<output>.*<\/output>/s, formattedCleaned);
}

export const useFindingsStore = defineStore("findings", () => {
  const findings = ref<Finding[]>([]);
  const highestId = ref(1);

  const rawText = ref("");

  function setRawText(text: string) {
    rawText.value = text;
  }

  const getRawText = computed(() => rawText.value);
  const formattedForExport = () => formatForExport(rawText.value) ?? undefined;

  function addFinding(finding: BasicFinding) {
    const id = highestId.value++;
    const color = getRandomColor();

    findings.value.push({ ...finding, id, color });
    return id;
  }

  function addBox(bbox: [number, number, number, number]) {
    const id = highestId.value++;
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
      const id = highestId.value++;
      const color = getRandomColor();
      findings.value.push({ ...finding, id, color });
      ids.push(id);
    }
    return ids;
  }

  const findingsFormatted = computed(() => formatFindings(findings.value));

  const findingsBoxes = computed(() => {
    return findings.value.map((finding) => {
      const { id, color, bounding_box } = finding;
      const [x_min, y_min, x_max, y_max] = bounding_box;
      return {
        id,
        color,
        x_min,
        y_min,
        x_max,
        y_max,
      };
    });
  });

  function getBox(id: number | null) {
    if (!id) return null;

    const finding = findings.value.find((f) => f.id === id);
    if (!finding) return null;
    const { color, bounding_box } = finding;
    const [x_min, y_min, x_max, y_max] = bounding_box;
    return {
      id,
      color,
      x_min,
      y_min,
      x_max,
      y_max,
    };
  }

  function updateBox(
    id: number | null,
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

  function removeFinding(id: number) {
    findings.value = findings.value.filter((f) => f.id !== id);
  }

  function clearFindings() {
    findings.value = [];
  }

  function $reset() {
    findings.value = [];
    rawText.value = "";
    highestId.value = 1;
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
    setRawText,
    getRawText,
    updateAllFindings,
    formattedForExport,
    $reset,
  };
});

if (import.meta.hot)
  import.meta.hot.accept(
    acceptHMRUpdate(useFindingsStore as any, import.meta.hot),
  );
