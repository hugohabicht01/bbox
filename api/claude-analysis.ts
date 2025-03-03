// Vercel API route for Claude image analysis
// This file should be placed in /api/claude-analysis.ts for Vercel deployment

import type { VercelRequest, VercelResponse } from "@vercel/node";

export const edge = false;

const PROMPT = `
  You are an expert at pixel perfect image analysis and in privacy.
  First write down your thoughts within a <think> block.
  Please go through all objects in the image and consider whether they are private data or not.
  End this with a </think> block.

  After going through everything, output your findings in an <output></output> block as a json list with the following keys:
  {"label": str, "description": str, "explanation": str, "bounding_box": [x_min, y_min, x_max, y_max], "severity": int}

  Some things to remember:

  - private data is only data thats linked to a human person, common examples being a persons face, name, address, license plate
  - Severity is a number between 0 and 10, with 0 being not private data and 10 being extremely sensitive private data.
  - don't report items which dont contain private data in the final output, you may mention them in your thoughts
  - animals and animal faces are not personal data, so a giraffe or a dog is not private data
  - you can use whatever format you want within the <think> </think> blocks
  - only output valid JSON in between the <output> </output> blocks, adhering to the schema provided
  - output the bounding box always as an array of form [x_min, y_min, x_max, y_max]
  - private data have a severity greater than 0, so a human face would have severity 6
  - go through the image step by step and report the private data, its better to be a bit too sensitive than to miss anything
  - put the bounding boxes around the human's face and not the entire person when reporting people as personal data
  - Think step by step, take your time.

  Example output:
  <think>
  Let's analyze the image step by step:

  1. Motorcycles: The image contains two motorcycles. These are objects and do not contain any private data.
  2. License Plate: The license plate on the motorcycle reads "AB CD 1234". This could potentially be considered private data as it is linked to a specific vehicle, which in turn could be linked to a person.
  3. Background: The background includes a building and some greenery. These elements do not contain any private data.
  4. Man: A man standing next to one of the motorcycles, his face is considered personal data.
  Other Details: There are no other visible faces, names, addresses, or other personal information in the image.
  </think>
  <output>
  [
    {
      "label": "License Plate",
      "description": "License plate reading 'AB CD EF'.",
      "explanation": "The license plate is linked to a specific vehicle, which could be linked to a person, making it potentially private data.",
      "bounding_box": [18, 248, 128, 380],
      "severity": 3
    },
    {
      "label": "face",
      "description": "A mans face",
      "explanation": "A human face is personal data",
      "bounding_box": [300, 400, 560, 644],
      "severity": 7
    }
  ]
  </output>

  Do not repeat the examples; instead, derive and apply the general pattern.

  Here is the image to analyse, start your analysis directly after:
  `;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Only accept POST requests
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image } = request.body;

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

    // Call Claude API
    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: PROMPT,
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: image,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.json();
      console.error("Claude API error:", errorData);
      return response.status(claudeResponse.status).json({
        error: "Error from Claude API",
        details: errorData,
      });
    }

    const data = await claudeResponse.json();
    return response.status(200).json({
      analysis: data.content[0].text,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return response.status(500).json({
      error: "Failed to analyze image",
      details: error.message,
    });
  }
}
