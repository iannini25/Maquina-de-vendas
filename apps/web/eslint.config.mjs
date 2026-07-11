import shared from "@vendaflow/eslint-config";

export default [
  ...shared,
  {
    ignores: [".next/**", "next-env.d.ts", "playwright-report/**", "test-results/**"],
  },
];
