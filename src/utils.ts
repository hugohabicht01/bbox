import { z } from "zod";

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
  id: z.number(),
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

export const findingList = z.array(findingSchema);
export const basicFindingList = z.array(basicFindingSchema);
type basicFinding = z.infer<typeof basicFindingSchema>;

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

export const safeParseJSON = (jsonString: string): any => {
  if (jsonString.trim() === "") return "";
  try {
    return JSON.parse(jsonString);
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
