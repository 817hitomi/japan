import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [".next/**", ".next-dev/**", ".open-next/**", ".wrangler/**", "node_modules/**"]
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      }
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-debugger": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-fallthrough": "error",
      "no-self-assign": "error",
      "no-unreachable": "error",
      "no-unused-private-class-members": "error"
    }
  }
];
