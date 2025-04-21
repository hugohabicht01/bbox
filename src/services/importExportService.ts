import { nanoid } from "nanoid";
import type { Finding, BasicFinding, InternalRepr } from "~/utils/schemas";
import { basicFindingListSchema, internalReprSchema } from "~/utils/schemas";
import { getRandomColor } from "~/utils/colors";
import { getSection, safeParseJSON } from "~/utils/parsers";
import { formatInternalReprForExport } from "~/utils/formatting";

/**
 * Converts an array of BasicFinding objects to Finding objects,
 * adding unique IDs and random colors.
 */
const basicToNormalizedFindings = (basicFindings: BasicFinding[]): Finding[] => {
  return basicFindings.map((bf) => ({
    ...bf,
    id: nanoid(),
    color: getRandomColor(),
  }));
};

/**
 * Parses a JSON string containing a map of filenames to tagged text data,
 * validates, and migrates it to the internal representation.
 * @param jsonString The JSON string to parse.
 * @returns An object containing the migrated data and any errors, or throws an error.
 */
export const parseAndMigrateJsonInput = (
  jsonString: string,
): { migratedData: { [key: string]: InternalRepr }; errors: string[] } => {
  const rawData = safeParseJSON(jsonString);

  if (rawData === null || typeof rawData !== "object" || rawData === null) {
    throw new Error("Invalid input: Not a valid JSON object.");
  }

  const migratedData: { [key: string]: InternalRepr } = {};
  const errors: string[] = [];

  for (const key in rawData) {
    if (Object.prototype.hasOwnProperty.call(rawData, key)) {
      const fileData = (rawData as Record<string, unknown>)[key];

      if (typeof fileData !== "string") {
        errors.push(`Invalid data type for key ${key}: Expected string.`);
        continue;
      }

      try {
        const thinkContent = getSection(fileData, "think");
        const outputContent = getSection(fileData, "output");

        if (thinkContent === "" && outputContent === "") {
          // Allow empty sections if both are not found, treat as valid empty entry?
          // Or error out? Let's assume valid empty for now.
          migratedData[key] = { think: "", output: [] };
          console.warn(`Key ${key}: Both <think> and <output> sections are empty or missing.`);
          continue;
        }

        // We only strictly need to parse the output section for structure
        const parsedOutput = safeParseJSON(outputContent);
        if (parsedOutput === null && outputContent !== "") {
          // Only error if outputContent was not empty but failed to parse
          errors.push(`Invalid JSON in <output> section for key ${key}.`);
          continue;
        }

        // Validate the structure of the parsed output
        const validationResult = basicFindingListSchema.safeParse(parsedOutput || []); // Default to empty array if output was empty

        if (!validationResult.success) {
          errors.push(
            `Invalid finding structure in <output> for key ${key}: ${validationResult.error.message}`,
          );
          continue;
        }

        // Convert BasicFinding[] to Finding[]
        const outputFindings = basicToNormalizedFindings(validationResult.data);

        // Validate the final InternalRepr structure (optional but good practice)
        const finalRepr: InternalRepr = { think: thinkContent, output: outputFindings };
        const finalValidation = internalReprSchema.safeParse(finalRepr);

        if (!finalValidation.success) {
           errors.push(
            `Internal validation failed for key ${key}: ${finalValidation.error.message}`,
          );
          continue;
        }

        migratedData[key] = finalValidation.data;

      } catch (err: any) {
        errors.push(`Unexpected error processing key ${key}: ${err.message}`);
      }
    }
  }

  if (Object.keys(migratedData).length === 0 && errors.length > 0) {
     throw new Error(
       `Failed to migrate any data. Errors encountered: ${errors.join("; ")}`,
     );
  }

  return { migratedData, errors };
};

/**
 * Exports all findings (mapped by image key) into a single JSON string.
 * @param allLabels A record mapping image keys to their InternalRepr.
 * @returns A JSON string ready for export.
 */
export const exportAllFindingsToJson = (allLabels: Record<string, InternalRepr>): string => {
    const exportData: Record<string, string> = {};
    for (const key in allLabels) {
        if (Object.prototype.hasOwnProperty.call(allLabels, key)) {
            exportData[key] = formatInternalReprForExport(allLabels[key]);
        }
    }
    // Stringify the entire map
    return JSON.stringify(exportData, null, 2); // Pretty print JSON
};
