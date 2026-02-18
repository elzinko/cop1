import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TemplateInfo {
  name: string;
  sourcePath: string;
  targetRelativePath: string;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    name: 'sonar-project.properties',
    sourcePath: join(__dirname, 'sonar-project.properties.template'),
    targetRelativePath: '.cop1/quality/sonar-project.properties',
  },
  {
    name: '.dependency-cruiser.js',
    sourcePath: join(__dirname, '.dependency-cruiser.js.template'),
    targetRelativePath: '.cop1/quality/.dependency-cruiser.js',
  },
  {
    name: '.eslintrc.json',
    sourcePath: join(__dirname, '.eslintrc.json.template'),
    targetRelativePath: '.cop1/quality/.eslintrc.json',
  },
  {
    name: 'cop1-project-config.yaml',
    sourcePath: join(__dirname, 'cop1-project-config.template.yaml'),
    targetRelativePath: '.cop1/config.yaml',
  },
];
