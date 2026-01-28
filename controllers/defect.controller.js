const snowflakeConn = require("../db/snowflake");
const {
    analyzeDefectsWithLLM,
    predictFutureDefects,
    generateRootCausePDF
} = require("../services/defect_analysis.service");

exports.analyzePropertyDefects = async (req, res) => {
    const { property_id } = req.body;

    if (!property_id) {
        return res.status(400).json({ error: "Property ID is required" });
    }

    try {
        // Fetch all defects for the property
        const defects = await new Promise((resolve, reject) => {
            snowflakeConn.connection.execute({
                sqlText: `
          SELECT
            f.FINDING_ID,
            f.DEFECT_TYPE,
            f.SEVERITY,
            f.OBSERVATION_TEXT,
            f.ROOM_ID,
            e.INSPECTION_DATE,
            e.INSPECTOR_NAME,
            p.BUILDING_TYPE,
            p.REGION
          FROM
            INSPECTION_FINDINGS AS f
            JOIN INSPECTION_EVENT AS e ON f.INSPECTION_ID = e.INSPECTION_ID
            JOIN PROPERTY AS p ON e.PROPERTY_ID = p.PROPERTY_ID
          WHERE
            p.PROPERTY_ID = ?
          ORDER BY
            e.INSPECTION_DATE DESC
          LIMIT 20
        `,
                binds: [property_id],
                complete: (err, stmt, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            });
        });

        if (defects.length === 0) {
            return res.status(404).json({
                error: "No defects found for this property"
            });
        }

        console.log(`Analyzing ${defects.length} defects for property ${property_id}...`);

        // Perform AI analysis
        const analysis = await analyzeDefectsWithLLM(defects);

        let futurePredictions = null;
        let pdfUrl = null;

        if (analysis.success) {
            // Get building info for predictions
            const buildingInfo = {
                property_id: property_id,
                building_type: defects[0]?.BUILDING_TYPE,
                region: defects[0]?.REGION,
                recent_defects_count: defects.length
            };

            // Perform future defect predictions
            futurePredictions = await predictFutureDefects(
                analysis.analysis.rootCauses,
                buildingInfo
            );

            // Generate PDF
            const pdfName = `property-analysis-${property_id}-${Date.now()}.pdf`;

            try {
                await generateRootCausePDF(
                    analysis.analysis,
                    {
                        property_id: property_id,
                        historical_count: defects.length
                    },
                    pdfName
                );
                pdfUrl = `/reports/${pdfName}`;
                console.log('Property analysis PDF generated successfully');
            } catch (pdfError) {
                console.error('Error generating PDF:', pdfError);
            }

            const response = {
                property_id: property_id,
                defects_analyzed: defects.length,
                analysis: analysis.analysis,
                timestamp: analysis.timestamp,
                pdf_report: pdfUrl,
                future_predictions: futurePredictions?.success ? {
                    predictions: futurePredictions.predictions.predictions,
                    predicted_at: futurePredictions.timestamp
                } : null,
            };
            res.json(response);
        } else {
            res.status(500).json({
                error: "AI analysis failed",
                details: analysis.error
            });
        }

    } catch (err) {
        console.error('Error analyzing property defects:', err);
        res.status(500).json({
            error: "Failed to analyze defects",
            details: err.message
        });
    }
};
