import type { ComponentContract } from "../types";

type HugoUIContractProp = {
  name: string;
  type?: string;
  required?: boolean;
  values?: string[];
  defaultValue?: unknown;
  description?: string;
  source?: string;
  aiUsage?: "normal" | "discouraged" | "conditional" | "forbidden-conflict" | string;
  recommendedValues?: string[];
  discouragedValues?: string[];
};

type HugoUINamedPolicy = {
  name: string;
  reason?: string;
  source?: string;
};

export type HugoUIComponentContract = {
  schemaVersion: string;
  packageName: string;
  packageVersion?: string;
  componentName: string;
  importName: string;
  importStatement?: string;
  props?: HugoUIContractProp[];
  forbiddenProps?: HugoUINamedPolicy[];
  discouragedProps?: HugoUINamedPolicy[];
  designMappings?: Record<string, unknown>;
  generationRules?: Array<Record<string, unknown>>;
  validationRules?: Array<Record<string, unknown>>;
  tokenPolicy?: Record<string, unknown>;
  [key: string]: unknown;
};

export function adaptHugoUIMuiContract(
  sourceContract: HugoUIComponentContract,
  sourceContractPath: string
): ComponentContract {
  const props = sourceContract.props ?? [];
  const forbiddenFromProps = props
    .filter((prop) => prop.aiUsage === "forbidden-conflict")
    .map((prop) => prop.name);
  const forbiddenProps = unique([
    ...(sourceContract.forbiddenProps ?? []).map((prop) => prop.name),
    ...forbiddenFromProps
  ]);
  const forbiddenSet = new Set(forbiddenProps);
  const allowedProps = Object.fromEntries(
    props
      .filter((prop) => !forbiddenSet.has(prop.name))
      .map((prop) => [
        prop.name,
        {
          type: prop.type ?? "unknown",
          required: prop.required === true,
          values: prop.values ?? [],
          defaultValue: prop.defaultValue ?? null,
          description: prop.description ?? "",
          source: prop.source ?? "",
          aiUsage: prop.aiUsage ?? "normal",
          recommendedValues: prop.recommendedValues ?? [],
          discouragedValues: prop.discouragedValues ?? []
        }
      ])
  );
  const discouragedProps = unique([
    ...(sourceContract.discouragedProps ?? []).map((prop) => prop.name),
    ...props
      .filter((prop) => prop.aiUsage === "discouraged")
      .map((prop) => prop.name)
  ]).filter((propName) => !forbiddenSet.has(propName));
  const conditionalProps = unique(
    props
      .filter((prop) => prop.aiUsage === "conditional")
      .map((prop) => prop.name)
  );

  return {
    schemaVersion: "component-contract/v1",
    componentName: sourceContract.componentName,
    packageName: sourceContract.packageName,
    importName: sourceContract.importName,
    description:
      typeof sourceContract.description === "string"
        ? sourceContract.description
        : `${sourceContract.componentName} contract adapted from @hugo-ui/mui AI contract artifact.`,
    requiredProps: props
      .filter((prop) => prop.required === true && !forbiddenSet.has(prop.name))
      .map((prop) => prop.name),
    allowedProps,
    forbiddenProps,
    discouragedProps,
    conditionalProps,
    designMappings: sourceContract.designMappings,
    policy: {
      sourceArtifact: "vendor/hugo-ui/mui-ai-contract",
      sourceContractPath,
      discouragedProps: sourceContract.discouragedProps ?? [],
      conditionalProps: props.filter((prop) => prop.aiUsage === "conditional"),
      generationRules: sourceContract.generationRules ?? [],
      validationRules: sourceContract.validationRules ?? [],
      tokenPolicy: sourceContract.tokenPolicy
    },
    rawContract: sourceContract
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
