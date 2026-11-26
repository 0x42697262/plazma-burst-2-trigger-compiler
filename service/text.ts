export const TEXT = Object.freeze({
  actionHover: (number: number, name: string, description: string, kindA: string, kindB: string): string =>
    `**action ${number}** \`${name}\`\n\n${description}\n\nA: \`${kindA}\` · B: \`${kindB}\``,
  valueHover: (group: string, member: string, value: string, label: string): string => `**${group}.${member}** = \`${value}\`\n\n${label}`,
  groupHover: (group: string, kind: string, count: number): string => `**${group}**: ${count} named values for parameters of kind \`${kind}\``,
  objectKindHover: (kind: string): string => `Map object kind: \`${kind} name = "#uid";\` or an array \`${kind} names[] = ["#a", "#b"];\``,
  constructorDetail: (tag: string): string => `map object <${tag}>`,
  constructorHover: (name: string, tag: string, positional: readonly string[], properties: readonly string[]): string =>
    `**${name}(${positional.join(', ')}, ...)** creates a \`<${tag}>\` in a map block.\n\nProperties: ${properties.join(', ')}`,
  propertyHover: (name: string, title: string, description: string, kind: string, fallback: string | null): string =>
    `**${name}** (${title}): ${kind}${fallback === null ? '' : `, editor default \`${fallback}\``}${description === '' ? '' : `\n\n${description}`}`,
  declarationHover: (code: string): string => `\`\`\`ptc\n${code}\n\`\`\``,
  builtinHover: (signature: string, description: string): string => `\`${signature}\`\n\n${description}`,
  importLine: (file: string, line: number, message: string): string => `${file} line ${line}: ${message}`,
  eventName: (keyword: string, name: string): string => `${keyword} ${name}`,
  actionDetail: (number: number): string => `action ${number}`,
});
