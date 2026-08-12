/**
 * DTOs for the Gemma AI inference layer.
 */

export class InferCropDomainDto {
  questionText: string;
  crops: string[];
  domains: string[];
}

/** Raw response from Gemma (Modal endpoint) */
export interface GemmaInferenceResult {
  crop: string;
  domains: string[];
  confidence: number;
  rawResponse?: string;
}