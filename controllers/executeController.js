import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const TEMP_DIR = path.join(process.cwd(), 'temp_runs');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

export const executeCode = async (req, res) => {
  const { code, language, input } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required" });
  }

  const runId = uuidv4().replace(/-/g, '');
  let fileName = '';
  let command = '';
  let args = [];
  let compileCommand = '';

  switch (language.toLowerCase()) {
    case 'javascript':
      fileName = `run_${runId}.js`;
      command = 'node';
      args = [fileName];
      break;
    case 'python':
      fileName = `run_${runId}.py`;
      command = 'python';
      args = [fileName];
      break;
    case 'cpp':
      fileName = `run_${runId}.cpp`;
      compileCommand = `g++ ${fileName} -o run_${runId}.exe`;
      command = `.\\run_${runId}.exe`;
      break;
    case 'java':
      fileName = `Main_${runId}.java`;
      compileCommand = `javac ${fileName}`;
      command = 'java';
      args = [`Main_${runId}`];
      break;
    default:
      return res.status(400).json({ error: "Unsupported language" });
  }

  let adjustedCode = code;
  if (language.toLowerCase() === 'java') {
    adjustedCode = code.replace(/public\s+class\s+\w+/, `public class Main_${runId}`);
  }

  const filePath = path.join(TEMP_DIR, fileName);

  try {
    fs.writeFileSync(filePath, adjustedCode);

    if (compileCommand) {
      try {
        execSync(compileCommand, { cwd: TEMP_DIR, stdio: 'pipe', timeout: 5000 });
      } catch (compileError) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (_) {}

        return res.status(200).json({
          stdout: "",
          stderr: compileError.stderr ? compileError.stderr.toString() : compileError.message,
          code: 1
        });
      }
    }

    const child = spawn(command, args, { cwd: TEMP_DIR, shell: true });

    let stdout = '';
    let stderr = '';
    let timeoutTriggered = false;

    const executionTimeout = setTimeout(() => {
      timeoutTriggered = true;
      child.kill();
    }, 8000);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();

    child.on('close', (exitCode) => {
      clearTimeout(executionTimeout);

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        if (language.toLowerCase() === 'cpp') {
          const exePath = path.join(TEMP_DIR, `run_${runId}.exe`);
          if (fs.existsSync(exePath)) {
            fs.unlinkSync(exePath);
          }
        }
        if (language.toLowerCase() === 'java') {
          const classPath = path.join(TEMP_DIR, `Main_${runId}.class`);
          if (fs.existsSync(classPath)) {
            fs.unlinkSync(classPath);
          }
        }
      } catch (_) {}

      if (timeoutTriggered) {
        return res.status(504).json({ error: "Execution timed out (Max 8 seconds)" });
      }

      res.status(200).json({
        stdout,
        stderr,
        code: exitCode ?? 0
      });
    });

  } catch (err) {
    res.status(500).json({ error: "Local compiler failed to initialize" });
  }
};
