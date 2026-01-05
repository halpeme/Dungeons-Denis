import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default [
  { ignores: ["dist/", "node_modules/", "coverage/"] },
  
  // Base JS
  pluginJs.configs.recommended,
  
  // TypeScript (src/**)
  ...tseslint.configs.recommended.map(config => ({
     ...config,
     files: ["src/**/*.ts", "tests/**/*.ts"],
  })),
  
  // Node Globals for src and root scripts
  {
    files: ["src/**/*.ts", "scripts/**/*.js", "*.js", "tests/**/*.ts"],
    languageOptions: {
      globals: globals.node
    }
  },
  
  // Browser Globals for public
  {
    files: ["public/**/*.js"],
    languageOptions: {
      globals: globals.browser,
      sourceType: "module"
    },
    rules: {
        "no-undef": "off" // Allow global variables like WSClient for now
    }
  },

  // Prettier
  prettierConfig
];
