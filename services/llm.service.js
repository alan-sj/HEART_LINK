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

exports.generateReport = async ({ role, data, lang = "en" }) => {
    console.log("🟡 generateReport lang =", lang);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY missing");
    }

    const normalizedRootCauses = normalizeRootCauses(data.rootCauses);
    const normalizedFutureRisks = normalizeFutureRisks(data.futureRisks);

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
