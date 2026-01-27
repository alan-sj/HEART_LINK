const router = require("express").Router();
const { getReportData } = require("../services/report.service");
const { generateReport } = require("../services/llm.service");

router.post("/generate", async (req, res) => {
    try {
        const { propertyId, role } = req.body;

        const data = await getReportData(propertyId);
        const report = await generateReport({ role, data });

        res.json(report);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



module.exports = router;
