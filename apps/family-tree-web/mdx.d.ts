// MDX content modules export a component and a `meta` object (see content/index.ts).
declare module '*.mdx' {
  export const meta: { title: string; description: string };
  const Component: import('react').ComponentType;
  export default Component;
}
