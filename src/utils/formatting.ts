import { nanoid } from "nanoid";
import type { Finding, BasicFinding, InternalRepr } from "./schemas";
import { getRandomColor } from "./colors";

export function findingToBasicFinding(finding: Finding): BasicFinding {
  // Intentionally strips 'id' and 'color'
  return {
    label: finding.label,
    description: finding.description,
    explanation: finding.explanation,
    bounding_box: finding.bounding_box,
    severity: finding.severity,
  };
}

/**
 * Custom stringify function to format bounding_box arrays nicely on one line.
 * @param findings Array of Finding or BasicFinding objects.
 * @returns Formatted JSON string.
 */
export function customFindingsStringify(
  findings: (Finding | BasicFinding)[],
): string {
  // Use a replacer function to handle the specific formatting
  const replacer = (key: string, value: any) => {
    if (key === "bounding_box" && Array.isArray(value)) {
      // Special formatting for bounding_box array
      // Return a placeholder that we can replace later, avoids JSON validation issues
      return `__BBOX_PLACEHOLDER__[${value.join(", ")}]__`;
    }
    return value;
  };

  let jsonString = JSON.stringify(findings, replacer, 2); // Indent with 2 spaces

  // Replace the placeholder with the desired format
  // Regex needs careful escaping for JSON
  jsonString = jsonString.replace(
    /"__BBOX_PLACEHOLDER__\[([^\]]+)\]__"/g,
    "[$1]",
  );

  return jsonString;
}

/**
 * Formats the internal representation into the full text export format.
 * @param internalRepr The internal representation object.
 * @returns The formatted string with <think> and <output> tags, or an empty string if output is missing.
 */
export function formatInternalReprForExport(internalRepr: InternalRepr): string {
  if (!internalRepr.output) return ""; // Or handle as error

  const cleanedOutput = internalRepr.output
  .map(findingToBasicFinding)
  .map(each => ({...each, bounding_box: each.bounding_box.map(coord => Math.round(coord)) as [number, number, number, number]}));

  const formattedOutput = customFindingsStringify(cleanedOutput);

  // Using a helper or simply concatenating
  return `<think>\n${internalRepr.think}\n</think>\n<output>\n${formattedOutput}\n</output>`;
}

/**
 * Formats just the findings array into the <output> block string.
 * @param findings Array of Finding or BasicFinding objects.
 * @returns String wrapped in <output> tags.
 */
export function formatFindingsOutputBlock(findings: (Finding | BasicFinding)[]): string {
  return `<output>\n${customFindingsStringify(findings)}\n</output>`;
}

/**
 * Converts an array of BasicFinding objects to an array of Finding objects
 * by adding unique IDs and random colors.
 * 
 * @param {BasicFinding[]} basicFindings The array of BasicFinding objects.
 * @returns {Finding[]} The array of Finding objects with added id and color.
 */
export const basicToNormalized = (basicFindings: BasicFinding[]): Finding[] => {
  return basicFindings.map((bf) => ({
    ...bf,
    id: nanoid(),
    color: getRandomColor(),
  }));
};
