// Lets tests import a .sql migration as a raw string (Vite's `?raw` suffix).
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
