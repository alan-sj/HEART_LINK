const router = require("express").Router();
const { analyzeInspectionImage } = require("../services/vision.service");
const {
    insertInspectionFinding,
    insertDefectTag
} = require("../db/snowflake");

router.post("/analyze-image", async (req, res) => {
    try {
        const { inspectionId, roomId, imagePath, image } = req.body;

        // Use 'image' (base64) if provided, otherwise fallback to 'imagePath' (legacy)
        const input = image || imagePath;
        if (!input) return res.status(400).json({ error: "No image provided" });

        const defects = await analyzeInspectionImage(input);

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
            defects_detected: defects.length,
            defects
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
