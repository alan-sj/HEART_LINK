const { exec } = require("../db/snowflake");

exports.getReportData = async (propertyId) => {
  const rootCauses = await exec(`
    SELECT
      rm.ROOM_ID,
      rm.ROOM_TYPE,
      rc.ROOT_CAUSE            AS ISSUE,
      COUNT(*)                 AS SUPPORTING_SIGNALS,
      AVG(rc.CONFIDENCE)       AS AVG_CONFIDENCE
    FROM HOUSE_INTEL_DB.CORE.ROOT_CAUSE_INFERENCE rc
    JOIN HOUSE_INTEL_DB.CORE.ROOM rm
      ON rc.ROOM_ID = rm.ROOM_ID
    WHERE rm.PROPERTY_ID = ?
    GROUP BY
      rm.ROOM_ID,
      rm.ROOM_TYPE,
      rc.ROOT_CAUSE
    ORDER BY AVG_CONFIDENCE DESC
  `, [propertyId]);

  const futureRisks = await exec(`
    SELECT
      rm.ROOM_ID,
      rm.ROOM_TYPE,
      fe.EVENT_NAME,
      fe.SEVERITY
    FROM HOUSE_INTEL_DB.CORE.ROOM_FUTURE_EVENTS fe
    JOIN HOUSE_INTEL_DB.CORE.ROOM rm
      ON fe.ROOM_ID = rm.ROOM_ID
    WHERE rm.PROPERTY_ID = ?
  `, [propertyId]);

  return { rootCauses, futureRisks };
};
