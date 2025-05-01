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
  private anonymisationEndpoint: string = "/api/anonymise";

  private analyzing: boolean = false;
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
    image: File,
    text_analysis: string
  ): Promise<{  anonymized_image: ImageMetaData }> {
    if (this.anonymising) {
      throw new Error("Anonymisation already in progress.");
    }
    this.anonymising = true;

    const shortened_text_analysis = text_analysis.replace(/<think>.*?<\/think>/s, '<think></think>');

    try {
      // Create a FormData object to send both the image and text analysis
      const formData = new FormData();
      formData.append('image', image);
      formData.append('text_analysis', shortened_text_analysis);

      const response = await fetch(this.anonymisationEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Space API Error: ${response.status} ${response.statusText} - ${errorData.error}`,
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
}
