export type AnalysisResult = {
  hireProbability: number;
  confidence: "Low" | "Medium" | "High";

  rejectionReasons: {
    high: string[];
    medium: string[];
    low: string[];
  };

  fitSummary: string[];
  strengths: string[];
  improvements: string[];
};