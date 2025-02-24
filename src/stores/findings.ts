import { acceptHMRUpdate, defineStore } from "pinia";
import type { Finding, BasicFinding } from "~/utils";
import { getRandomColor } from "~/utils";

function customFindingsStringify(findings: Finding[]): string {
  return JSON.stringify(findings, null, 4).replace(
    /"bounding_box": \[\s*([^\]]+?)\s*\]/gs,
    (match, arrayContent) => {
      return `"bounding_box": [${arrayContent.replace(/,\s*/g, ", ")}]`;
    },
  );
}

export const useFindingsStore = defineStore("findings", () => {
  const findings = ref<Finding[]>([]);
  const highestId = ref(1);

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

  const findingsFormatted = computed(() => {
    const jsonified = customFindingsStringify(findings.value);

    return `<output>\n${jsonified}\n</output>`;
  });

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

  function removeFinding(id: number) {
    findings.value = findings.value.filter((f) => f.id !== id);
  }

  function clearFindings() {
    findings.value = [];
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
  };
});

if (import.meta.hot)
  import.meta.hot.accept(
    acceptHMRUpdate(useFindingsStore as any, import.meta.hot),
  );
