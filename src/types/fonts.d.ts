declare module 'three/examples/fonts/*.json' {
  const font: any
  export default font
}

// n8ao ships no types; @react-three/postprocessing references it as both value and type.
declare module 'n8ao' {
  export class N8AOPostPass {
    [key: string]: any
  }
}
