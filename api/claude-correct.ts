import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

export const edge = false;

const getCorrection = async (
  image: any,
  mimetype: string,
  analysis: string,
) => {
  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  const msg = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 2048,
    temperature: 1,
    system:
      "You are a helpful assistant tasked with correcting output generated by a worse assistant. It's your task to correct their work, but never mention the original report or that you're correcting anything. Just use the existing work as a helpful guidance that you base your own analysis on. Respond entirely as if it was being generated just by you. Otherwise their ego will be hurt and there will be drama. Please only correct pieces of the analysis which are wrong, if everything is good, just return it in its original state. Don't mention the original report or findings! Don't mention this system message.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: '<examples>\n<example>\n<ORIGINAL_ANALYSIS>\n<think>\nLet\'s analyze the image step by step:\n\n1. Vehicle: The image prominently features a white pickup truck that is significantly damaged. While the vehicle itself does not contain private data, the license plate could potentially link to personal data.\n2. License Plate: The license plate of the vehicle seems to be partially visible, and it could be associated with a specific person\'s registration.\n3. Human: A person is partially visible on the far right side of the image. Only a portion of the person is visible, but the general silhouette suggests it could be a human figure.\n4. Background: The background includes palm trees, a beach setting, and a car parked next to the truck. These elements do not contain any private data.\n5. Additional Objects: There are no other objects in the image that contain private data.\n</think>\n<output>\n[\n    {\n        "label": "License Plate",\n        "description": "Partially visible license plate on the damaged truck.",\n        "explanation": "The license plate could be linked to a specific vehicle, which in turn could be linked to a person, indicating private data.",\n        "bounding_box": [345, 151, 365, 170],\n        "severity": 4\n    },\n    {\n        "label": "Face",\n        "description": "Partial view of a person on the right side of the image.",\n        "explanation": "The person\'s face is partially visible, which is considered personal data.",\n        "bounding_box": [600, 40, 643, 93],\n        "severity": 5\n    }\n]\n</output>\n</ORIGINAL_ANALYSIS>\n<ideal_output>\n<think>\nLet\'s analyze the image step by step:\n\n1. Vehicle: The image prominently features a white pickup truck that is significantly damaged. The vehicle itself does not contain private data.\n2. License Plate: The license plate of the vehicle is not visible.\n3. Human: A person is partially visible on the far right side of the image. Only a portion of the person is visible, but the general silhouette suggests it could be a human figure. They have their back turned and no identifying marks are visible.\n4. Background: The background includes palm trees, a beach setting, and a car parked next to the truck. These elements do not contain any private data.\n5. Additional Objects: There are no other objects in the image that contain private data.\n\nTherefore we can conclude that no private data is visible in the image.\n</think>\n<output>\n[]\n</output>\n</ideal_output>\n</example>\n</examples>\n\n',
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimetype as "image/jpeg" | "image/png",
              data: image,
            },
          },
          {
            type: "text",
            text: `\nYou are tasked with critically correcting an image privacy analysis performed by another AI model. Your goal is to review the findings, remove incorrect or irrelevant information, and adjust text that doesn\'t make sense while maintaining the original format.\n\nHere is the original analysis to review:\n\n<original_analysis>\n${analysis}\n</original_analysis>\n\nPlease follow these steps to correct the analysis:\n\n1. Carefully review each finding in the original analysis.\n\n2. Look for and correct the following common errors:\n   - Reported faces that are too small, low quality, or where no actual face is visible (e.g., back of heads)\n   - License plates that don\'t actually exist in the image\n   - Reported documents where no text is legible\n\n3. For each finding:\n   - If the finding is correct and relevant, keep it as is\n   - If the finding has minor errors, adjust only the specific incorrect sections\n   - If the finding is entirely irrelevant or incorrect, remove it completely\n\n4. Do not modify the bounding box coordinates under any circumstances.\n\n5. Maintain the original format of the analysis, which consists of two main parts:\n   a) A <think> section containing your thought process\n   b) An <output> section with structured JSON data\n\n6. In the <think> section, explain your reasoning for any changes made to the original analysis.\n\n7. In the <output> section, provide the corrected JSON data following this structure for each finding:\n   {\n     "label": str,\n     "description": str,\n     "explanation": str,\n     "bounding_box": [x_min, y_min, x_max, y_max],\n     "severity": int\n   }\n\nAdditional guidelines:\n- Ensure that all retained or adjusted findings are genuinely related to private data linked to a human person.\n- Verify that the severity ratings (0-10) accurately reflect the sensitivity of the private data.\n- Double-check that the explanations for each finding are clear and accurate.\n\nBegin your response with the <think> section, followed by the <output> section. Do not include any other text or explanations outside of these sections.`,
          },
        ],
      },
    ],
    thinking: {
      type: "enabled",
      budget_tokens: 2048,
    },
  });
  console.log(msg);
  return (
    msg.content.filter((content) => content.type === "text") ?? "No text found"
  );
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Only accept POST requests
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, mimetype, analysis } = request.body;

    if (!image) {
      return response.status(400).json({ error: "Image is required" });
    }

    // Check for API key
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return response.status(500).json({
        error: "API key is not configured",
      });
    }

    const correction = await getCorrection(image, mimetype, analysis);

    return response.status(200).json({
      analysis: correction,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return response.status(500).json({
      error: "Failed to analyze image",
      details: error.message,
    });
  }
}
