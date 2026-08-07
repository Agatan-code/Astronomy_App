const { error } = require("console");
const { response } = require("express");

// Backend Knowledge
const express = require("express");
const path = require("path");

// Initializing the database
const Database = require('better-sqlite3');
const db = new Database('./astronomydb.db');

// Create server applications
const app = express();
const PORT = 3000;

// express.static allows server tp serve HTML, CSS, and JS
// Here we are setting the directory (__dirname) to 'public'
app.use(express.static(path.join(__dirname, "public")))

// Setting the PORT for the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
});


const ALL_OBJECTS_QUERY = `
    SELECT id, messier, ngc, season, constellation_id, discoverer_id,
           magnitude, ra, dec, distance, size, image_url,
           'galaxy' AS object_type
    FROM galaxies
    UNION ALL
    SELECT id, messier, ngc, season, constellation_id, discoverer_id,
           magnitude, ra, dec, distance, size, image_url,
           'globular_cluster' AS object_type
    FROM globular_cluster
    UNION ALL
    SELECT id, messier, ngc, season, constellation_id, discoverer_id,
           magnitude, ra, dec, distance, size, image_url,
           'emission_nebula' AS object_type
    FROM emission_nebula
    UNION ALL
    SELECT id, messier, ngc, season, constellation_id, discoverer_id,
           magnitude, ra, dec, distance, size, image_url,
           'open_cluster' AS object_type
    FROM open_cluster
    UNION ALL
    SELECT id, messier, ngc, season, constellation_id, discoverer_id,
           magnitude, ra, dec, distance, size, image_url,
           'planetary_nebula' AS object_type
    FROM planetary_nebula
    UNION ALL
    SELECT id, messier, ngc, season, constellation_id, discoverer_id,
           magnitude, ra, dec, distance, size, image_url,
           'reflection_nebula' AS object_type
    FROM reflection_nebula
    UNION ALL
    SELECT id, messier, ngc, season, constellation_id, discoverer_id,
           magnitude, ra, dec, distance, size, image_url,
           object_type
    FROM other
`;





// ================= GET ======================
// All objects — powers the initial card grid
app.get("/api/objects", (req, res) => {
    try {
        const stmt = db.prepare(ALL_OBJECTS_QUERY);
        const results = stmt.all();
        res.status(200).json(results);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });    
    }
});

app.get("/api/objects/:type", (req, res) => {
    try {
       const { type } = req.params;
       const stmt = db.prepare(`SELECT * FROM ${type}`);
       const results = stmt.all();
       res.status(200).json(results);    
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });    
    }
});

// Search by name — powers the search form
app.get("/api/object/:nameOfObject", (req, res) => {
    const { nameOfObject } = req.params;
    const stmt = db.prepare(`SELECT * FROM (${ALL_OBJECTS_QUERY}) WHERE messier = ? OR ngc = ?`);
    const results = stmt.all(nameOfObject, nameOfObject);
    res.status(200).json(results);
});
