const Database = require('better-sqlite3');
const db = new Database('./astronomydb.db');


// =============================================
// WRITE YOUR SQL QUERY BETWEEN THE BACKTICKS
// =============================================
const query = `

    SELECT * FROM galaxies WHERE messier = 'M109';

`;

const stmt = db.prepare(query);
try {
    if (stmt.reader) {
        // SELECT-style: return data
        const results = stmt.all();
        console.log(`\n   ${results.length} row(s) returned:\n`);
        console.table(results);
    } else {
        // INSERT / UPDATE / DELETE
        const info = stmt.run();
        console.log(`\n   ${info.changes} row(s) affected. Last ID: ${info.lastInsertRowid}\n`);
    }
} catch (err) {
    console.error('\n   SQL Error:', err.message, '\n');
}

db.close();