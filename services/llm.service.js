const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ROLE_INSTRUCTIONS = {
    Buyer: `
Use simple, non-technical language.
Focus on safety, financial risk, and future problems.
Return JSON with:
- summary
- key_risks
- recommendation
`,
    Builder: `
Focus on defects, fixes, and approximate repair costs.
Return JSON with:
- defects[]
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

    // ✅ CORRECT MODEL
    const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview"
    });

    const prompt = `
You are a building risk intelligence system.

ROLE INSTRUCTIONS:
${ROLE_INSTRUCTIONS[role]}

ROOT CAUSES:
${JSON.stringify(data.rootCauses, null, 2)}

FUTURE RISKS:
${JSON.stringify(data.futureRisks, null, 2)}

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
