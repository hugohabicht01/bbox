import type { ImageMetaData } from "api/qwen-analysis";
import type { BboxType } from "./utils/schemas";

export function bboxEquals(bbox1: BboxType, bbox2: BboxType): boolean {
  if (!bbox1 || !bbox2) return false;
  if (bbox1.length !== 4 || bbox2.length !== 4) return false;
  return (
    bbox1[0] === bbox2[0] &&
    bbox1[1] === bbox2[1] &&
    bbox1[2] === bbox2[2] &&
    bbox1[3] === bbox2[3]
  );
}

// Claude API service with proxy approach for security
export class ClaudeService {
  private static instance: ClaudeService;
  private apiEndpoint: string = "/api/qwen-analysis";
  private anonymisationEndpoint: string = "/api/anonymise"
  private correctionEndpoint: string = "/api/claude-correct";

  private analyzing: boolean = false;
  private correcting: boolean = false;
  private anonymising: boolean = false;

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

  public isCorrecting(): boolean {
    return this.correcting;
  }

  public isAnonymising(): boolean {
    return this.anonymising;
  }

  public async analyzeImage(
    image: File
  ): Promise<{ analysis: string; anonymized_image?: ImageMetaData }> {
    if (this.analyzing) {
      throw new Error("Analysis already in progress.");
    }
    this.analyzing = true;

    // Compute SHA256 hash in the browser
    const imageBuffer = await image.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', imageBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert buffer to byte array
    const imageSha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // Convert bytes to hex string
    console.log('SHA256 hash of image:', imageSha256);

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Type': image.type,
        },
        body: image,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Qwen API Error: ${response.status} ${response.statusText} - ${errorData.error}`,
        );
      }

      const data: { analysis: string; anonymized_image?: any } = await response.json();
      // basic validation that we get the expected format
      console.log("data received from vercel function:")
      console.log(data)
      if (typeof data.analysis !== 'string' || !data.analysis.includes('<think>') || !data.analysis.includes('<output>')) {
          throw new Error('Invalid analysis format received from server.');
      }
      return data;
    } catch (error) {
      console.error("Error during image analysis:", error);
      throw error; // Re-throw to allow caller handling
    } finally {
      this.analyzing = false;
    }
  }


  public async anonymiseImage(
    image: File
  ): Promise<{  anonymized_image: ImageMetaData }> {
    if (this.anonymising) {
      throw new Error("Anonymisation already in progress.");
    }
    this.anonymising = true;

    try {
      const response = await fetch(this.anonymisationEndpoint, {
        method: "POST",
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Type': image.type,
        },
        body: image,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Qwen API Error: ${response.status} ${response.statusText} - ${errorData.error}`,
        );
      }

      const data: { anonymized_image: ImageMetaData } = await response.json();
      // basic validation that we get the expected format
      console.log("data received from vercel function:")
      console.log(data)
      return data;
    } catch (error) {
      console.error("Error during image anonymisation:", error);
      throw error; // Re-throw to allow caller handling
    } finally {
      this.anonymising = false;
    }
  }


  public async correctAnalysis(
    imageBase64: string,
    imageMimetype: string,
    analysis: string,
  ): Promise<string> {
    if (this.correcting) {
      throw new Error("Correction already in progress.");
    }
    this.correcting = true;

    try {
      const response = await fetch(this.correctionEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          image_mimetype: imageMimetype,
          analysis: analysis,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Claude Correction API Error: ${response.status} ${response.statusText} - ${errorData.error}`,
        );
      }

      const data = await response.json();
       // basic validation that we get the expected format
      if (typeof data.corrected_analysis !== 'string' || !data.corrected_analysis.includes('<think>') || !data.corrected_analysis.includes('<output>')) {
          throw new Error('Invalid corrected analysis format received from server.');
      }
      return data.corrected_analysis;
    } catch (error) {
      console.error("Error during analysis correction:", error);
      throw error; // Re-throw to allow caller handling
    } finally {
      this.correcting = false;
    }
  }
}
