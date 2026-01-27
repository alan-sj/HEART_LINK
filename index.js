
require("dotenv").config();
const bcrypt = require("bcryptjs");
const cors = require('cors');


const express = require("express");
const snowflakeConn = require("./db/snowflake");

const app = express();
app.use(express.json());
app.use(cors());


app.get("/", (req, res) => {
  res.send("Snowflake Node API is running 🚀");
});


app.get("/health", (req, res) => {
  snowflakeConn.execute({
    sqlText: `
      SELECT
        CURRENT_USER(),
        CURRENT_ROLE(),
        CURRENT_DATABASE(),
        CURRENT_SCHEMA(),
        CURRENT_WAREHOUSE()
    `,
    complete: (err, stmt, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows[0]);
    }
  });
});
app.use('/report', require('./routes/report.routes'));


//USER REGISTRATION

const { v4: uuidv4 } = require("uuid");

app.post("/auth/register", async (req, res) => {
  const { full_name, email, password, role, license_id } = req.body;

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (role === "INSPECTOR" && !license_id) {
    return res.status(400).json({ error: "License ID required for inspector" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();

  snowflakeConn.execute({
    sqlText: `
      INSERT INTO USERS (
        user_id, full_name, email, password_hash, role, license_id
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    binds: [
      userId,
      full_name,
      email,
      passwordHash,
      role,
      role === "INSPECTOR" ? license_id : null
    ],
    complete: (err) => {
      if (err) {
        if (err.message.includes("unique")) {
          return res.status(409).json({ error: "Email already registered" });
        }
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        message: "Registration successful",
        user_id: userId,
        role
      });
    }
  });
});












//USER LOGIN
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  snowflakeConn.execute({
    sqlText: `
      SELECT user_id, full_name, password_hash, role
      FROM USERS
      WHERE email = ?
    `,
    binds: [email],
    complete: async (err, stmt, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      if (rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.PASSWORD_HASH);

      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      res.json({
        message: "Login successful",
        user_id: user.USER_ID,
        full_name: user.FULL_NAME,
        role: user.ROLE
      });
    }
  });
});





// API ENDPOINTS- HOUR 3 WORKS

//1️⃣ GET /property/:id/defects


app.get('/property/:id/defects', (req, res) => {
  const propertyId = req.params.id;

  const sql = `
    SELECT f.finding_id, d.defect_type, d.severity, d.observation_zone, d.confidence, f.observation_text
    FROM Inspection_Findings f
    JOIN Defect_AI_Tags d ON f.finding_id = d.finding_id
    JOIN Inspection_Event e ON f.inspection_id = e.inspection_id
    WHERE e.property_id = ?
  `;

  snowflakeConn.execute({
    sqlText: sql,
    binds: [propertyId],
    complete: (err, stmt, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  });
});



//2. GET /property/{id}/risk-score- Fetch risk score for each ppty


app.get('/property/:id/risk-score', (req, res) => {
  const propertyId = req.params.id;

  const query = `
    SELECT *
    FROM TABLE(core.calculate_property_risk_scores())
    WHERE property_id = ?
  `;

  snowflakeConn.execute({
    sqlText: query,
    binds: [propertyId],
    complete: (err, stmt, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) return res.status(404).json({ message: 'No risk score found for this property' });
      res.json(rows[0]);
    }
  });
});



//3.  GET /room/{id}/alerts- to be reworked if possible

app.get("/room/:id/alerts", (req, res) => {
  const roomId = req.params.id;

  snowflakeConn.execute({
    sqlText: `
      SELECT 
        alert_id,
        alert_type,
        alert_class,
        risk_score,
        alert_message,
        created_at
      FROM core.alerts
      WHERE alert_level = 'ROOM'
        AND entity_id = ?
      ORDER BY created_at DESC
    `,
    binds: [roomId],
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Error fetching room alerts:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  });
});



//4.  POST /inspection/submit

app.post("/inspection/submit", async (req, res) => {
  const {
    property_id,
    inspection_date,
    inspector_name,
    findings
  } = req.body;

  if (!property_id || !inspection_date || !inspector_name || !findings?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const inspectionId = crypto.randomUUID();

    await snowflakeConn.execute({
      sqlText: `
        INSERT INTO core.inspection_event
        (inspection_id, property_id, inspection_date, inspector_name)
        VALUES (?, ?, ?, ?)
      `,
      binds: [inspectionId, property_id, inspection_date, inspector_name]
    });

    // 2️⃣ Insert findings + AI tags
    for (const f of findings) {
      const findingId = crypto.randomUUID();

      await snowflakeConn.execute({
        sqlText: `
          INSERT INTO core.inspection_finding
          (finding_id, inspection_id, room_id, observation_text, image_ref)
          VALUES (?, ?, ?, ?, ?)
        `,
        binds: [
          findingId,
          inspectionId,
          f.room_id,
          f.observation_text,
          f.image_ref
        ]
      });

      await snowflakeConn.execute({
        sqlText: `
          INSERT INTO core.defect_ai_tags
          (finding_id, defect_type, severity, observation_zone, confidence)
          VALUES (?, ?, ?, ?, ?)
        `,
        binds: [
          findingId,
          f.defect_type,
          f.severity,
          f.observation_zone || 'GENERAL',
          f.confidence
        ]
      });
    }

    res.status(201).json({
      message: "Inspection submitted successfully",
      inspection_id: inspectionId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.use("/report", require("./routes/report.routes"));
app.use("/property", require("./routes/property.routes"));

const visionRoutes = require("./routes/vision.routes");
app.use("/vision", visionRoutes);










//5  GET /report/{property_id}/{user_type}



















// ROUTES
//app.use('/property', require('./routes/property'));
/*app.use('/room', require('./routes/room'));
app.use('/inspection', require('./routes/inspection'));
app.use('/report2', require('./routes/report2'));*/





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
