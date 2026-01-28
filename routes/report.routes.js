const router = require("express").Router();
const PDFDocument = require("pdfkit");
const { getReportData } = require("../services/report.service");
const { generateReport } = require("../services/llm.service");

router.post("/generate-pdf", async (req, res) => {
    try {
        const { propertyId, role, lang = "en", aiAnalysis } = req.body;
        console.log("Generating PDF for:", propertyId, "Role:", role);
        console.log("Received AI Analysis Data points:", aiAnalysis ? Object.keys(aiAnalysis).length : "None");
        if (aiAnalysis && aiAnalysis.rootCauses) console.log("Root Causes count:", aiAnalysis.rootCauses.length);

        // Fetch intelligence
        const data = await getReportData(propertyId);

        //  Generate AI report, including the new AI analysis if available
        const report = await generateReport({ role, data, lang, aiAnalysis });

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
            // Executive Summary
            doc.font('Helvetica-Bold').fontSize(14).text("Executive Summary");
            doc.font('Helvetica').fontSize(12).text(report.summary || "No summary available.", { align: 'justify' });
            doc.moveDown(2);

            // Root Causes Section
            if (report.root_causes && report.root_causes.length > 0) {
                doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text("1. What is Wrong? (Root Causes)", { underline: true });
                doc.moveDown();

                report.root_causes.forEach((item, i) => {
                    const color = item.severity === 'CRITICAL' || item.severity === 'HIGH' ? '#ef4444' :
                        item.severity === 'MEDIUM' ? '#f59e0b' : '#10b981';

                    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(`${i + 1}. ${item.heading}`);
                    doc.font('Helvetica').fontSize(10).fillColor(color).text(`   Severity: ${item.severity}`);
                    doc.fillColor('#333333').font('Helvetica').fontSize(11).text(item.explanation, { align: 'justify', indent: 15 });
                    doc.moveDown(1);
                });
            }

            // Future Predictions Section
            if (report.future_predictions && report.future_predictions.length > 0) {
                doc.addPage();
                doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text("2. What Could Happen? (Future Risks)", { underline: true });
                doc.moveDown();

                report.future_predictions.forEach((item, i) => {
                    const color = item.severity === 'CRITICAL' || item.severity === 'HIGH' ? '#ef4444' :
                        item.severity === 'MEDIUM' ? '#f59e0b' : '#10b981';

                    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(`${i + 1}. ${item.heading}`);
                    doc.font('Helvetica').fontSize(10).fillColor(color).text(`   Severity: ${item.severity}`);
                    doc.fillColor('#333333').font('Helvetica').fontSize(11).text(`Risk: ${item.risk_explanation}`, { align: 'justify', indent: 15 });
                    if (item.prevention) {
                        doc.font('Helvetica-Oblique').fontSize(11).text(`Prevention: ${item.prevention}`, { align: 'justify', indent: 15 });
                    }
                    doc.moveDown(1);
                });
            }

            // Recommendation
            doc.moveDown();
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text("Recommendation");
            doc.font('Helvetica').fontSize(12).text(report.recommendation || "No recommendation available.", { align: 'justify' });
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
