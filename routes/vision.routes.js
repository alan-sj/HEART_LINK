const router = require("express").Router();
const { analyzeInspectionImage } = require("../services/vision.service");
const {
    insertInspectionFinding,
    insertDefectTag
} = require("../db/snowflake");

router.post("/analyze-image", async (req, res) => {
    try {
        const { inspectionId, roomId, imagePath } = req.body;

        const defects = await analyzeInspectionImage(imagePath);

        for (const d of defects) {
            const findingId = await insertInspectionFinding({
                inspectionId,
                roomId,
                description: d.description,
                imageRef: imagePath
            });

            await insertDefectTag({
                findingId,
                defectType: d.defect_type,
                severity: d.severity,
                confidence: d.confidence
            });
        }

        res.json({
            status: "ok",
            defects_detected: defects.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
