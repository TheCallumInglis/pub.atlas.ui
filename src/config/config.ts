type RuntimeEnv = {
  VITE_API_URL?: string;
  VITE_API_KEY?: string;
};

const runtimeEnv =
  (globalThis as typeof globalThis & { __ENV__?: RuntimeEnv }).__ENV__ ?? {};

export const config = {
  VITE_API_URL: runtimeEnv.VITE_API_URL ?? import.meta.env.VITE_API_URL ?? "",
  VITE_API_KEY: runtimeEnv.VITE_API_KEY ?? import.meta.env.VITE_API_KEY ?? "",
};
