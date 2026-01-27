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

connection.connect((err) => {
    if (err) {
        console.error("❌ Snowflake connection failed:", err.message);
    } else {
        console.log("✅ Connected to Snowflake");
    }
});

module.exports = connection;
