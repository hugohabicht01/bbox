import { z } from "zod";

export function customFindingsStringify(
  findings: (Finding | BasicFinding)[],
): string {
  return JSON.stringify(findings, null, 4).replace(
    /"bounding_box": \[\s*([^\]]+?)\s*\]/gs,
    (match, arrayContent) => {
      return `"bounding_box": [${arrayContent.replace(/,\s*/g, ", ")}]`;
    },
  );
}

export const bboxSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine((coords) => coords.every((n) => n >= 0), {
    message: "All coordinates must be non-negative",
  })
  .refine((coords) => coords[0] < coords[2] && coords[1] < coords[3], {
    message: "x_min must be less than x_max and y_min must be less than y_max",
  });
export type BboxType = z.infer<typeof bboxSchema>;

export const basicFindingSchema = z.object({
  label: z.string(),
  description: z.string(),
  explanation: z.string(),
  bounding_box: bboxSchema,
  severity: z.number(),
});

export type BasicFinding = z.infer<typeof basicFindingSchema>;

export const findingSchema = z.object({
  color: z.string(),
  id: z.string().nanoid(),
  label: z.string(),
  description: z.string(),
  explanation: z.string(),
  bounding_box: bboxSchema,
  severity: z.number(),
});

export const getRandomColor = (): string => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

export type InternalRepr = {
  think: string;
  output: Array<Finding>;
};

export const findingToBasicFinding = (finding: Finding) => ({
  label: finding.label,
  description: finding.description,
  explanation: finding.explanation,
  bounding_box: finding.bounding_box,
  severity: finding.severity,
});

export const internalToExport = (internal: InternalRepr): string => {
  const { think, output } = internal;
  const cleanedOutput = output.map(findingToBasicFinding);

  return `<think>\n${think}\n</think>\n<output>\n${customFindingsStringify(cleanedOutput)}\n</output>`;
};

export const basicTextValidator = z
  .string()
  .refine(
    (str) => {
      /* just ensure that we have think section and output section, checks could be a lot more tight
  General input format:
  (the output section is a json list of type script types Finding or BasicFinding (usually BasicFinding))
  <think>
    Some text here, content is not parsable beyond string form
  </think>

  <output>
  (BasicFinding|Finding)[]
  </output>
  */
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
      if (!thinkSection || !outputSection) return false;

      return true;
    },
    { message: "Does not have think and output sections" },
  )
  .refine(
    (str) => {
      const findings = getStructuredBasicFindings(str);
      if (!findings) return false;
      return true;
    },
    {
      message: "Structured output does not have the correct JSON array format",
    },
  );

export const getStructuredBasicFindings = (str: string) => {
  const outputSection = safeParseJSON(getSection(str, "output"));
  if (!outputSection) return null;

  // this is the usual format we expect, it will also match for Array<Finding> as that just has extra keys which get filtered
  const res = basicFindingList.safeParse(outputSection);
  if (!res.success) {
    return null;
  }
  return res.data;
};

export const findingList = z.array(findingSchema);
export const basicFindingList = z.array(basicFindingSchema);
export type basicFinding = z.infer<typeof basicFindingSchema>;

export type Finding = z.infer<typeof findingSchema>;

export const getSection = (text: string, sectionMarker: string) => {
  const sectionStartMarker = `<${sectionMarker}>`;
  const sectionEndMarker = `</${sectionMarker}>`;
  const sectionStart = text.search(sectionStartMarker);
  if (sectionStart === -1) return "";
  const sectionEnd = text.search(sectionEndMarker);
  if (sectionEnd === -1) return "";
  return text.slice(sectionStart + sectionStartMarker.length, sectionEnd);
};

export const safeParseJSON = (jsonString: string): unknown | null => {
  if (jsonString.trim() === "") return "";
  try {
    return JSON.parse(jsonString) as unknown;
  } catch (error) {
    return null;
  }
};

export const buildFullText = (
  sections: Record<string, string>,
  order: Array<keyof typeof sections>,
) => {
  return order
    .map((key) => {
      const sectionData = sections[key];
      const sectionStartMarker = `<${key}>`;
      const sectionEndMarker = `</${key}>`;

      return `${sectionStartMarker}\n${sectionData}\n${sectionEndMarker}`;
    })
    .join("\n");
};

export const bboxEquals = (bbox1: BboxType, bbox2: BboxType) => {
  return (
    bbox1[0] === bbox2[0] &&
    bbox1[1] === bbox2[1] &&
    bbox1[2] === bbox2[2] &&
    bbox1[3] === bbox2[3]
  );
};

// Claude API service with proxy approach for security
export class ClaudeService {
  private static instance: ClaudeService;
  private apiEndpoint: string = "/api/claude-analysis";
  private analyzing: boolean = false;

  private constructor() {}

  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  public isAnalyzing(): boolean {
    return this.analyzing;
  }

  public async analyzeImage(
    imageBase64: string,
    imageMimetype: string,
  ): Promise<string> {
    try {
      this.analyzing = true;

      // Ensure the base64 string doesn't have the data URL prefix
      const base64Data = imageBase64.startsWith("data:")
        ? imageBase64.split(",")[1]
        : imageBase64;

      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Data, mimetype: imageMimetype }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      return data.analysis;
    } catch (error) {
      console.error("Error analyzing image with Claude:", error);
      return "Error analyzing image. Please try again later.";
    } finally {
      this.analyzing = false;
    }
  }
}
