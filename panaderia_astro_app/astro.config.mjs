// @ts-check
import { defineConfig, envField } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import preact from "@astrojs/preact";

import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  env: {
    schema: {
      PUBLIC_SUPABASE_URL: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [preact()],
  adapter: netlify(),
});
