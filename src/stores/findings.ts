import { nanoid } from "nanoid";
import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Finding, BasicFinding, InternalRepr, BboxType } from "~/utils/schemas";
import { getRandomColor } from "~/utils/colors";

export const useFindingsStore = defineStore("findings", () => {
  const findings = ref<Finding[]>([]);
  const thinkText = ref<string>("");

  const getFindings = computed<InternalRepr>(() => ({
    think: thinkText.value,
    output: findings.value,
  }));

  const findingsBoxes = computed(() => {
    return findings.value.map((f) => ({
      id: f.id,
      box: f.bounding_box,
      color: f.color,
      label: f.label,
    }));
  });

  function setFindings(repr: InternalRepr) {
    thinkText.value = repr.think || "";
    findings.value = repr.output || [];
  }

  function setThinkText(text: string) {
    thinkText.value = text;
  }

  function addFinding(finding: BasicFinding): string {
    const newFinding: Finding = {
      ...finding,
      id: nanoid(),
      color: getRandomColor(),
    };
    findings.value.push(newFinding);
    return newFinding.id;
  }

  function addBox(bbox: BboxType): string {
    // prefill some data to make life easier
    let placeholderFinding: BasicFinding = {
      label: "New Finding",
      severity: 5,
      description: "Bounding box added.",
      explanation: "Explanation pending.",
      bounding_box: bbox,
    };

    if (findings.value.length > 0)  {
      const last = findings.value[findings.value.length - 1];
      placeholderFinding = {
        label: last.label,
        severity: last.severity,
        description: last.description,
        explanation: last.explanation,
        bounding_box: bbox,
      };
    }
    return addFinding(placeholderFinding);
  }

  function getFindingById(id: string | null): Finding | null {
    if (!id) return null;
    return findings.value.find((f) => f.id === id) || null;
  }

  function updateFinding(updatedFinding: Finding): void {
    const index = findings.value.findIndex((f) => f.id === updatedFinding.id);
    if (index !== -1) {
      findings.value[index] = {
        ...findings.value[index],
        ...updatedFinding,
      };
    } else {
      console.warn(`Finding with id ${updatedFinding.id} not found for update.`);
    }
  }

  function updateBox(id: string | null, newBox: BboxType): void {
    if (!id) return;
    const finding = getFindingById(id);
    if (finding) {
      updateFinding({ ...finding, bounding_box: newBox });
    }
  }

  function removeFinding(id: string): void {
    findings.value = findings.value.filter((f) => f.id !== id);
  }

  function clearFindings(): void {
    findings.value = [];
    thinkText.value = "";
  }

  function $reset(): void {
    clearFindings();
  }

  return {
    findings,
    thinkText,
    getFindings,
    findingsBoxes,
    setFindings,
    setThinkText,
    addFinding,
    addBox,
    getFindingById,
    updateFinding,
    updateBox,
    removeFinding,
    clearFindings,
    $reset,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFindingsStore, import.meta.hot));
}
