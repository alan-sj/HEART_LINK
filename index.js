require("dotenv").config();
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
app.use("/report", require("./routes/report.routes"));

const visionRoutes = require("./routes/vision.routes");
app.use("/vision", visionRoutes);

app.listen(process.env.PORT, () => {
    console.log(`🚀 Server running on port ${process.env.PORT}`);
});
