export interface FitParameter {
  name: string;
  value: number;
  uncertainty: number;
  rounded: string;
  latex: string;
}

export interface GoodnessOfFit {
  chiSquaredReduced: number | null;
  rSquared: number | null;
  pValue: number | null;
  dof: number | null;
}

export interface FitSection {
  modelName: string;
  parameters: FitParameter[];
  goodnessOfFit: GoodnessOfFit;
  xData: number[];
  yData: number[];
  xErrors: number[] | null;
  yErrors: number[] | null;
  xFit: number[];
  yFit: number[];
  residuals: number[];
}

export interface FormulaSection {
  expression: string;
  value: number;
  uncertainty: number;
  formatted: string;
  latex: string;
}

export interface NSigmaSection {
  nSigma: number;
  verdict: string;
  theoreticalValue: number;
  theoreticalUncertainty: number;
}

export interface ReportAnalysisData {
  fit: FitSection | null;
  formula: FormulaSection | null;
  nsigma: NSigmaSection | null;
  summary: string | null;
  instructions: string;
  filename: string;
}
