const router = require("express").Router();
const PDFDocument = require("pdfkit");
const { getReportData } = require("../services/report.service");
const { generateReport } = require("../services/llm.service");

router.post("/generate-pdf", async (req, res) => {
    try {
        const { propertyId, role, lang = "en" } = req.body;

        // Fetch intelligence
        const data = await getReportData(propertyId);

        //  Generate AI report
        const report = await generateReport({ role, data, lang });

        // Create PDF
        const doc = new PDFDocument({ margin: 40 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=${role}_Report_${propertyId}.pdf`
        );

        doc.pipe(res);

        // ---- PDF CONTENT ----
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

        if (role === "Builder") {
            report.defects.forEach(d => {
                doc
                    .fontSize(12)
                    .text(`Room: ${d.room}`)
                    .text(`Issue: ${d.root_cause}`)
                    .text(`Fix: ${d.fix}`)
                    .moveDown();
            });
        }

        if (role === "Inspector") {
            report.analysis.forEach(a => {
                doc
                    .fontSize(12)
                    .text(`Room: ${a.room}`)
                    .text(`Defect: ${a.defect}`)
                    .text(`Root Cause: ${a.root_cause}`)
                    .text(`Severity: ${a.severity}`)
                    .text(`Compliance: ${a.compliance}`)
                    .moveDown();
            });
        }

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
