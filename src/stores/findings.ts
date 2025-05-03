import { nanoid } from "nanoid";
import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Finding, BasicFinding, InternalRepr, BboxType } from "~/utils/schemas";
import { getRandomColor } from "~/utils/colors";
import { parseOutputString } from "~/services/importExportService"; // Import the parser

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
    // Ensure output is always an array, even if null/undefined in repr
    findings.value = repr.output || [];
  }

  function setThinkText(text: string) {
    thinkText.value = text;
  }

  /**
   * Adds a new finding based on BasicFinding data.
   * Used when creating findings programmatically (e.g., adding a box).
   */
  function addFinding(finding: BasicFinding): string {
    const newFinding: Finding = {
      ...finding,
      id: nanoid(),
      color: getRandomColor(),
    };
    findings.value.push(newFinding);
    return newFinding.id;
  }

  /**
   * Creates and adds a new finding when a box is drawn.
   * Tries to prefill data from the last existing finding.
   */
  function addBox(bbox: BboxType): string {
    let placeholderFinding: BasicFinding = {
      label: "New Finding",
      severity: 5,
      description: "Bounding box added.",
      explanation: "Explanation pending.",
      bounding_box: bbox,
    };

    if (findings.value.length > 0) {
      const last = findings.value[findings.value.length - 1];
      placeholderFinding = {
        label: last.label,
        severity: last.severity,
        description: last.description, // Keep description relevant to the box add
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
      // Preserve the original color and id if not explicitly provided in update
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

  /**
   * Parses a string containing the JSON output, validates, normalizes,
   * and updates the findings state if successful.
   *
   * @param outputString The raw string from the output section.
   * @returns An object indicating success or failure with an error message.
   */
  function updateFindingsFromOutputString(
    outputString: string,
  ): { success: boolean; error: string | null } {
    const result = parseOutputString(outputString);
    if (result.data !== null) {
      findings.value = result.data; // Update state on success
      return { success: true, error: null };
    } else {
      // Do not update state on failure
      console.error("Failed to update findings from string:", result.error);
      return { success: false, error: result.error };
    }
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
    getFindings, // Computed internal repr
    findingsBoxes, // Computed boxes for display
    setFindings, // Sets the whole internal repr
    setThinkText, // Sets only the think text
    addFinding, // Adds a finding from BasicFinding
    addBox, // Adds a finding from a drawn Bbox
    getFindingById,
    updateFinding, // Updates a finding based on Finding object
    updateBox, // Updates only the bbox of a finding
    removeFinding,
    updateFindingsFromOutputString, // New action to parse and update from string
    clearFindings,
    $reset,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFindingsStore, import.meta.hot));
}
