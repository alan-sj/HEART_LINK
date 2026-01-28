const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StructuredOutputParser } = require('@langchain/core/output_parsers');
const { z } = require('zod');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ensure reports directory exists
const reportsDir = path.join(__dirname, '../reports');
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

// ============================================================================
// LLM CONFIGURATION & SCHEMAS
// ============================================================================

const initializeLLM = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    return new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: 'gemini-2.5-flash', // Updated model name for better performance
        temperature: 0.3,
    });
};


const rootCauseSchema = z.object({
    rootCauses: z.array(
        z.object({
            cause: z.string().describe('The identified root cause'),
            confidence: z.string().describe('Confidence level: high, medium, or low'),
            affectedSystems: z.array(z.string()).describe('Building systems affected'),
            reasoning: z.string().describe('Why this is identified as a root cause'),
        })
    ),
    recommendations: z.array(z.string()).describe('Immediate action recommendations'),
});

const predictionSchema = z.object({
    predictions: z.array(
        z.object({
            defectType: z.string().describe('Type of potential future defect'),
            likelihood: z.string().describe('Likelihood: high, medium, or low'),
            timeframe: z.string().describe('Expected timeframe for occurrence'),
            preventiveMeasures: z.array(z.string()).describe('Recommended preventive actions'),
            relatedRootCause: z.string().describe('Which root cause this relates to'),
        })
    ),
});

// ============================================================================
// PDF GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate a professional PDF report for root cause analysis
 */
function generateRootCausePDF(analysis, metadata, filename) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            bufferPages: true
        });

        const filepath = path.join(reportsDir, filename);
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header
        doc.fontSize(24)
            .fillColor('#667eea')
            .text('Building Defect Analysis Report', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(18)
            .fillColor('#764ba2')
            .text('Root Cause Analysis', { align: 'center' });

        doc.moveDown(1);

        // Metadata
        doc.fontSize(10)
            .fillColor('#666666')
            .text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'center' });

        if (metadata.inspection_id) {
            doc.text(`Inspection ID: ${metadata.inspection_id}`, { align: 'center' });
        }
        if (metadata.property_id) {
            doc.text(`Property ID: ${metadata.property_id}`, { align: 'center' });
        }
        if (metadata.historical_count) {
            doc.text(`Historical Data Analyzed: ${metadata.historical_count} records`, { align: 'center' });
        }

        doc.moveDown(2);

        // Horizontal line
        doc.strokeColor('#667eea')
            .lineWidth(2)
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

        doc.moveDown(2);

        // Root Causes Section
        doc.fontSize(16)
            .fillColor('#333333')
            .text('🎯 Identified Root Causes', { underline: true });

        doc.moveDown(1);

        analysis.rootCauses.forEach((cause, index) => {
            // Check if we need a new page
            if (doc.y > 650) {
                doc.addPage();
            }

            // Root cause number and title
            doc.fontSize(14)
                .fillColor('#667eea')
                .text(`${index + 1}. ${cause.cause}`, { continued: false });

            // Confidence badge
            const confidenceColor = cause.confidence === 'high' ? '#10b981' :
                cause.confidence === 'medium' ? '#f59e0b' : '#ef4444';

            doc.fontSize(10)
                .fillColor(confidenceColor)
                .text(`Confidence: ${cause.confidence.toUpperCase()}`, { indent: 20 });

            doc.moveDown(0.5);

            // Reasoning
            doc.fontSize(11)
                .fillColor('#333333')
                .text('Reasoning:', { indent: 20, continued: true })
                .font('Helvetica')
                .text(` ${cause.reasoning}`, { indent: 20 });

            doc.moveDown(0.5);

            // Affected Systems
            doc.font('Helvetica-Bold')
                .text('Affected Systems:', { indent: 20 });

            doc.font('Helvetica')
                .fontSize(10)
                .fillColor('#4338ca');

            cause.affectedSystems.forEach(system => {
                doc.text(`• ${system}`, { indent: 40 });
            });

            doc.moveDown(1.5);
        });

        // Add new page for recommendations
        doc.addPage();

        // Recommendations Section
        doc.fontSize(16)
            .fillColor('#333333')
            .text('💡 Immediate Action Recommendations', { underline: true });

        doc.moveDown(1);

        if (analysis.recommendations && analysis.recommendations.length > 0) {
            doc.fontSize(11)
                .fillColor('#333333');

            analysis.recommendations.forEach((rec, index) => {
                if (doc.y > 700) {
                    doc.addPage();
                }
                doc.text(`${index + 1}. ${rec}`, { indent: 20 });
                doc.moveDown(0.5);
            });
        }

        // Footer on each page
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);

            doc.fontSize(8)
                .fillColor('#999999')
                .text(
                    `Page ${i + 1} of ${pages.count} | Building Defect Analysis System | AI-Powered Insights`,
                    50,
                    doc.page.height - 30,
                    { align: 'center' }
                );
        }

        doc.end();

        stream.on('finish', () => resolve(filename));
        stream.on('error', reject);
    });
}

/**
 * Generate a professional PDF report for future predictions
 */
function generatePredictionsPDF(predictions, metadata, filename) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            bufferPages: true
        });

        const filepath = path.join(reportsDir, filename);
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header
        doc.fontSize(24)
            .fillColor('#667eea')
            .text('Building Defect Analysis Report', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(18)
            .fillColor('#764ba2')
            .text('Future Defect Predictions', { align: 'center' });

        doc.moveDown(1);

        // Metadata
        doc.fontSize(10)
            .fillColor('#666666')
            .text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'center' });

        if (metadata.inspection_id) {
            doc.text(`Inspection ID: ${metadata.inspection_id}`, { align: 'center' });
        }
        if (metadata.property_id) {
            doc.text(`Property ID: ${metadata.property_id}`, { align: 'center' });
        }

        doc.moveDown(2);

        // Horizontal line
        doc.strokeColor('#667eea')
            .lineWidth(2)
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

        doc.moveDown(2);

        // Predictions Section
        doc.fontSize(16)
            .fillColor('#333333')
            .text('🔮 Predicted Future Defects', { underline: true });

        doc.moveDown(1);

        predictions.predictions.forEach((pred, index) => {
            // Check if we need a new page
            if (doc.y > 600) {
                doc.addPage();
            }

            // Prediction number and title
            doc.fontSize(14)
                .fillColor('#667eea')
                .text(`${index + 1}. ${pred.defectType}`, { continued: false });

            // Likelihood badge
            const likelihoodColor = pred.likelihood === 'high' ? '#ef4444' :
                pred.likelihood === 'medium' ? '#f59e0b' : '#10b981';

            doc.fontSize(10)
                .fillColor(likelihoodColor)
                .text(`Likelihood: ${pred.likelihood.toUpperCase()}`, { indent: 20 });

            // Timeframe
            doc.fillColor('#666666')
                .text(`Expected Timeframe: ${pred.timeframe}`, { indent: 20 });

            doc.moveDown(0.5);

            // Related root cause
            doc.fontSize(11)
                .fillColor('#333333')
                .font('Helvetica-Bold')
                .text('Related Root Cause:', { indent: 20 });

            doc.font('Helvetica')
                .fontSize(10)
                .fillColor('#666666')
                .text(pred.relatedRootCause, { indent: 40 });

            doc.moveDown(0.5);

            // Preventive Measures
            doc.font('Helvetica-Bold')
                .fontSize(11)
                .fillColor('#333333')
                .text('Preventive Measures:', { indent: 20 });

            doc.font('Helvetica')
                .fontSize(10)
                .fillColor('#333333');

            pred.preventiveMeasures.forEach(measure => {
                if (doc.y > 700) {
                    doc.addPage();
                }
                doc.text(`• ${measure}`, { indent: 40 });
            });

            doc.moveDown(2);
        });

        // Footer on each page
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);

            doc.fontSize(8)
                .fillColor('#999999')
                .text(
                    `Page ${i + 1} of ${pages.count} | Building Defect Analysis System | AI-Powered Insights`,
                    50,
                    doc.page.height - 30,
                    { align: 'center' }
                );
        }

        doc.end();

        stream.on('finish', () => resolve(filename));
        stream.on('error', reject);
    });
}

/**
 * Generate a combined PDF with both root causes and predictions
 */
function generateCombinedPDF(rootCauseAnalysis, predictions, metadata, filename) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            bufferPages: true
        });

        const filepath = path.join(reportsDir, filename);
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Cover Page
        doc.fontSize(28)
            .fillColor('#667eea')
            .text('Building Defect Analysis', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(22)
            .fillColor('#764ba2')
            .text('Complete AI Analysis Report', { align: 'center' });

        doc.moveDown(3);

        // Report details box
        const boxY = doc.y;
        doc.rect(100, boxY, 395, 150)
            .fillAndStroke('#f8f9fa', '#667eea');

        doc.fillColor('#333333')
            .fontSize(12)
            .text(`Report Generated: ${new Date().toLocaleString()}`, 120, boxY + 20);

        if (metadata.inspection_id) {
            doc.text(`Inspection ID: ${metadata.inspection_id}`, 120, doc.y + 10);
        }
        if (metadata.property_id) {
            doc.text(`Property ID: ${metadata.property_id}`, 120, doc.y + 10);
        }
        if (metadata.historical_count) {
            doc.text(`Historical Data Analyzed: ${metadata.historical_count} records`, 120, doc.y + 10);
        }

        doc.text(`Root Causes Identified: ${rootCauseAnalysis.rootCauses.length}`, 120, doc.y + 10);
        doc.text(`Future Predictions: ${predictions.predictions.length}`, 120, doc.y + 10);

        // Table of Contents
        doc.addPage();
        doc.fontSize(20)
            .fillColor('#667eea')
            .text('Table of Contents', { underline: true });

        doc.moveDown(2);
        doc.fontSize(12)
            .fillColor('#333333')
            .text('1. Root Cause Analysis ....................................... 3');
        doc.text('2. Future Defect Predictions ................................ ' + (3 + Math.ceil(rootCauseAnalysis.rootCauses.length / 2)));

        // Root Causes Section
        doc.addPage();
        doc.fontSize(20)
            .fillColor('#667eea')
            .text('1. Root Cause Analysis', { underline: true });

        doc.moveDown(2);

        rootCauseAnalysis.rootCauses.forEach((cause, index) => {
            if (doc.y > 650) {
                doc.addPage();
            }

            doc.fontSize(14)
                .fillColor('#667eea')
                .text(`${index + 1}. ${cause.cause}`, { continued: false });

            const confidenceColor = cause.confidence === 'high' ? '#10b981' :
                cause.confidence === 'medium' ? '#f59e0b' : '#ef4444';

            doc.fontSize(10)
                .fillColor(confidenceColor)
                .text(`Confidence: ${cause.confidence.toUpperCase()}`, { indent: 20 });

            doc.moveDown(0.5);

            doc.fontSize(11)
                .fillColor('#333333')
                .font('Helvetica-Bold')
                .text('Reasoning:', { indent: 20 });

            doc.font('Helvetica')
                .text(cause.reasoning, { indent: 40 });

            doc.moveDown(0.5);

            doc.font('Helvetica-Bold')
                .text('Affected Systems:', { indent: 20 });

            doc.font('Helvetica')
                .fontSize(10)
                .fillColor('#4338ca');

            cause.affectedSystems.forEach(system => {
                doc.text(`• ${system}`, { indent: 40 });
            });

            doc.moveDown(1.5);
        });

        // Recommendations
        if (doc.y > 600) {
            doc.addPage();
        }

        doc.fontSize(16)
            .fillColor('#333333')
            .text('💡 Recommendations', { underline: true });

        doc.moveDown(1);

        if (rootCauseAnalysis.recommendations && rootCauseAnalysis.recommendations.length > 0) {
            doc.fontSize(11)
                .fillColor('#333333');

            rootCauseAnalysis.recommendations.forEach((rec, index) => {
                if (doc.y > 700) {
                    doc.addPage();
                }
                doc.text(`${index + 1}. ${rec}`, { indent: 20 });
                doc.moveDown(0.5);
            });
        }

        // Predictions Section
        doc.addPage();
        doc.fontSize(20)
            .fillColor('#667eea')
            .text('2. Future Defect Predictions', { underline: true });

        doc.moveDown(2);

        predictions.predictions.forEach((pred, index) => {
            if (doc.y > 600) {
                doc.addPage();
            }

            doc.fontSize(14)
                .fillColor('#667eea')
                .text(`${index + 1}. ${pred.defectType}`, { continued: false });

            const likelihoodColor = pred.likelihood === 'high' ? '#ef4444' :
                pred.likelihood === 'medium' ? '#f59e0b' : '#10b981';

            doc.fontSize(10)
                .fillColor(likelihoodColor)
                .text(`Likelihood: ${pred.likelihood.toUpperCase()}`, { indent: 20 });

            doc.fillColor('#666666')
                .text(`Timeframe: ${pred.timeframe}`, { indent: 20 });

            doc.moveDown(0.5);

            doc.fontSize(11)
                .fillColor('#333333')
                .font('Helvetica-Bold')
                .text('Related Root Cause:', { indent: 20 });

            doc.font('Helvetica')
                .fontSize(10)
                .text(pred.relatedRootCause, { indent: 40 });

            doc.moveDown(0.5);

            doc.font('Helvetica-Bold')
                .fontSize(11)
                .text('Preventive Measures:', { indent: 20 });

            doc.font('Helvetica')
                .fontSize(10);

            pred.preventiveMeasures.forEach(measure => {
                if (doc.y > 700) {
                    doc.addPage();
                }
                doc.text(`• ${measure}`, { indent: 40 });
            });

            doc.moveDown(2);
        });

        // Footer on all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);

            doc.fontSize(8)
                .fillColor('#999999')
                .text(
                    `Page ${i + 1} of ${pages.count} | Building Defect Analysis System | AI-Powered Insights`,
                    50,
                    doc.page.height - 30,
                    { align: 'center' }
                );
        }

        doc.end();

        stream.on('finish', () => resolve(filename));
        stream.on('error', reject);
    });
}

// ============================================================================
// LLM ANALYSIS FUNCTIONS
// ============================================================================

async function analyzeDefectsWithLLM(inspectionData) {
    try {
        const llm = initializeLLM();
        const parser = StructuredOutputParser.fromZodSchema(rootCauseSchema);

        const defectsList = inspectionData
            .map((row, i) => {
                return `${i + 1}. Defect Type: ${row.DEFECT_TYPE}
   Severity: ${row.SEVERITY}
   Room: ${row.ROOM_ID}
   Observation: ${row.OBSERVATION_TEXT || 'N/A'}
   Building Type: ${row.BUILDING_TYPE}
   Region: ${row.REGION}
   Inspection Date: ${row.INSPECTION_DATE}`;
            })
            .join('\n\n');

        const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert building diagnostics specialist with deep knowledge of construction defects and their root causes.

Analyze the following building inspection findings and identify the ROOT CAUSES, not just the symptoms:

Inspection Findings:
{defects}

For each root cause you identify:
1. Explain WHY this is a root cause (not just a symptom)
2. Rate your confidence level (high, medium, low)
3. Identify which building systems are affected
4. Provide clear reasoning based on the defect patterns

Focus on systematic issues like:
- Design flaws
- Material selection problems
- Construction methodology issues
- Inadequate maintenance procedures
- Environmental factors (considering the region)
- Workmanship quality
- Building code compliance issues
- Pattern analysis across similar defects

Also provide immediate action recommendations based on the severity and patterns identified.

{format_instructions}
`);

        const input = await promptTemplate.format({
            defects: defectsList,
            format_instructions: parser.getFormatInstructions(),
        });

        const response = await llm.invoke(input);
        const parsedOutput = await parser.parse(response.content);

        return {
            success: true,
            analysis: parsedOutput,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error in LLM analysis:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        };
    }
}

async function predictFutureDefects(rootCauses, buildingInfo) {
    try {
        const llm = initializeLLM();
        const parser = StructuredOutputParser.fromZodSchema(predictionSchema);

        const rootCausesList = rootCauses
            .map((rc, i) => `${i + 1}. ${rc.cause} (Confidence: ${rc.confidence})
   Affected Systems: ${rc.affectedSystems.join(', ')}
   Reasoning: ${rc.reasoning}`)
            .join('\n\n');

        const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert building diagnostics specialist specializing in predictive maintenance and failure analysis.

Based on the identified root causes below, predict FUTURE DEFECTS that are likely to occur if these root causes are not addressed.

Root Causes:
{rootCauses}

Building Context:
{buildingContext}

For each prediction:
1. Specify the type of defect that may occur
2. Estimate the likelihood (high, medium, low)
3. Provide a realistic timeframe (e.g., "3-6 months", "1-2 years")
4. Recommend specific preventive measures
5. Link it to the relevant root cause

Consider:
- Progressive deterioration patterns
- Cascading failures (how one issue leads to another)
- Seasonal and environmental impacts
- Material degradation over time
- Structural stress accumulation
- Regional climate factors

{format_instructions}
`);

        const input = await promptTemplate.format({
            rootCauses: rootCausesList,
            buildingContext: buildingInfo ? JSON.stringify(buildingInfo, null, 2) : 'No additional building info provided',
            format_instructions: parser.getFormatInstructions(),
        });

        const response = await llm.invoke(input);
        const parsedOutput = await parser.parse(response.content);

        return {
            success: true,
            predictions: parsedOutput,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error in prediction:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        };
    }
}

module.exports = {
    analyzeDefectsWithLLM,
    predictFutureDefects,
    generateRootCausePDF,
    generatePredictionsPDF,
    generateCombinedPDF
};
