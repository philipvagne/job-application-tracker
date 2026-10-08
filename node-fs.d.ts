// The one Node function vite.config.ts uses, declared here so the project needs no @types/node.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
}
