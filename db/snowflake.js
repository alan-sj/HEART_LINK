const snowflake = require("snowflake-sdk");

const connection = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USERNAME,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
    role: process.env.SNOWFLAKE_ROLE
});

connection.connect(err => {
    if (err) {
        console.error("Snowflake connection failed:", err.message);
    } else {
        console.log("Connected to Snowflake");
    }
});

const exec = (sql, binds = []) =>
    new Promise((resolve, reject) => {
        connection.execute({
            sqlText: sql,
            binds,
            complete: (err, stmt, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        });
    });

const { v4: uuidv4 } = require("uuid");

async function insertInspectionFinding({
    inspectionId,
    roomId,
    description,
    imageRef
}) {
    const findingId = uuidv4();

    await exec(`
    INSERT INTO INSPECTION_FINDINGS
    (FINDING_ID, INSPECTION_ID, ROOM_ID, OBSERVATION_TEXT, IMAGE_REF)
    VALUES (?, ?, ?, ?, ?)
  `, [findingId, inspectionId, roomId, description, imageRef]);

    return findingId;
}

async function insertDefectTag({
    findingId,
    defectType,
    severity,
    confidence
}) {
    await exec(`
    INSERT INTO DEFECT_AI_TAGS
    (FINDING_ID, DEFECT_TYPE, SEVERITY, CONFIDENCE)
    VALUES (?, ?, ?, ?)
  `, [findingId, defectType, severity, confidence]);
}

module.exports = {
    connection,
    exec,
    insertInspectionFinding,
    insertDefectTag
};
