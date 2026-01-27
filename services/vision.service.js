const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview"
});

function imageToBase64(imagePath) {
    return fs.readFileSync(imagePath, { encoding: "base64" });
}

exports.analyzeInspectionImage = async (imagePath) => {
    const prompt = `
You are a professional building inspection AI.

Identify all visible building defects in the image.

For each defect return:
- defect_type (wall_crack, ceiling_crack, water_leak, damp_patch, mold, paint_peel, rust, structural_damage)
- severity (low, medium, high, critical)
- confidence (0 to 1)
- description

Rules:
- Output ONLY valid JSON array
- Do not hallucinate
- If no defects found, return []
`;

    const imagePart = {
        inlineData: {
            data: imageToBase64(imagePath),
            mimeType: "image/jpeg"
        }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();

    // Gemini-safe extraction
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start === -1 || end === -1) {
        throw new Error("Non-JSON Gemini response: " + text);
    }

    return JSON.parse(text.slice(start, end + 1));
};
