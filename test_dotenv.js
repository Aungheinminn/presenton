import { config } from "dotenv";
config();
console.log("After unset - OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
