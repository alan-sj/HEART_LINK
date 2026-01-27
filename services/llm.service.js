const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
    normalizeRootCauses,
    normalizeFutureRisks
} = require("./normalize.util");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ROLE_INSTRUCTIONS = {
    Buyer: `
Use simple, non-technical language.
Focus on safety, financial risk, and future problems.

Return ONLY valid JSON.
DO NOT add explanations.

JSON format (MANDATORY):
{
  "summary": string,
  "key_risks": [
    {
      "room": string,
      "risk": string,
      "severity": "LOW" | "MEDIUM" | "HIGH"
    }
  ],
  "recommendation": string
}
`
    ,
    Builder: `
You are generating a Builder technical report.

Return ONLY valid JSON.
DO NOT add explanations, or cost.

JSON format (MANDATORY):
{
  "defects": [
    {
      "room": string,
      "root_cause": string,
      "fix": string
    }
  ]
}

`,
    Inspector: `
Use technical language.
Explain root causes, severity, and compliance risks.
Return JSON with:
- analysis[]
`
};

exports.generateReport = async ({ role, data }) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY missing");
    }

    // 🔹 Normalize DB output FIRST (outside prompt)
    const normalizedRootCauses = normalizeRootCauses(data.rootCauses);
    const normalizedFutureRisks = normalizeFutureRisks(data.futureRisks);

    // 🔹 Model
    const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview"
    });

    // 🔹 Prompt (ONLY text here)
    const prompt = `
You are a building risk intelligence system.

ROLE INSTRUCTIONS:
${ROLE_INSTRUCTIONS[role]}

ROOT CAUSES:
${JSON.stringify(normalizedRootCauses, null, 2)}

FUTURE RISKS:
${JSON.stringify(normalizedFutureRisks, null, 2)}

RULES:
- Output ONLY valid JSON
- No markdown
- No explanations
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // 🔐 Gemini-safe JSON extraction
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
        throw new Error("Gemini returned non-JSON output: " + text);
    }

    return JSON.parse(text.slice(start, end + 1));
};
