import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export function readYamlFile(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  return parse(content);
}
