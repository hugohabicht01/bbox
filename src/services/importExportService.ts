import { nanoid } from "nanoid";
import type {
  Finding,
  BasicFinding,
  InternalRepr,
  BboxType,
} from "~/utils/schemas";
import {
  basicFindingListSchema,
  internalReprSchema,
  basicFindingSchema,
} from "~/utils/schemas";
import { getRandomColor } from "~/utils/colors";
import { getSection, safeParseJSON } from "~/utils/parsers";

// --- Internal Helper Functions ---

/**
 * Converts a Finding object to a BasicFinding object by stripping 'id' and 'color'.
 * Internal helper for export formatting.
 */
const _findingToBasicFinding = (finding: Finding): BasicFinding => {
  // Intentionally strips 'id' and 'color'
  return {
    label: finding.label,
    description: finding.description,
    explanation: finding.explanation,
    bounding_box: finding.bounding_box,
    severity: finding.severity,
  };
};

/**
 * Converts an array of BasicFinding objects to Finding objects,
 * adding unique IDs and random colors. Internal helper for import/parsing.
 */
const _normalizeBasicFindings = (basicFindings: BasicFinding[]): Finding[] => {
  return basicFindings.map((bf) => ({
    ...bf,
    id: nanoid(), // Use nanoid for unique IDs
    color: getRandomColor(),
  }));
};

/**
 * Custom stringify function to format bounding_box arrays nicely on one line.
 * Internal helper for formatting output strings.
 */
export const _customFindingsStringify = (
  findings: BasicFinding[], // Expects BasicFinding for export consistency
): string => {
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
  jsonString = jsonString.replace(
    /"__BBOX_PLACEHOLDER__\[([^\]]+)\]__"/g,
    "[$1]",
  );

  return jsonString;
};

// --- Service Interface Functions ---

/**
 * Parses the content of an <output> block (JSON array string) into the internal Finding[] format.
 * Handles JSON parsing, schema validation, and normalization (adding id/color).
 *
 * @param outputString The string content of the <output> tag.
 * @returns An object containing the parsed data or an error message.
 */
export const parseOutputString = (
  outputString: string,
): { data: Finding[] | null; error: string | null } => {
  if (!outputString || outputString.trim() === "") {
    return { data: [], error: null }; // Treat empty string as empty array
  }

  const parsedJson = safeParseJSON(outputString);
  if (parsedJson === null) {
    return { data: null, error: "Invalid JSON format in output section." };
  }

  // Validate the structure of the parsed output
  const validationResult = basicFindingListSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    // Attempt to parse single finding if list fails (e.g., from older formats or mistakes)
    const singleFindingResult = basicFindingSchema.safeParse(parsedJson);
    if (singleFindingResult.success) {
      console.warn(
        "Parsed output as a single finding object, wrapping in array.",
      );
      const normalized = _normalizeBasicFindings([singleFindingResult.data]);
      return { data: normalized, error: null };
    }

    return {
      data: null,
      error: `Invalid finding structure: ${validationResult.error.flatten().fieldErrors}`,
    };
  }

  // Convert BasicFinding[] to Finding[]
  const outputFindings = _normalizeBasicFindings(validationResult.data);
  return { data: outputFindings, error: null };
};

/**
 * Parses the full tagged text (<think>...</think><output>...</output>) into an InternalRepr object.
 *
 * @param taggedText The full text content.
 * @returns An object containing the parsed InternalRepr data or an error message.
 */
export const parseTaggedText = (
  taggedText: string,
): { data: InternalRepr | null; error: string | null } => {
  if (!taggedText || taggedText.trim() === "") {
    return { data: { think: "", output: [] }, error: null }; // Valid empty repr for empty input
  }

  const thinkContent = getSection(taggedText, "think");
  const outputContent = getSection(taggedText, "output");

  // If both tags are missing, but there's content, it's an error
  if (thinkContent === "" && outputContent === "" && taggedText.trim() !== "") {
    // Check if it's just JSON - might be only output section without tags
    const parseResult = parseOutputString(taggedText.trim());
    if (parseResult.data) {
      console.warn(
        "Input text appears to be only an output section (JSON array). Using empty think text.",
      );
      return { data: { think: "", output: parseResult.data }, error: null };
    } else {
      return {
        data: null,
        error:
          "Invalid format: Missing <think> and <output> tags, and content is not valid JSON output.",
      };
    }
  }

  const outputParseResult = parseOutputString(outputContent);

  if (outputParseResult.error) {
    return {
      data: null,
      error: `Failed to parse <output> section: ${outputParseResult.error}`,
    };
  }

  const finalRepr: InternalRepr = {
    think: thinkContent,
    output: outputParseResult.data || [], // Use empty array if parsing resulted in null data (shouldn't happen with current logic)
  };

  // Final validation against the InternalRepr schema (optional but good practice)
  const finalValidation = internalReprSchema.safeParse(finalRepr);
  if (!finalValidation.success) {
    return {
      data: null,
      error: `Internal validation failed: ${finalValidation.error.message}`,
    };
  }

  return { data: finalValidation.data, error: null };
};

/**
 * Parses a JSON string containing a map of filenames to tagged text data,
 * validates, and migrates it to the internal representation.
 * Returns successfully migrated data and a list of errors encountered.
 *
 * @param jsonString The JSON string to parse.
 * @returns An object containing the migrated data map and an array of errors.
 */
export const parseAndMigrateJsonInput = (
  jsonString: string,
): {
  migratedData: { [key: string]: InternalRepr };
  errors: { key: string; message: string }[];
} => {
  const migratedData: { [key: string]: InternalRepr } = {};
  const errors: { key: string; message: string }[] = [];

  const rawData = safeParseJSON(jsonString);

  if (
    rawData === null ||
    typeof rawData !== "object" ||
    Array.isArray(rawData)
  ) {
    errors.push({
      key: "GLOBAL",
      message:
        "Invalid input: Expected a JSON object mapping filenames to tagged text strings.",
    });
    return { migratedData, errors }; // Return empty data and global error
  }

  for (const key in rawData) {
    if (Object.prototype.hasOwnProperty.call(rawData, key)) {
      const fileData = (rawData as Record<string, unknown>)[key];

      if (typeof fileData !== "string") {
        errors.push({
          key: key,
          message: `Invalid data type for key ${key}: Expected string. Found ${typeof fileData}.`,
        });
        continue;
      }

      const parseResult = parseTaggedText(fileData);

      if (parseResult.data !== null) {
        migratedData[key] = parseResult.data;
        // Even if data is present, there might have been a non-fatal parsing warning/error
        if (parseResult.error) {
          errors.push({
            key: key,
            message: `Partial success with error: ${parseResult.error}`,
          });
        }
      } else {
        // Only add error if data is null (fatal parsing error)
        errors.push({
          key: key,
          message:
            parseResult.error ||
            `Unknown error parsing tagged text for key ${key}.`,
        });
      }
    }
  }

  // No need to throw error here, return collected data and errors
  return { migratedData, errors };
};

/**
 * Formats an InternalRepr object into the full tagged text string (<think>...</think><output>...</output>)
 * suitable for saving or exporting. Rounds coordinates.
 *
 * @param internalRepr The internal representation object.
 * @returns The formatted string. Returns empty string for null/undefined input.
 */
export function formatInternalReprForExport(
  internalRepr: InternalRepr | null | undefined,
): string {
  if (!internalRepr) return "";

  // Convert Findings to BasicFindings and round coordinates
  const cleanedOutput = (internalRepr.output || [])
    .map(_findingToBasicFinding)
    .map((finding) => ({
      ...finding,
      bounding_box: finding.bounding_box.map((coord) =>
        Math.round(coord),
      ) as BboxType, // Ensure type assertion
    }));

  const formattedOutput = _customFindingsStringify(cleanedOutput);
  const thinkText = internalRepr.think || ""; // Ensure think text is a string

  // Handle cases where output might be empty after cleaning/formatting
  const outputBlock =
    formattedOutput && formattedOutput !== "[]"
      ? `\n<output>\n${formattedOutput}\n</output>`
      : "\n<output>\n[]\n</output>"; // Always include output block, even if empty

  const thinkBlock = thinkText
    ? `<think>\n${thinkText}\n</think>`
    : "<think>\n</think>";

  return `${thinkBlock}${outputBlock}`;
}

/**
 * Formats an InternalRepr object into the full tagged text string (<think>...</think><output>...</output>)
 * suitable for display (e.g., in a textarea). Does not round coordinates.
 *
 * @param internalRepr The internal representation object.
 * @returns The formatted string. Returns empty string for null/undefined input.
 */
export function formatInternalReprForDisplay(
  internalRepr: InternalRepr | null | undefined,
): string {
  if (!internalRepr) return "";

  // Convert Findings to BasicFindings, but DO NOT round coordinates for display
  const displayOutput = (internalRepr.output || []).map(_findingToBasicFinding);

  const formattedOutput = _customFindingsStringify(displayOutput);
  const thinkText = internalRepr.think || ""; // Ensure think text is a string

  // Handle cases where output might be empty after cleaning/formatting
  const outputBlock =
    formattedOutput && formattedOutput !== "[]"
      ? `\n<output>\n${formattedOutput}\n</output>`
      : "\n<output>\n[]\n</output>"; // Always include output block, even if empty

  const thinkBlock = thinkText
    ? `<think>\n${thinkText}\n</think>`
    : "<think>\n</think>";

  return `${thinkBlock}${outputBlock}`;
}

/**
 * Exports all findings (mapped by image key) into a single JSON string.
 * Uses the export-specific formatting function.
 *
 * @param allLabels A record mapping image keys (filenames) to their InternalRepr.
 * @returns A JSON string ready for export.
 */
export const exportAllFindingsToJson = (
  allLabels: Record<string, InternalRepr>,
): string => {
  const exportData: Record<string, string> = {};
  for (const key in allLabels) {
    if (Object.prototype.hasOwnProperty.call(allLabels, key)) {
      // Use the export-specific formatting function
      exportData[key] = formatInternalReprForExport(allLabels[key]);
    }
  }
  // Stringify the entire map with pretty printing
  return JSON.stringify(exportData, null, 2);
};
