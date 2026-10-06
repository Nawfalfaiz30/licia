import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const reactHooksPlugin = nextVitals.find(
  (config) => config.plugins && config.plugins["react-hooks"],
)?.plugins?.["react-hooks"];

export default defineConfig([
  ...nextVitals,
  {
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // React Compiler diagnostics are warnings during stabilization. The
      // rules-of-hooks rule remains an error because it can indicate a real bug.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "tsconfig.tsbuildinfo"]),
]);
