/* This script starts the FastAPI and Next.js servers, setting up user configuration if necessary. It reads environment variables to configure API keys and other settings, ensuring that the user configuration file is created if it doesn't exist. The script also handles the starting of both servers and keeps the Node.js process alive until one of the servers exits. */

import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

// Load environment variables from .env file, overriding existing ones
config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastapiDir = join(__dirname, "servers/fastapi");
const nextjsDir = join(__dirname, "servers/nextjs");

// Helper function to check if a command exists
const commandExists = (cmd) => {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
};

// Helper function to kill processes on a specific port
const killProcessOnPort = (port) => {
  try {
    const result = execSync(`lsof -i :${port} 2>/dev/null | grep -v COMMAND | awk '{print $2}' | sort -u`, { 
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    }).trim();
    
    if (result) {
      const pids = result.split("\n").filter(pid => pid);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: "ignore" });
        } catch {
          // Process might already be dead
        }
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const args = process.argv.slice(2);
const hasDevArg = args.includes("--dev") || args.includes("-d");
const isDev = hasDevArg;
const canChangeKeys = process.env.CAN_CHANGE_KEYS !== "false";

const fastapiPort = 8000;
const nextjsPort = 3000;
const appmcpPort = 8001;

// Set default APP_DATA_DIRECTORY if not provided
if (!process.env.APP_DATA_DIRECTORY) {
  process.env.APP_DATA_DIRECTORY = join(__dirname, "app_data");
  console.log(`APP_DATA_DIRECTORY not set, using default: ${process.env.APP_DATA_DIRECTORY}`);
}

const userConfigPath = join(process.env.APP_DATA_DIRECTORY, "userConfig.json");
const userDataDir = dirname(userConfigPath);

// Create user_data directory if it doesn't exist
if (!existsSync(userDataDir)) {
  mkdirSync(userDataDir, { recursive: true });
}

// Setup node_modules for development
const setupNodeModules = () => {
  return new Promise((resolve, reject) => {
    console.log("Setting up node_modules for Next.js...");
    const npmProcess = spawn("npm", ["install"], {
      cwd: nextjsDir,
      stdio: "inherit",
      env: process.env,
    });

    npmProcess.on("error", (err) => {
      console.error("npm install failed:", err);
      reject(err);
    });

    npmProcess.on("exit", (code) => {
      if (code === 0) {
        console.log("npm install completed successfully");
        resolve();
      } else {
        console.error(`npm install failed with exit code: ${code}`);
        reject(new Error(`npm install failed with exit code: ${code}`));
      }
    });
  });
};

process.env.USER_CONFIG_PATH = userConfigPath;

//? UserConfig is only setup if API Keys can be changed
const setupUserConfigFromEnv = () => {
  let existingConfig = {};

  if (existsSync(userConfigPath)) {
    existingConfig = JSON.parse(readFileSync(userConfigPath, "utf8"));
  }

  if (!["ollama", "openai", "google"].includes(existingConfig.LLM)) {
    existingConfig.LLM = undefined;
  }

  const userConfig = {
    LLM: process.env.LLM || existingConfig.LLM,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || existingConfig.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || existingConfig.OPENAI_MODEL,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || existingConfig.GOOGLE_API_KEY,
    GOOGLE_MODEL: process.env.GOOGLE_MODEL || existingConfig.GOOGLE_MODEL,
    OLLAMA_URL: process.env.OLLAMA_URL || existingConfig.OLLAMA_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || existingConfig.OLLAMA_MODEL,
    ANTHROPIC_API_KEY:
      process.env.ANTHROPIC_API_KEY || existingConfig.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL:
      process.env.ANTHROPIC_MODEL || existingConfig.ANTHROPIC_MODEL,
    CUSTOM_LLM_URL: process.env.CUSTOM_LLM_URL || existingConfig.CUSTOM_LLM_URL,
    CUSTOM_LLM_API_KEY:
      process.env.CUSTOM_LLM_API_KEY || existingConfig.CUSTOM_LLM_API_KEY,
    CUSTOM_MODEL: process.env.CUSTOM_MODEL || existingConfig.CUSTOM_MODEL,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY || existingConfig.PEXELS_API_KEY,
    PIXABAY_API_KEY:
      process.env.PIXABAY_API_KEY || existingConfig.PIXABAY_API_KEY,
    IMAGE_PROVIDER: process.env.IMAGE_PROVIDER || existingConfig.IMAGE_PROVIDER,
    TOOL_CALLS: process.env.TOOL_CALLS || existingConfig.TOOL_CALLS,
    DISABLE_THINKING:
      process.env.DISABLE_THINKING || existingConfig.DISABLE_THINKING,
    EXTENDED_REASONING:
      process.env.EXTENDED_REASONING || existingConfig.EXTENDED_REASONING,
    WEB_GROUNDING: process.env.WEB_GROUNDING || existingConfig.WEB_GROUNDING,
    USE_CUSTOM_URL: process.env.USE_CUSTOM_URL || existingConfig.USE_CUSTOM_URL,
    COMFYUI_URL: process.env.COMFYUI_URL || existingConfig.COMFYUI_URL,
    COMFYUI_WORKFLOW:
      process.env.COMFYUI_WORKFLOW || existingConfig.COMFYUI_WORKFLOW,
    DALL_E_3_QUALITY:
      process.env.DALL_E_3_QUALITY || existingConfig.DALL_E_3_QUALITY,
    GPT_IMAGE_1_5_QUALITY:
      process.env.GPT_IMAGE_1_5_QUALITY || existingConfig.GPT_IMAGE_1_5_QUALITY,
  };

  writeFileSync(userConfigPath, JSON.stringify(userConfig));
};

const startServers = async () => {
  // Use the virtual environment's Python if it exists
  const venvPythonPath = join(fastapiDir, ".venv", "bin", "python");
  const pythonCmd = existsSync(venvPythonPath) ? venvPythonPath : (commandExists("python3") ? "python3" : "python");
  
  if (!commandExists(pythonCmd) && !existsSync(pythonCmd)) {
    console.error(`Error: Python is not installed. Please install Python 3 to continue.`);
    process.exit(1);
  }

  const fastApiProcess = spawn(
    pythonCmd,
    [
      "server.py",
      "--port",
      fastapiPort.toString(),
      "--reload",
      isDev ? "true" : "false",
    ],
    {
      cwd: fastapiDir,
      stdio: "inherit",
      env: process.env,
    }
  );

  fastApiProcess.on("error", (err) => {
    console.error("FastAPI process failed to start:", err);
  });

  const appmcpProcess = spawn(
    pythonCmd,
    ["mcp_server.py", "--port", appmcpPort.toString()],
    {
      cwd: fastapiDir,
      stdio: "ignore",
      env: process.env,
    }
  );

  appmcpProcess.on("error", (err) => {
    console.error("App MCP process failed to start:", err);
  });

  const nextjsProcess = spawn(
    "npm",
    [
      "run",
      isDev ? "dev" : "start",
      "--",
      "-H",
      "127.0.0.1",
      "-p",
      nextjsPort.toString(),
    ],
    {
      cwd: nextjsDir,
      stdio: "inherit",
      env: process.env,
    }
  );

  nextjsProcess.on("error", (err) => {
    console.error("Next.js process failed to start:", err);
  });

  // Only start Ollama if it's available
  let ollamaProcess = null;
  if (commandExists("ollama")) {
    console.log("Starting Ollama...");
    ollamaProcess = spawn("ollama", ["serve"], {
      cwd: "/",
      stdio: "inherit",
      env: process.env,
    });

    ollamaProcess.on("error", (err) => {
      console.error("Ollama process failed to start:", err);
    });
  } else {
    console.log("Ollama not found. Skipping Ollama startup. You can configure Ollama URL manually if needed.");
  }

  // Keep the Node process alive until one of the main servers exits
  const processesToWaitFor = [
    new Promise((resolve) => fastApiProcess.on("exit", resolve)),
    new Promise((resolve) => nextjsProcess.on("exit", resolve)),
  ];

  if (ollamaProcess) {
    processesToWaitFor.push(
      new Promise((resolve) => ollamaProcess.on("exit", resolve))
    );
  }

  const exitCode = await Promise.race(processesToWaitFor);

  console.log(`One of the processes exited. Exit code: ${exitCode}`);
  process.exit(exitCode);
};

// Start nginx service (optional, mainly for production)
const startNginx = () => {
  // Nginx is typically not used in development on macOS
  // Only attempt to start on Linux with service command
  if (process.platform === "linux" && commandExists("service")) {
    const nginxProcess = spawn("service", ["nginx", "start"], {
      stdio: "inherit",
      env: process.env,
    });

    nginxProcess.on("error", (err) => {
      console.error("Nginx process failed to start:", err);
    });

    nginxProcess.on("exit", (code) => {
      if (code === 0) {
        console.log("Nginx started successfully");
      } else {
        console.error(`Nginx failed to start with exit code: ${code}`);
      }
    });
  } else {
    console.log("Nginx not started (platform-specific or not available in development)");
  }
};

const main = async () => {
  // Clean up any lingering processes on required ports
  console.log("Cleaning up any lingering processes on ports 8000 and 3000...");
  if (killProcessOnPort(8000)) {
    console.log("Cleaned up port 8000");
  }
  if (killProcessOnPort(3000)) {
    console.log("Cleaned up port 3000");
  }
  if (killProcessOnPort(8001)) {
    console.log("Cleaned up port 8001");
  }

  if (isDev) {
    await setupNodeModules();
  }

  if (canChangeKeys) {
    setupUserConfigFromEnv();
  }

  startServers();
  startNginx();
};

main();
