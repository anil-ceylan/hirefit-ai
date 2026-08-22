import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

config({ path: path.join(projectRoot, ".env.local"), quiet: true });
config({ path: path.join(projectRoot, ".env"), quiet: true });
