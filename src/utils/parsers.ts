import { z } from "zod";
import type { BasicFinding } from "./schemas";
import { basicFindingListSchema } from "./schemas";

export function getSection(text: string, sectionMarker: string): string {
  const startMarker = `<${sectionMarker}>`;
  const endMarker = `</${sectionMarker}>`;
  const startIndex = text.indexOf(startMarker);
  const endIndex = text.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return ""; // Or throw an error, depending on desired strictness
  }

  return text.substring(startIndex + startMarker.length, endIndex).trim();
}

export function safeParseJSON(jsonString: string): unknown | null {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return null;
  }
}

export const basicTextValidator = z
  .string()
  .refine(
    (str) => {
      const thinkStarterMarkerCount = (str.match(/<think>/g) || []).length;
      if (thinkStarterMarkerCount !== 1) return false;
      const thinkEndMarkerCount = (str.match(/<\/think>/g) || []).length;
      if (thinkEndMarkerCount !== 1) return false;

      const outputStarterMarkerCount = (str.match(/<output>/g) || []).length;
      if (outputStarterMarkerCount !== 1) return false;
      const outputEndMarkerCount = (str.match(/<\/output>/g) || []).length;
      if (outputEndMarkerCount !== 1) return false;

      const thinkSection = getSection(str, "think");
      const outputSection = getSection(str, "output");
      if (thinkSection === "" || outputSection === "") return false; // Ensure sections exist

      // Validate the output section as JSON parsable BasicFinding[]
      const parsedOutput = safeParseJSON(outputSection);
      if (parsedOutput === null) return false;

      const validationResult = basicFindingListSchema.safeParse(parsedOutput);
      return validationResult.success;
    },
    {
      message:
        "Invalid format: Must contain exactly one <think> and one <output> section, and the <output> section must be a valid JSON array of BasicFinding objects.",
    },
  );

export function getStructuredBasicFindings(str: string): BasicFinding[] | null {
  const outputSection = getSection(str, "output");
  if (!outputSection) return null;

  const parsedOutput = safeParseJSON(outputSection);
  if (parsedOutput === null) return null;

  const validationResult = basicFindingListSchema.safeParse(parsedOutput);
  if (!validationResult.success) {
    console.error("Validation failed for parsed output:", validationResult.error);
    return null;
  }

  return validationResult.data;
}

export function buildFullText(
  sections: Record<string, string>,
  order: Array<keyof typeof sections>,
): string {
  let result = "";
  for (const key of order) {
    if (sections[key] !== undefined) {
      result += `<${key}>\n${sections[key]}\n</${key}>\n`;
    }
  }
  // Add a newline between sections if needed, adjust formatting as desired
  return result.replace(/\n<\//g, "\n</").trim();
}
