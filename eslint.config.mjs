export default [
  {
    files: ["eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {},
  },
  {
    ignores: ["**/*.{ts,tsx,js,jsx,cjs}", ".next/**", "node_modules/**"],
  },
]
