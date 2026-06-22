export const executeCode = async (req, res) => {
  const { code, language, input } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required" });
  }

  const clientId = process.env.JDOODLE_CLIENT_ID;
  const clientSecret = process.env.JDOODLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing JDoodle API keys in .env");
    return res.status(500).json({ error: "Execution server not properly configured" });
  }

  // Map our frontend language names to JDoodle's language codes
  const languageMap = {
    javascript: { language: "nodejs", versionIndex: "4" },
    python: { language: "python3", versionIndex: "4" },
    cpp: { language: "cpp", versionIndex: "5" },
    java: { language: "java", versionIndex: "4" }
  };

  const jDoodleConfig = languageMap[language.toLowerCase()];

  if (!jDoodleConfig) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  try {
    const response = await fetch("https://api.jdoodle.com/v1/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        clientId: clientId,
        clientSecret: clientSecret,
        script: code,
        language: jDoodleConfig.language,
        versionIndex: jDoodleConfig.versionIndex,
        stdin: input || ""
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("JDoodle API Error:", data.error || data);
      return res.status(500).json({ error: data.error || "Execution failed" });
    }

    // JDoodle returns { output: string, statusCode: number, memory: string, cpuTime: string }
    let stdout = "";
    let stderr = "";

    // A non-200 statusCode from JDoodle indicates a compilation or runtime error inside the script
    if (data.statusCode !== 200) {
      stderr = data.output;
    } else {
      stdout = data.output;
    }

    return res.status(200).json({
      stdout,
      stderr
    });

  } catch (error) {
    console.error("Execution Error:", error);
    return res.status(500).json({ error: "Failed to connect to execution server" });
  }
};
