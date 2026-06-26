import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL for Docker-out-of-Docker (DooD):
// When the backend runs inside a Docker container, __dirname resolves to a path
// INSIDE the container (e.g. /app/utils). The host Docker daemon cannot mount
// that path. HOST_TEMP_PATH must be set to the HOST machine's actual temp directory
// so Docker can correctly bind-mount it into the code runner container.
const CONTAINER_TEMP_DIR = path.resolve(__dirname, '../temp');
const HOST_TEMP_DIR = process.env.HOST_TEMP_PATH
  ? path.resolve(process.env.HOST_TEMP_PATH)
  : CONTAINER_TEMP_DIR;


// Ensure the temp directory exists (creates on CONTAINER path)
async function ensureTempDir() {
  try {
    await fs.access(CONTAINER_TEMP_DIR);
  } catch {
    await fs.mkdir(CONTAINER_TEMP_DIR, { recursive: true });
  }
}

// Maps languages to their file extensions and execution commands inside the container
const LANGUAGE_CONFIG = {
  javascript: {
    extension: 'js',
    filename: 'code.js',
    getCommand: (filename, hasInput) => `node ${filename} ${hasInput ? '< input.txt' : ''}`
  },
  python: {
    extension: 'py',
    filename: 'code.py',
    getCommand: (filename, hasInput) => `python3 ${filename} ${hasInput ? '< input.txt' : ''}`
  },
  cpp: {
    extension: 'cpp',
    filename: 'code.cpp',
    getCommand: (filename, hasInput) => `g++ ${filename} -o program && ./program ${hasInput ? '< input.txt' : ''}`
  },
  java: {
    extension: 'java',
    // We name it Main.java to match standard Java conventions
    filename: 'Main.java',
    getCommand: (filename, hasInput) => `javac ${filename} && java Main ${hasInput ? '< input.txt' : ''}`
  }
};

export const runCodeInDocker = async (code, language, input = "") => {
  await ensureTempDir();

  const config = LANGUAGE_CONFIG[language.toLowerCase()];
  if (!config) {
    throw new Error('Unsupported language');
  }

  // Create a unique execution folder for this specific run
  const runId = uuidv4();
  // CONTAINER_TEMP_DIR is used for actual file I/O (writing code files)
  const runDir = path.join(CONTAINER_TEMP_DIR, runId);
  // HOST_TEMP_DIR is used for the Docker volume mount (must be a host-visible path)
  const hostRunDir = path.join(HOST_TEMP_DIR, runId);
  const containerName = `run-${runId}`;

  await fs.mkdir(runDir, { recursive: true });

  const codePath = path.join(runDir, config.filename);
  const inputPath = path.join(runDir, 'input.txt');

  try {
    // Write code and input to the unique folder
    await fs.writeFile(codePath, code);
    if (input) {
      await fs.writeFile(inputPath, input);
    }

    // Volume mount uses the HOST path so the host Docker daemon can find it
    const volumeMount = `"${hostRunDir}:/usr/src/app"`;
    
    // Command to execute inside the container
    const containerCommand = config.getCommand(config.filename, !!input);

    // Docker Run Command:
    // --name: Give it a unique name so we can force kill it if node disconnects
    // --rm: remove container after it finishes
    // -v: mount our unique run directory
    // --network none: disable internet access for security
    // --memory 256m: limit RAM usage
    // --cpus 0.5: limit CPU usage
    // timeout 10s: Enforce timeout INSIDE the container so it kills itself properly
    const dockerCmd = `docker run --name ${containerName} --rm -v ${volumeMount} --network none --memory 256m --cpus 0.5 codev-runner timeout 10s sh -c "${containerCommand}"`;

    // Execute the docker command with a 12-second Node timeout, and a 500KB output limit
    return await new Promise((resolve) => {
      exec(dockerCmd, { timeout: 12000, maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
        if (error) {
          // If Node.js forcefully killed the docker client (timeout or maxBuffer)
          if (error.killed) {
            return resolve({ stdout: "", stderr: "Execution killed: Output exceeded maximum length or timed out." });
          }
          // If the inner 'timeout 10s' killed the process, it returns exit code 124 or 143
          if (error.code === 124 || error.code === 143 || stderr.includes("Terminated")) {
            return resolve({ stdout: "", stderr: "Execution timed out (Limit: 10 seconds)." });
          }
          // Otherwise, it was a compilation/runtime error inside the code
          return resolve({ stdout: stdout || "", stderr: stderr || error.message });
        }

        resolve({ stdout, stderr });
      });
    });

  } finally {
    // 1. ALWAYS force kill the container just in case Node's exec died and left it running in the background
    exec(`docker rm -f ${containerName}`, () => {});

    // 2. Clean up the temporary directory (use container path for fs operations)
    try {
      await fs.rm(runDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error(`Failed to cleanup temp directory ${runDir}:`, cleanupError);
    }
  }
};
