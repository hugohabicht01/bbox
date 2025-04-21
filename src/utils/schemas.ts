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

export const findingSchema = basicFindingSchema.extend({
  color: z.string(),
  id: z.string(), // Using nanoid generated strings
});

export type Finding = z.infer<typeof findingSchema>;

export const internalReprSchema = z.object({
  think: z.string(),
  output: z.array(findingSchema),
});

export type InternalRepr = z.infer<typeof internalReprSchema>;

export const findingListSchema = z.array(findingSchema);
export const basicFindingListSchema = z.array(basicFindingSchema);
