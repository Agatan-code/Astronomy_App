// write_runner.js — For INSERT, UPDATE, and DELETE queries (Section 6)
// Usage: node write_runner.js

const Database = require('better-sqlite3');
const db = new Database('./astronomydb.db');

// =============================================
// WRITE YOUR SQL QUERY BETWEEN THE BACKTICKS
// =============================================
const query = `

    YOUR SQL GOES HERE

`;
// =============================================

try {
    const result = db.prepare(query).run();
    console.log(`\n  Query executed successfully.`);
    console.log(`  Rows affected : ${result.changes}`);
    console.log(`  Last insert ID: ${result.lastInsertRowid}\n`);
} catch (err) {
    console.error('\n  SQL Error:', err.message, '\n');
}

db.close();
