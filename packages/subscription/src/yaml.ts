export type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };

function parseScalar(raw: string): string | number | boolean | null {
  const v = raw.trim();
  if (v === 'null' || v === '~' || v === '') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v)) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return unquote(v);
}

function unquote(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return v;
}

interface Line {
  indent: number;
  text: string;
  isArrayItem: boolean;
  key: string;
  value: string | null;
}

function tokenize(text: string): Line[] {
  const lines: Line[] = [];
  for (const raw of text.split('\n')) {
    const stripped = raw.replace(/#.*$/, '').trimEnd();
    if (stripped.trim() === '') continue;
    const indent = stripped.length - stripped.trimStart().length;
    const trimmed = stripped.trimStart();
    const isArrayItem = trimmed.startsWith('- ');
    const content = isArrayItem ? trimmed.slice(2).trimStart() : trimmed;
    const colonIdx = content.indexOf(':');
    if (colonIdx >= 0) {
      const key = content.slice(0, colonIdx).trim();
      const value = content.slice(colonIdx + 1).trim();
      lines.push({ indent, text: trimmed, isArrayItem, key, value: value || null });
    } else if (isArrayItem) {
      lines.push({ indent, text: trimmed, isArrayItem, key: '', value: content || null });
    }
  }
  return lines;
}

export function parseYaml(text: string): Record<string, YamlValue> {
  const lines = tokenize(text);
  const result: Record<string, YamlValue> = {};
  let i = 0;

  function parseNode(baseIndent: number): YamlValue {
    if (i >= lines.length) return null;
    const line = lines[i];

    if (line.isArrayItem) {
      return parseSequence(baseIndent);
    }

    if (line.value === null) {
      return parseMap(baseIndent);
    }

    i += 1;
    return parseScalar(line.value);
  }

  function parseSequence(baseIndent: number): YamlValue[] {
    const items: YamlValue[] = [];
    while (i < lines.length && lines[i].indent >= baseIndent && lines[i].isArrayItem) {
      const line = lines[i];
      if (line.value === null) {
        items.push(parseMap(line.indent + 1));
      } else {
        items.push(parseScalar(line.value));
        i += 1;
      }
    }
    return items;
  }

  function parseMap(baseIndent: number): Record<string, YamlValue> {
    const map: Record<string, YamlValue> = {};
    while (i < lines.length && lines[i].indent >= baseIndent && !lines[i].isArrayItem) {
      const line = lines[i];
      if (line.value === null) {
        i += 1;
        map[line.key] = parseNode(line.indent + 1);
      } else {
        i += 1;
        map[line.key] = parseScalar(line.value);
      }
    }
    return map;
  }

  // Parse top-level (indent 0)
  while (i < lines.length) {
    const line = lines[i];
    if (line.isArrayItem) {
      const arr = parseSequence(0);
      if (arr.length > 0) result[''] = arr;
    } else if (line.value === null) {
      i += 1;
      result[line.key] = parseNode(line.indent + 1);
    } else {
      i += 1;
      result[line.key] = parseScalar(line.value);
    }
  }

  return result;
}

export function getProxies(doc: Record<string, YamlValue>): Record<string, YamlValue>[] {
  const proxies = doc['proxies'];
  if (!Array.isArray(proxies)) return [];
  return proxies.filter((p): p is Record<string, YamlValue> =>
    typeof p === 'object' && p !== null && !Array.isArray(p),
  );
}
