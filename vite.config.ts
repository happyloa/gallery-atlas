import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";

export default defineConfig(({ command }) => {
  // `AIC_FIXTURES=1 vite dev` answers museum API calls from local fixtures (end-to-end tests,
  // offline work). The switch is compiled in only for the dev server; `vite build` ignores it,
  // so a production bundle can never serve fixture data.
  const fixtures = command === "serve" && process.env.AIC_FIXTURES === "1";

  return {
    define: fixtures ? { "process.env.AIC_FIXTURES": JSON.stringify("1") } : {},
    plugins: [
      vinext({
        cache: { data: kvDataAdapter() },
      }),
      cloudflare({
        viteEnvironment: {
          name: "rsc",
          childEnvironments: ["ssr"],
        },
      }),
    ],
  };
});
