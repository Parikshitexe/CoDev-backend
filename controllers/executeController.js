import { runCodeInDocker } from '../utils/dockerRunner.js';

export const executeCode = async (req, res) => {
  const { code, language, input } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required" });
  }

  try {
    // Run the code in our custom Docker container
    const { stdout, stderr } = await runCodeInDocker(code, language, input);

    // If stderr exists, we still return 200 but send the error in stderr field so frontend shows it as an error
    return res.status(200).json({
      stdout: stdout || "",
      stderr: stderr || ""
    });

  } catch (error) {
    console.error("Docker Execution Error:", error);
    
    // Check if the error is our "Unsupported language" error
    if (error.message === 'Unsupported language') {
      return res.status(400).json({ error: "Unsupported language" });
    }

    return res.status(500).json({ error: "Failed to execute code on the server" });
  }
};
