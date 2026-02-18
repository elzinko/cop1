export interface CodeGeneratorPort {
  generate(prompt: string): Promise<string>;
}
