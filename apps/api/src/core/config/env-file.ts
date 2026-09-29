import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_CANDIDATES = ['.env', '../.env', '../../.env'];

export function applyEnvFile(content: string): void {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    if (key.length === 0) {
      continue;
    }
    let value = line.slice(separator + 1).trim();
    if (value.length >= 2) {
      const first = value.charAt(0);
      const last = value.charAt(value.length - 1);
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadEnvFiles(cwd: string = process.cwd()): boolean {
  for (const candidate of ENV_CANDIDATES) {
    const filePath = resolve(cwd, candidate);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    applyEnvFile(content);
    return true;
  }
  return false;
}
