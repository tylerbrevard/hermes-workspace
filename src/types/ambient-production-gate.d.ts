declare module '@playwright/test' {
  export const test: {
    (name: string, fn: (args: { page: any }) => unknown | Promise<unknown>): void
    describe: (name: string, fn: () => void) => void
    beforeEach: (fn: (args: { page: any }) => unknown | Promise<unknown>) => void
    use: (options: Record<string, unknown>) => void
  }
  export const expect: any
}

declare module '*.mjs' {
  const moduleExports: any
  export = moduleExports
}

declare module 'three' {
  export const BufferAttribute: any
  export const CanvasTexture: any
  export const Color: any
  export const DoubleSide: any
  export const MathUtils: any
  export const MeshStandardMaterial: any
  export const Object3D: any
  export const PlaneGeometry: any
  export const RepeatWrapping: any
  export const Vector3: any
  export type BufferAttribute = any
  export type CanvasTexture = any
  export type Color = any
  export type Group = any
  export type InstancedMesh = any
  export type Mesh = any
  export type MeshStandardMaterial = any
  export type Object3D = any
  export type PlaneGeometry = any
  export type PointLight = any
  export type Vector3 = any
}

type DurableObjectNamespace = {
  idFromName(name: string): any
  get(id: unknown): any
}

type DurableObjectState = {
  storage: {
    get<T = unknown>(key: string): Promise<T | undefined>
    put<T = unknown>(key: string, value: T): Promise<void>
    delete(key: string): Promise<boolean>
    getAlarm(): Promise<number | null>
    setAlarm(scheduledTime: number | Date): Promise<void>
  }
  getWebSockets(): Array<WebSocket>
  acceptWebSocket(socket: WebSocket): void
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket }
}

interface WebSocket {
  serializeAttachment(value: unknown): void
  deserializeAttachment(): any
  accept(): void
}

interface ResponseInit {
  webSocket?: WebSocket
}

type ReactThreeIntrinsicProps = Record<string, any> & {
  onClick?: (event: any) => void
  onPointerDown?: (event: any) => void
  onPointerEnter?: (event: any) => void
  onPointerLeave?: (event: any) => void
  onPointerMove?: (event: any) => void
  onPointerOver?: (event: any) => void
  onPointerOut?: (event: any) => void
}

declare namespace JSX {
  interface IntrinsicElements {
    ambientLight: ReactThreeIntrinsicProps
    boxGeometry: ReactThreeIntrinsicProps
    capsuleGeometry: ReactThreeIntrinsicProps
    circleGeometry: ReactThreeIntrinsicProps
    coneGeometry: ReactThreeIntrinsicProps
    cylinderGeometry: ReactThreeIntrinsicProps
    directionalLight: ReactThreeIntrinsicProps
    dodecahedronGeometry: ReactThreeIntrinsicProps
    fog: ReactThreeIntrinsicProps
    group: ReactThreeIntrinsicProps
    hemisphereLight: ReactThreeIntrinsicProps
    instancedMesh: ReactThreeIntrinsicProps
    mesh: ReactThreeIntrinsicProps
    meshBasicMaterial: ReactThreeIntrinsicProps
    meshStandardMaterial: ReactThreeIntrinsicProps
    octahedronGeometry: ReactThreeIntrinsicProps
    planeGeometry: ReactThreeIntrinsicProps
    pointLight: ReactThreeIntrinsicProps
    ringGeometry: ReactThreeIntrinsicProps
    sphereGeometry: ReactThreeIntrinsicProps
    torusGeometry: ReactThreeIntrinsicProps
  }
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: ReactThreeIntrinsicProps
      boxGeometry: ReactThreeIntrinsicProps
      capsuleGeometry: ReactThreeIntrinsicProps
      circleGeometry: ReactThreeIntrinsicProps
      coneGeometry: ReactThreeIntrinsicProps
      cylinderGeometry: ReactThreeIntrinsicProps
      directionalLight: ReactThreeIntrinsicProps
      dodecahedronGeometry: ReactThreeIntrinsicProps
      fog: ReactThreeIntrinsicProps
      group: ReactThreeIntrinsicProps
      hemisphereLight: ReactThreeIntrinsicProps
      instancedMesh: ReactThreeIntrinsicProps
      mesh: ReactThreeIntrinsicProps
      meshBasicMaterial: ReactThreeIntrinsicProps
      meshStandardMaterial: ReactThreeIntrinsicProps
      octahedronGeometry: ReactThreeIntrinsicProps
      planeGeometry: ReactThreeIntrinsicProps
      pointLight: ReactThreeIntrinsicProps
      ringGeometry: ReactThreeIntrinsicProps
      sphereGeometry: ReactThreeIntrinsicProps
      torusGeometry: ReactThreeIntrinsicProps
    }
  }
}
