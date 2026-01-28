const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  normalizeRootCauses,
  normalizeFutureRisks
} = require("./normalize.util");

const LANGUAGE_HINTS = {
  en: "Use English language.",
  ml: "Use Malayalam language (മലയാളം)."
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ROLE_INSTRUCTIONS = {
  Buyer: `
Use EXTREMELY SIMPLE, everyday language. Assume the reader has NO technical knowledge.
Explain concepts like you are talking to a student.
For Root Causes: Give each one a clear heading and a simple explanation of what is wrong.
For Future Risks: Explain what could happen and how to stop it.

Return ONLY valid JSON.
DO NOT add explanations.

JSON format (MANDATORY):
{
  "summary": string,
  "root_causes": [
    {
      "heading": string,
      "explanation": string,
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    }
  ],
  "future_predictions": [
    {
      "heading": string,
      "risk_explanation": string,
      "prevention": string,
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    }
  ],
  "recommendation": string
}
`,
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

Return ONLY valid JSON:
{
  "analysis": [
    {
      "room": string,
      "defect": string,
      "root_cause": string,
      "severity": string,
      "compliance": string
    }
  ]
}
`
};

exports.generateReport = async ({ role, data, lang = "en", aiAnalysis }) => {
  console.log("🟡 generateReport lang =", lang);

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing");
  }

  // Use passed AI analysis if available, otherwise use data from Snowflake
  let rootCausesRaw = data.rootCauses;
  let futureRisksRaw = data.futureRisks;

  if (aiAnalysis) {
    if (aiAnalysis.rootCauses) rootCausesRaw = aiAnalysis.rootCauses;
    if (aiAnalysis.futureEvents) futureRisksRaw = aiAnalysis.futureEvents;
  }

  const normalizedRootCauses = normalizeRootCauses(rootCausesRaw);
  const normalizedFutureRisks = normalizeFutureRisks(futureRisksRaw);

  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview"
  });

  const prompt = `
You are a building risk intelligence system.

LANGUAGE (CRITICAL):
You MUST respond ONLY in the following language.
${LANGUAGE_HINTS[lang] || LANGUAGE_HINTS.en}
If you do not follow this, the response is INVALID.

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
- JSON keys MUST be in English
- JSON values MUST follow the selected language
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Gemini returned non-JSON output: " + text);
  }

  return JSON.parse(text.slice(start, end + 1));
};
