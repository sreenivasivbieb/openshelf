import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * Layer boundaries (docs/architecture/overview.md). Lint fails if a layer imports what it must not.
 * ESLint does not merge the same rule across config blocks, so each block lists its full set.
 */
const ban = (regex, message) => ({ regex, message });
const NO_BOOTSTRAP = ban(
  "(^|/)bootstrap(/|$)",
  "src/ never imports bootstrap/; take dependencies as parameters.",
);
const NO_API = ban("(^|/)api(/|$)", "Only bootstrap/ wires the api layer.");
const NO_SERVICES = ban("(^|/)services(/|$)", "Lower layers must not call services.");
const NO_REPOS = ban("(^|/)repositories(/|$)", "Go through a service, not a repository.");
const NO_INTEGRATIONS = ban(
  "(^|/)integrations(/|$)",
  "Domain code must not touch external systems.",
);
const NO_LLM = ban(
  "(^|/)integrations/llm(/|$)|^@anthropic-ai/",
  "No LLM on the money path (ADR-0002).",
);
const NO_IO_LIBS = ban(
  "^(express|better-sqlite3|@paypal/|@anthropic-ai/|@modelcontextprotocol/)",
  "Domain code is pure: no I/O libraries.",
);

const layer = (files, patterns) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "storage/**", ".claude/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  layer(["src/**/*.ts"], [NO_BOOTSTRAP]),
  layer(["src/api/**/*.ts"], [NO_BOOTSTRAP, NO_REPOS]),
  layer(["src/services/**/*.ts"], [NO_BOOTSTRAP, NO_API]),
  layer(
    ["src/services/quote.service.ts", "src/services/order.service.ts"],
    [NO_BOOTSTRAP, NO_API, NO_LLM],
  ),
  layer(
    ["src/repositories/**/*.ts", "src/integrations/**/*.ts"],
    [NO_BOOTSTRAP, NO_API, NO_SERVICES],
  ),
  layer(
    ["src/domain/**/*.ts", "src/schemas/**/*.ts", "src/shared/**/*.ts"],
    [NO_BOOTSTRAP, NO_API, NO_SERVICES, NO_REPOS, NO_INTEGRATIONS, NO_IO_LIBS],
  ),
);
