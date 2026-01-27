const snowflakeConn = require("../db/snowflake");

const exec = (sql, binds = []) =>
    new Promise((resolve, reject) => {
        snowflakeConn.execute({
            sqlText: sql,
            binds,
            complete: (err, stmt, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        });
    });

exports.getReportData = async (propertyId) => {
    const rootCauses = await exec(`
    SELECT
      rm.ROOM_TYPE,
      r.ROOT_CAUSE,
      r.SUPPORTING_SIGNALS,
      r.AVG_CONFIDENCE
    FROM ROOM_ROOT_CAUSES r
    JOIN ROOM rm ON r.ROOM_ID = rm.ROOM_ID
    WHERE rm.PROPERTY_ID = ?
  `, [propertyId]);

    const futureRisks = await exec(`
    SELECT
      rm.ROOM_TYPE,
      fe.EVENT_NAME,
      fe.SEVERITY
    FROM ROOM_FUTURE_EVENTS fe
    JOIN ROOM rm ON fe.ROOM_ID = rm.ROOM_ID
    WHERE rm.PROPERTY_ID = ?
  `, [propertyId]);

    return { rootCauses, futureRisks };
};
