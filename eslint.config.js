import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      react,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // RULES.md Naming Conventions
      "camelcase": ["warn", { properties: "always" }],
      // Components should be PascalCase but this is hard to enforce perfectly without TypeScript.
      // We rely on standard React conventions and the camelcase rule for variables.
      
      // Basic React rules
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
