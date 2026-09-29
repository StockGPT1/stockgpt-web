import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: [
      "components/PortfolioCommandCentreRevolut.tsx",
      "components/SavedPortfolio.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/portfolio-action-engine",
                "@/lib/portfolio-trim-recommendation",
                "@/components/PortfolioCommandCentreRevolut",
                "@/components/SavedPortfolio",
              ],
              message: "Legacy portfolio recommendation/status code is non-authoritative and must not enter an active customer surface.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/utils/supabase/admin", "@/lib/stripe"],
              message: "Trusted server credentials and billing helpers must not enter the client component tree.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
