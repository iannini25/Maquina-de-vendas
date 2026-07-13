import shared from "@sales4u/eslint-config";

export default [
  ...shared,
  {
    ignores: [".next/**", "next-env.d.ts", "playwright-report/**", "test-results/**"],
  },
];
