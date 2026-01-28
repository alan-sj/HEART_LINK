
require("dotenv").config();
const bcrypt = require("bcryptjs");
const cors = require('cors');
const path = require('path');


const express = require("express");
const snowflakeConn = require("./db/snowflake");

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());


app.get("/", (req, res) => {
  res.send("Snowflake Node API is running 🚀");
});


app.get("/health", (req, res) => {
  snowflakeConn.connection.execute({
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

// Report routes
app.use('/reports', express.static(path.join(__dirname, 'reports')));
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

  snowflakeConn.connection.execute({
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

  snowflakeConn.connection.execute({
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


const { analyzePropertyDefects } = require('./controllers/defect.controller');

app.post('/property/:id/analyze', (req, res) => {
  req.body = req.body || {};
  req.body.property_id = req.params.id; // Inject param into body for controller compatibility
  analyzePropertyDefects(req, res);
});

app.get('/property/:id/defects', (req, res) => {
  const propertyId = req.params.id;

  const sql = `
    SELECT f.finding_id, d.defect_type, d.severity, d.observation_zone, d.confidence, f.observation_text
    FROM Inspection_Findings f
    JOIN Defect_AI_Tags d ON f.finding_id = d.finding_id
    JOIN Inspection_Event e ON f.inspection_id = e.inspection_id
    WHERE e.property_id = ?
  `;

  snowflakeConn.connection.execute({
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

  snowflakeConn.connection.execute({
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

  snowflakeConn.connection.execute({
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

  // Helper to promisify Snowflake execute
  const executeQuery = (sqlText, binds) => {
    return new Promise((resolve, reject) => {
      snowflakeConn.connection.execute({
        sqlText,
        binds,
        complete: (err, stmt, rows) => {
          if (err) {
            console.error("Snowflake SQL Error:", err.message);
            console.error("SQL:", sqlText);
            console.error("Binds:", binds);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      });
    });
  };

  try {
    const inspectionId = crypto.randomUUID();

    console.log("Inserting inspection_event:", inspectionId);
    await executeQuery(`
      INSERT INTO INSPECTION_EVENT
      (inspection_id, property_id, inspection_date, inspector_name)
      VALUES (?, ?, ?, ?)
    `, [inspectionId, property_id, inspection_date, inspector_name]);

    // Insert findings
    for (const f of findings) {
      const findingId = crypto.randomUUID();
      console.log("Inserting inspection_finding:", findingId);

      await executeQuery(`
        INSERT INTO INSPECTION_FINDINGS
        (finding_id, inspection_id, room_id, observation_text, image_ref)
        VALUES (?, ?, ?, ?, ?)
      `, [findingId, inspectionId, f.room_id, f.observation_text, f.image_ref || null]);

      console.log("Inserting defect_ai_tags for finding:", findingId);
      await executeQuery(`
        INSERT INTO DEFECT_AI_TAGS
        (finding_id, defect_type, severity, observation_zone, confidence)
        VALUES (?, ?, ?, ?, ?)
      `, [findingId, f.defect_type, f.severity, f.observation_zone || 'GENERAL', f.confidence]);
    }

    console.log("Inspection submitted successfully:", inspectionId);
    res.status(201).json({
      message: "Inspection submitted successfully",
      inspection_id: inspectionId
    });

  } catch (err) {
    console.error("Inspection submission error:", err);
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
