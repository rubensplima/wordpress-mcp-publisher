
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  } else {
    console.error(
      "O carregamento de .env requer Node.js 20.12.0 ou superior."
    );
    process.exit(1);
  }
}

await import("./server.js");
