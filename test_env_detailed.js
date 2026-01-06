import { config } from "dotenv";
import { readFileSync } from "fs";

console.log("=== Before loading .env ===");
console.log("OPENAI_API_KEY in process.env:", process.env.OPENAI_API_KEY);

config();

console.log("\n=== After config() ===");
console.log("OPENAI_API_KEY in process.env:", process.env.OPENAI_API_KEY);

console.log("\n=== Reading .env file directly ===");
const envContent = readFileSync("/Users/aungheinmin/code/ai-flow/presenton/.env", "utf8");
const apiKeyLine = envContent.split("\n").find(line => line.startsWith("OPENAI_API_KEY="));
console.log("OPENAI_API_KEY line in file:", apiKeyLine);
