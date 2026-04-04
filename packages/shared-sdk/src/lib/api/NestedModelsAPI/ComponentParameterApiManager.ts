import { Delete, Get, Patch, Post } from "../NestedModelApiManager";

const DATA_ANALYSIS_ENDPOINT = "/api/nested-models/data-analysis";

export type ComponentParameterType = {
  id: number;
  dataAnalysisId: number;
  componentType: string;
  componentFailureMode: string;
  grouping?: string;
  description?: string;
  dataSource?: string;
  failures?: number;
  units?: string;
  dhUnit?: string;
  dhValue?: number;
  componentCount?: number;
  distribution?: string;
  analysisType?: string;
  fth?: number;
  median?: number;
  nfth?: number;
  alpha?: number;
  beta?: number;
  mean?: number;
  errorFactor?: number;
  dateRange?: string;
  effectiveDate?: string;
};

export type CreateComponentParameterBody = Omit<ComponentParameterType, "id" | "dataAnalysisId">;

export type UpdateComponentParameterBody = Partial<CreateComponentParameterBody>;

export async function GetComponentParameters(dataAnalysisId: number): Promise<ComponentParameterType[]> {
  try {
    const response = await Get(`${DATA_ANALYSIS_ENDPOINT}/${dataAnalysisId}/parameters`);
    return (await response.json()) as ComponentParameterType[];
  } catch (error) {
    console.error("Failed to fetch component parameters:", error);
    throw error;
  }
}

export async function PostComponentParameter(
  dataAnalysisId: number,
  body: CreateComponentParameterBody,
): Promise<ComponentParameterType> {
  try {
    const response = await Post(
      `${DATA_ANALYSIS_ENDPOINT}/${dataAnalysisId}/parameters`,
      body as unknown as Parameters<typeof Post>[1],
    );
    return (await response.json()) as ComponentParameterType;
  } catch (error) {
    console.error("Failed to create component parameter:", error);
    throw error;
  }
}

export async function PatchComponentParameter(
  paramId: number,
  body: UpdateComponentParameterBody,
): Promise<ComponentParameterType> {
  try {
    const response = await Patch(`${DATA_ANALYSIS_ENDPOINT}/parameters/${paramId}`, body);
    return (await response.json()) as ComponentParameterType;
  } catch (error) {
    console.error("Failed to update component parameter:", error);
    throw error;
  }
}

export async function DeleteComponentParameter(paramId: number): Promise<void> {
  try {
    await Delete(`${DATA_ANALYSIS_ENDPOINT}/parameters/${paramId}`);
  } catch (error) {
    console.error("Failed to delete component parameter:", error);
    throw error;
  }
}
