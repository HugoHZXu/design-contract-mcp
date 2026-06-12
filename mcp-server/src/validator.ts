import type {
  ComponentContract,
  ValidationCheck,
  ValidationOptions,
  ValidationReport,
  ValidationViolation
} from "./types";

type OpeningTag = {
  name: string;
  attrs: string;
};

const rawColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const nameCharPattern = /[A-Za-z0-9_$:.-]/;
const globalAllowedProps = new Set(["key", "ref"]);

export function validateGeneratedCode(
  code: string,
  contracts: ComponentContract[],
  options: ValidationOptions = {}
): ValidationReport {
  const violations: ValidationViolation[] = [];
  const contractByTagName = new Map(
    contracts.map((contract) => [contract.importName, contract])
  );
  const openingTags = scanOpeningTags(code).filter((tag) =>
    contractByTagName.has(tag.name)
  );
  const usedTagNames = [...new Set(openingTags.map((tag) => tag.name))];
  const importsBySource = parseNamedImports(code);

  for (const tagName of usedTagNames) {
    const contract = contractByTagName.get(tagName);
    if (!contract) {
      continue;
    }

    const namedImports = importsBySource.get(contract.packageName);
    if (!namedImports?.has(contract.importName)) {
      violations.push({
        rule: "missing-import",
        componentName: contract.componentName,
        message: `${contract.importName} must be imported from ${contract.packageName}.`
      });
    }
  }

  for (const tag of openingTags) {
    const contract = contractByTagName.get(tag.name);
    if (!contract) {
      continue;
    }

    const props = extractJsxProps(tag.attrs);
    const propSet = new Set(props.filter((prop) => prop !== "__spread"));

    if (props.includes("__spread")) {
      violations.push({
        rule: "spread-props",
        componentName: contract.componentName,
        message: `${contract.componentName} uses spread props, which this demo validator cannot verify.`
      });
    }

    for (const requiredProp of contract.requiredProps) {
      if (requiredProp === "children") {
        continue;
      }

      if (!propSet.has(requiredProp)) {
        violations.push({
          rule: "missing-required-prop",
          componentName: contract.componentName,
          prop: requiredProp,
          message: `${contract.componentName} is missing required prop "${requiredProp}".`
        });
      }
    }

    for (const prop of propSet) {
      if (contract.forbiddenProps.includes(prop)) {
        violations.push({
          rule: "forbidden-prop",
          componentName: contract.componentName,
          prop,
          message: `${contract.componentName} uses forbidden prop "${prop}".`
        });
        continue;
      }

      if (!isAllowedProp(prop, contract)) {
        violations.push({
          rule: "unknown-prop",
          componentName: contract.componentName,
          prop,
          message: `${contract.componentName} uses prop "${prop}", which is not in its contract.`
        });
      }
    }
  }

  if (!options.expectedComponentUsage?.length) {
    violations.push({
      rule: "missing-expected-component-usage",
      message:
        "Expected component usage is required to validate generated code coverage."
    });
  } else {
    const expectedCounts = countExpectedUsage(options.expectedComponentUsage);
    const foundCounts = countFoundUsage(openingTags, contractByTagName);

    for (const [componentName, expectedCount] of expectedCounts) {
      const foundCount = foundCounts.get(componentName) ?? 0;
      if (foundCount < expectedCount) {
        violations.push({
          rule: "missing-component-coverage",
          componentName,
          expectedCount,
          foundCount,
          message: `Expected ${expectedCount} ${componentName} usage(s) from context pack, found ${foundCount}.`
        });
      }
    }
  }

  for (const match of code.matchAll(rawColorPattern)) {
    violations.push({
      rule: "raw-color",
      value: match[0],
      message: `Generated code contains raw color literal "${match[0]}". Use token references instead.`
    });
  }

  const checks: ValidationCheck[] = [
    {
      id: "imports",
      status: hasRule(violations, "missing-import") ? "fail" : "pass",
      message: hasRule(violations, "missing-import")
        ? "One or more mapped components are missing required imports."
        : "Mapped components are imported from their contract packages."
    },
    {
      id: "props",
      status: hasAnyRule(violations, [
        "forbidden-prop",
        "unknown-prop",
        "missing-required-prop",
        "spread-props"
      ])
        ? "fail"
        : "pass",
      message: hasAnyRule(violations, [
        "forbidden-prop",
        "unknown-prop",
        "missing-required-prop",
        "spread-props"
      ])
        ? "Generated component props do not fully match contracts."
        : "Generated component props match the contracts."
    },
    {
      id: "coverage",
      status: hasAnyRule(violations, [
        "missing-component-coverage",
        "missing-expected-component-usage"
      ])
        ? "fail"
        : "pass",
      message: options.expectedComponentUsage?.length
        ? hasRule(violations, "missing-component-coverage")
          ? "Generated JSX does not cover every mapped component from the context pack."
          : "Generated JSX covers the mapped components from the context pack."
        : "Expected component usage is required to validate coverage."
    },
    {
      id: "raw-colors",
      status: hasRule(violations, "raw-color") ? "fail" : "pass",
      message: hasRule(violations, "raw-color")
        ? "Generated code contains raw color literals."
        : "Generated code does not contain raw color literals."
    }
  ];

  return {
    valid: violations.length === 0,
    checks,
    violations
  };
}

function parseNamedImports(code: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const importPattern = /import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?/g;

  for (const match of code.matchAll(importPattern)) {
    const specifier = match[1] ?? "";
    const source = match[2] ?? "";
    const namedBlock = specifier.match(/\{([\s\S]*?)\}/);

    if (!namedBlock) {
      continue;
    }

    const imports = result.get(source) ?? new Set<string>();
    for (const rawName of namedBlock[1].split(",")) {
      const name = rawName.trim().split(/\s+as\s+/i)[0]?.trim();
      if (name) {
        imports.add(name);
      }
    }
    result.set(source, imports);
  }

  return result;
}

function countExpectedUsage(
  expectedUsage: NonNullable<ValidationOptions["expectedComponentUsage"]>
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const usage of expectedUsage) {
    counts.set(usage.componentName, (counts.get(usage.componentName) ?? 0) + 1);
  }

  return counts;
}

function countFoundUsage(
  openingTags: OpeningTag[],
  contractByTagName: Map<string, ComponentContract>
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const tag of openingTags) {
    const contract = contractByTagName.get(tag.name);
    if (!contract) {
      continue;
    }
    counts.set(
      contract.componentName,
      (counts.get(contract.componentName) ?? 0) + 1
    );
  }

  return counts;
}

function scanOpeningTags(code: string): OpeningTag[] {
  const tags: OpeningTag[] = [];

  for (let i = 0; i < code.length; i += 1) {
    if (code[i] !== "<") {
      continue;
    }

    const firstNameChar = code[i + 1];
    if (!firstNameChar || code[i + 1] === "/" || !/[A-Z]/.test(firstNameChar)) {
      continue;
    }

    let cursor = i + 1;
    while (cursor < code.length && nameCharPattern.test(code[cursor])) {
      cursor += 1;
    }

    const name = code.slice(i + 1, cursor);
    const attrsStart = cursor;
    let quote: string | null = null;
    let braceDepth = 0;

    while (cursor < code.length) {
      const char = code[cursor];
      const previous = code[cursor - 1];

      if (quote) {
        if (char === quote && previous !== "\\") {
          quote = null;
        }
        cursor += 1;
        continue;
      }

      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        cursor += 1;
        continue;
      }

      if (char === "{") {
        braceDepth += 1;
        cursor += 1;
        continue;
      }

      if (char === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
        cursor += 1;
        continue;
      }

      if (char === ">" && braceDepth === 0) {
        break;
      }

      cursor += 1;
    }

    if (cursor < code.length) {
      tags.push({
        name,
        attrs: code.slice(attrsStart, cursor)
      });
    }
  }

  return tags;
}

function extractJsxProps(attrs: string): string[] {
  const props: string[] = [];
  let cursor = 0;

  while (cursor < attrs.length) {
    cursor = skipWhitespaceAndSlash(attrs, cursor);

    if (attrs.startsWith("{...", cursor)) {
      props.push("__spread");
      cursor = skipBracedValue(attrs, cursor);
      continue;
    }

    const char = attrs[cursor];
    if (!char || !/[A-Za-z_$]/.test(char)) {
      cursor += 1;
      continue;
    }

    const start = cursor;
    cursor += 1;
    while (cursor < attrs.length && nameCharPattern.test(attrs[cursor])) {
      cursor += 1;
    }

    const propName = attrs.slice(start, cursor);
    props.push(propName);
    cursor = skipWhitespaceAndSlash(attrs, cursor);

    if (attrs[cursor] === "=") {
      cursor = skipJsxValue(attrs, cursor + 1);
    }
  }

  return props;
}

function skipWhitespaceAndSlash(source: string, cursor: number): number {
  while (cursor < source.length && (/[\s/]/.test(source[cursor]) || source[cursor] === ",")) {
    cursor += 1;
  }
  return cursor;
}

function skipJsxValue(source: string, cursor: number): number {
  cursor = skipWhitespaceAndSlash(source, cursor);
  const char = source[cursor];

  if (char === '"' || char === "'" || char === "`") {
    return skipQuotedValue(source, cursor, char);
  }

  if (char === "{") {
    return skipBracedValue(source, cursor);
  }

  while (cursor < source.length && !/\s/.test(source[cursor])) {
    cursor += 1;
  }

  return cursor;
}

function skipQuotedValue(source: string, cursor: number, quote: string): number {
  cursor += 1;
  while (cursor < source.length) {
    if (source[cursor] === quote && source[cursor - 1] !== "\\") {
      return cursor + 1;
    }
    cursor += 1;
  }
  return cursor;
}

function skipBracedValue(source: string, cursor: number): number {
  let depth = 0;
  let quote: string | null = null;

  while (cursor < source.length) {
    const char = source[cursor];
    const previous = source[cursor - 1];

    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = null;
      }
      cursor += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      cursor += 1;
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return cursor + 1;
      }
    }

    cursor += 1;
  }

  return cursor;
}

function isAllowedProp(prop: string, contract: ComponentContract): boolean {
  return (
    prop in contract.allowedProps ||
    globalAllowedProps.has(prop) ||
    prop.startsWith("aria-") ||
    prop.startsWith("data-")
  );
}

function hasRule(violations: ValidationViolation[], rule: string): boolean {
  return violations.some((violation) => violation.rule === rule);
}

function hasAnyRule(violations: ValidationViolation[], rules: string[]): boolean {
  return violations.some((violation) => rules.includes(violation.rule));
}
