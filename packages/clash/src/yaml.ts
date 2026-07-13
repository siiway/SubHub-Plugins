/**
 * 极简 YAML 序列化器（无第三方依赖），仅覆盖 Clash 配置所需的数据形态：
 * 标量（string/number/boolean）、纯对象、对象数组、标量数组。
 */

export type YamlValue = string | number | boolean | null | YamlValue[] | YamlObject;

// 使用 interface（而非 Record）以支持递归引用，避免类型别名自引用报错。
export interface YamlObject {
  [key: string]: YamlValue;
}

const NEEDS_QUOTE = /[:#\-?*&!|>'"%@`{}[\],]|^\s|\s$|^$/;

function quoteString(value: string): string {
  if (!NEEDS_QUOTE.test(value) && !/^(true|false|null|~|\d)/i.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function scalar(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return quoteString(value);
  return String(value);
}

function isRecord(value: YamlValue): value is YamlObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serialize(value: YamlValue, indent: number, lines: string[]): void {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    serializeArray(value, indent, lines);
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      appendEntry(key, child, indent, lines);
    }
    return;
  }
  lines.push(`${pad}${scalar(value)}`);
}

function appendEntry(key: string, child: YamlValue, indent: number, lines: string[]): void {
  const pad = '  '.repeat(indent);
  if (Array.isArray(child)) {
    if (child.length === 0) {
      lines.push(`${pad}${key}: []`);
    } else {
      lines.push(`${pad}${key}:`);
      serializeArray(child, indent, lines);
    }
  } else if (isRecord(child)) {
    lines.push(`${pad}${key}:`);
    serialize(child, indent + 1, lines);
  } else {
    lines.push(`${pad}${key}: ${scalar(child)}`);
  }
}

function serializeArray(arr: YamlValue[], indent: number, lines: string[]): void {
  const pad = '  '.repeat(indent);
  for (const item of arr) {
    if (isRecord(item)) {
      const entries = Object.entries(item);
      if (entries.length === 0) {
        lines.push(`${pad}- {}`);
        continue;
      }
      const [firstKey, firstVal] = entries[0];
      if (Array.isArray(firstVal) || isRecord(firstVal)) {
        lines.push(`${pad}-`);
        serialize(item, indent + 1, lines);
      } else {
        lines.push(`${pad}- ${firstKey}: ${scalar(firstVal)}`);
        for (const [key, val] of entries.slice(1)) {
          appendEntry(key, val, indent + 1, lines);
        }
      }
    } else if (Array.isArray(item)) {
      lines.push(`${pad}-`);
      serializeArray(item, indent + 1, lines);
    } else {
      lines.push(`${pad}- ${scalar(item)}`);
    }
  }
}

/** 将对象序列化为 YAML 文本。 */
export function toYaml(value: YamlValue): string {
  const lines: string[] = [];
  serialize(value, 0, lines);
  return lines.join('\n') + '\n';
}
