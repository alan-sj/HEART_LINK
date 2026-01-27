
require("dotenv").config();
const bcrypt = require("bcryptjs");

const express = require("express");
const snowflakeConn = require("./db/snowflake");

const app = express();
app.use(express.json());

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





/*app.get("/property/:id/defects", (req, res) => {
  const propertyId = req.params.id;

  snowflakeConn.execute({
    sqlText: `
      SELECT
        p.property_id,
        p.region,
        p.building_type,
        ie.inspection_id,
        ie.inspection_date,
        ie.inspector_name,
        r.room_id,
        r.room_type,
        r.floor_number,
        f.finding_id,
        f.observation,
        f.observation_text,
        f.image_reference,
        d.defect_type,
        d.severity AS defect_severity,
        d.observation_zone,
        d.confidence
      FROM Property p
      JOIN inspection_event ie
        ON p.property_id = ie.property_id
      JOIN inspection_findings f
        ON ie.inspection_id = f.inspection_id
      JOIN defect_ai_tags d
        ON f.finding_id = d.finding_id
      LEFT JOIN Room r
        ON f.room_id = r.room_id
      WHERE p.property_id = ?
    `,
    binds: [propertyId],
    complete: (err, stmt, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      console.log(`✔ Found ${rows.length} issues for property ${propertyId}`);
      res.json(rows);
    }
  });
});*/
















// ROUTES
//app.use('/property', require('./routes/property'));
/*app.use('/room', require('./routes/room'));
app.use('/inspection', require('./routes/inspection'));
app.use('/report2', require('./routes/report2'));*/





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
