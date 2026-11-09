import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: [".next/**", "node_modules/**"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tsParser, parserOptions: { sourceType: "module" } },
    rules: {
      "constructor-super": "error",
      "no-constant-condition": "error",
      "no-debugger": "error",
      "no-dupe-args": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "use-isnan": "error",
    },
  },
];
