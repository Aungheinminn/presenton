import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

console.log('Environment variables loaded:');
console.log('APP_DATA_DIRECTORY:', process.env.APP_DATA_DIRECTORY);
console.log('LLM:', process.env.LLM);
console.log('CAN_CHANGE_KEYS:', process.env.CAN_CHANGE_KEYS);
console.log('IMAGE_PROVIDER:', process.env.IMAGE_PROVIDER);
console.log('NEXTJS_URL:', process.env.NEXTJS_URL);

// Test default APP_DATA_DIRECTORY
if (!process.env.APP_DATA_DIRECTORY) {
  process.env.APP_DATA_DIRECTORY = join(__dirname, "app_data");
  console.log('Using default APP_DATA_DIRECTORY:', process.env.APP_DATA_DIRECTORY);
} else {
  console.log('APP_DATA_DIRECTORY is set:', process.env.APP_DATA_DIRECTORY);
}

console.log('\nTest passed - dotenv is working!');
