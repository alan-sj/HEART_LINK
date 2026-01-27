const router = require("express").Router();
const PDFDocument = require("pdfkit");
const { getReportData } = require("../services/report.service");
const { generateReport } = require("../services/llm.service");
const { createCanvas, registerFont } = require("canvas");

registerFont(
    "fonts/NotoSansMalayalam-Regular.ttf",
    { family: "NotoSansMalayalam" }
);

function malayalamToImage(text, width = 480) {
    const lineHeight = 26;
    const padding = 20;

    const tmp = createCanvas(width, 10);
    const tctx = tmp.getContext("2d");
    tctx.font = "16px NotoSansMalayalam";

    const words = text.split(" ");
    const lines = [];
    let line = "";

    for (const w of words) {
        const test = line + w + " ";
        if (tctx.measureText(test).width > width - padding * 2) {
            lines.push(line);
            line = w + " ";
        } else {
            line = test;
        }
    }
    lines.push(line);

    const height = lines.length * lineHeight + padding * 2;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#000";
    ctx.font = "16px NotoSansMalayalam";

    lines.forEach((l, i) => {
        ctx.fillText(l, padding, padding + (i + 1) * lineHeight);
    });

    return canvas.toBuffer("image/png");
}



router.get("/:propertyId/report", async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { role = "Buyer", lang = "en" } = req.query;

        const data = await getReportData(propertyId);
        const report = await generateReport({ role, data, lang });

        const doc = new PDFDocument({
            margin: 40,
            fontLayoutCache: false
        });

        doc.on("error", err => {
            console.error("PDF error:", err);
            if (!res.headersSent) {
                res.status(500).json({ error: "PDF generation failed" });
            }
        });

        // Always use a safe Latin font for PDFKit itself
        doc.font("Helvetica");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=${role}_Report_${propertyId}.pdf`
        );

        doc.pipe(res);

        doc.fontSize(18).text(`${role} House Health Report`, { underline: true });
        doc.moveDown();

        doc.fontSize(12);

        if (lang === "ml") {
            doc.text("Summary:");
            doc.moveDown(0.5);
            doc.image(malayalamToImage(report.summary), { width: 420 });
            doc.moveDown();

            doc.text("Key Risks:");
            doc.moveDown(0.5);
            report.key_risks.forEach(r => {
                doc.image(
                    malayalamToImage(`• ${r.room}: ${r.risk} (${r.severity})`, 500),
                    { width: 420 }
                );
                doc.moveDown(0.3);
            });

            doc.moveDown();
            doc.text("Recommendation:");
            doc.moveDown(0.5);
            doc.image(malayalamToImage(report.recommendation, 500), { width: 420 });
        } else {
            // English (safe for pdfkit)
            doc.text(`Summary:\n${report.summary}`);
            doc.moveDown();

            report.key_risks.forEach(r => {
                doc.text(`• ${r.room}: ${r.risk} (${r.severity})`);
            });

            doc.moveDown();
            doc.text(`Recommendation:\n${report.recommendation}`);
        }

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
