/// <reference types="vite/client" />

// opentype.js ships no type declarations; we only use parse().
declare module 'opentype.js' {
  export function parse(buffer: ArrayBuffer): any
}
