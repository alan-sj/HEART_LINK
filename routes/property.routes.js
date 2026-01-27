const router = require("express").Router();
const PDFDocument = require("pdfkit");
const { getReportData } = require("../services/report.service");
const { generateReport } = require("../services/llm.service");

router.get("/:propertyId/report", async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { role = "Buyer" } = req.query;

        const data = await getReportData(propertyId);
        const report = await generateReport({ role, data });

        const doc = new PDFDocument({ margin: 40 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=${role}_Report_${propertyId}.pdf`
        );

        doc.pipe(res);

        // ---------- PDF CONTENT ----------
        doc.fontSize(18).text(`${role} House Health Report`, { underline: true });
        doc.moveDown();

        if (role === "Buyer") {
            doc.fontSize(12).text(`Summary:\n${report.summary}\n`);
            doc.moveDown();

            doc.text("Key Risks:");
            report.key_risks.forEach(r => {
                doc.text(`• ${r.room}: ${r.risk} (${r.severity})`);
            });

            doc.moveDown();
            doc.text(`Recommendation:\n${report.recommendation}`);
        }

        // (Builder / Inspector blocks stay same)

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
