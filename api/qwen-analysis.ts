import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "@gradio/client";
import { createHash } from 'node:crypto'; // Import crypto

export const edge = false; // Use Node.js runtime

export const config = {
  api: {
    bodyParser: false, // very important! we handle parsing ourselves
  },
};

// Ensure HF_TOKEN is set in environment variables
const HF_TOKEN = process.env.HF_TOKEN;


export type ImageMetaData = {
    path: string;
    url: string;
    size: null;
    orig_name: string;
    mime_type: string | null;
    is_stream: boolean;
    meta: {
      _type: "gradio.FileData";
    };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Only accept POST requests
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (!HF_TOKEN) {
    console.error("HF_TOKEN environment variable is not set.");
    return response.status(500).json({ error: "Server configuration error: Hugging Face token missing." });
  }

  try {
    // TODO: receive the data from the frontend, all later processing will need it as a blob
    const buffers = [];
    for await (const chunk of request) {
      buffers.push(chunk);
    }
    const blobBuffer = Buffer.concat(buffers);
    const mimeType = request.headers['x-file-type'] as string | undefined;
    if (!mimeType) {
      console.error("mime type wasn't passed, defaulting to application/octet-stream");
    }
    const imageBlob = new Blob([blobBuffer], { type: mimeType ?? 'application/octet-stream' });

    // Connect to Gradio client
    console.log("Connecting to Gradio client...");
    const client = await Client.connect("cborg/imgprivllm", { hf_token: HF_TOKEN as `hf_${string}` });
    console.log("Connected to Gradio client.");

    // Call the prediction endpoint
    console.log("Sending image to prediction endpoint...");
    const result = await client.predict("/analyze_image", {
      input_image_pil: imageBlob,
    });
    if (!result.data || !Array.isArray(result.data)) {
      return response.status(400).json({ error: "Error during inference" });
    }
    const text_analysis = result.data[0] as string;
    // const plotted_image_metadata = result.data[1] as ImageMetaData | undefined;
    const anonymised_image_metadata = result.data[2] as ImageMetaData | undefined;

    const response_obj = {
      analysis: text_analysis,
      anonymized_image: anonymised_image_metadata
    }

    return response.status(200).json(response_obj);

  } catch (error) {
    console.error("Error processing request:", error);
    return response.status(500).json({
      error: "Failed to process request",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
