import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();

createApp().listen(env.PORT, () => {
  console.log(`BookLeaf API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
