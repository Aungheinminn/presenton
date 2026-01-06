import { config } from "dotenv";
config();
console.log("OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);
console.log("OPENAI_API_KEY value:", process.env.OPENAI_API_KEY?.substring(0, 20) + "...");
