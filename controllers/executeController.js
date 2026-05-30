import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const TEMP_DIR = path.join(process.cwd(), 'temp_runs');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

export const executeCode = async (req, res) => {
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required" });
  }

  const runId = uuidv4().replace(/-/g, '');
  let fileName = '';
  let command = '';

  switch (language.toLowerCase()) {
    case 'javascript':
      fileName = `run_${runId}.js`;
      command = `node ${fileName}`;
      break;
    case 'python':
      fileName = `run_${runId}.py`;
      command = `python ${fileName}`;
      break;
    case 'cpp':
      fileName = `run_${runId}.cpp`;
      const exeName = `run_${runId}.exe`;
      command = `g++ ${fileName} -o ${exeName} && .\\${exeName}`;
      break;
    case 'java':
      fileName = `Main_${runId}.java`;
      command = `javac ${fileName} && java Main_${runId}`;
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

    exec(command, { cwd: TEMP_DIR, timeout: 8000 }, (error, stdout, stderr) => {
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
      } catch (cleanupError) {
        // Cleanup error suppressed
      }

      if (error && error.killed) {
        return res.status(504).json({ error: "Execution timed out (Max 8 seconds)" });
      }

      res.status(200).json({
        stdout: stdout || "",
        stderr: stderr || (error ? error.message : ""),
        code: error ? error.code : 0
      });
    });

  } catch (err) {
    res.status(500).json({ error: "Local compiler failed to initialize" });
  }
};
