const INPUT_REF = /\{\{\s*inputs\.([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Single-quotes a value for POSIX shells so interpolated input values are
 * always treated as one literal argument, never as extra shell syntax.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function renderTemplate(template: string, inputs: Record<string, string>): string {
  return template.replace(INPUT_REF, (match, name: string) => {
    if (!(name in inputs)) {
      throw new Error(`unknown template reference {{inputs.${name}}}`);
    }
    return shellQuote(inputs[name]);
  });
}
