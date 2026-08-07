// Run this code once, to fill astronomydb.db with data

const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const db = new Database('./astronomydb.db');


db.exec(`
CREATE TABLE IF NOT EXISTS discoverers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    discovery_date INTEGER
);

CREATE TABLE IF NOT EXISTS constellations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT,
    name_fr TEXT,
    name_la TEXT,
    abbreviation TEXT
); 

CREATE TABLE IF NOT EXISTS galaxies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messier TEXT NOT NULL,
    ngc TEXT,
    season TEXT,
    constellation_id INTEGER,
    discoverer_id INTEGER,
    magnitude REAL,
    ra TEXT,
    dec TEXT,
    distance REAL,
    size TEXT,
    image_url TEXT NOT NULL,
    FOREIGN KEY (constellation_id) REFERENCES constellations(id),
    FOREIGN KEY (discoverer_id) REFERENCES discoverers(id)
); 

CREATE TABLE IF NOT EXISTS globular_cluster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messier TEXT NOT NULL,
    ngc TEXT,
    season TEXT,
    constellation_id INTEGER,
    discoverer_id INTEGER,
    magnitude REAL,
    ra TEXT,
    dec TEXT,
    distance REAL,
    size TEXT,
    image_url TEXT NOT NULL,
    FOREIGN KEY (constellation_id) REFERENCES constellations(id),
    FOREIGN KEY (discoverer_id) REFERENCES discoverers(id)
);

CREATE TABLE IF NOT EXISTS emission_nebula (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messier TEXT NOT NULL,
    ngc TEXT,
    season TEXT,
    constellation_id INTEGER,
    discoverer_id INTEGER,
    magnitude REAL,
    ra TEXT,
    dec TEXT,
    distance REAL,
    size TEXT,
    image_url TEXT NOT NULL,
    FOREIGN KEY (constellation_id) REFERENCES constellations(id),
    FOREIGN KEY (discoverer_id) REFERENCES discoverers(id)
);

CREATE TABLE IF NOT EXISTS open_cluster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messier TEXT NOT NULL,
    ngc TEXT,
    season TEXT,
    constellation_id INTEGER,
    discoverer_id INTEGER,
    magnitude REAL,
    ra TEXT,
    dec TEXT,
    distance REAL,
    size TEXT,
    image_url TEXT NOT NULL,
    FOREIGN KEY (constellation_id) REFERENCES constellations(id),
    FOREIGN KEY (discoverer_id) REFERENCES discoverers(id)
);

CREATE TABLE IF NOT EXISTS planetary_nebula (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messier TEXT NOT NULL,
    ngc TEXT,
    season TEXT,
    constellation_id INTEGER,
    discoverer_id INTEGER,
    magnitude REAL,
    ra TEXT,
    dec TEXT,
    distance REAL,
    size TEXT,
    image_url TEXT NOT NULL,
    FOREIGN KEY (constellation_id) REFERENCES constellations(id),
    FOREIGN KEY (discoverer_id) REFERENCES discoverers(id)
);

CREATE TABLE IF NOT EXISTS reflection_nebula (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messier TEXT NOT NULL,
    ngc TEXT,
    season TEXT,
    constellation_id INTEGER,
    discoverer_id INTEGER,
    magnitude REAL,
    ra TEXT,
    dec TEXT,
    distance REAL,
    size TEXT,
    image_url TEXT NOT NULL,
    FOREIGN KEY (constellation_id) REFERENCES constellations(id),
    FOREIGN KEY (discoverer_id) REFERENCES discoverers(id)
);

CREATE TABLE IF NOT EXISTS other (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messier TEXT NOT NULL,
    ngc TEXT,
    object_type TEXT NOT NULL,
    season TEXT,
    constellation_id INTEGER,
    discoverer_id INTEGER,
    magnitude REAL,
    ra TEXT,
    dec TEXT,
    distance REAL,
    size TEXT,
    image_url TEXT NOT NULL,
    FOREIGN KEY (constellation_id) REFERENCES constellations(id),
    FOREIGN KEY (discoverer_id) REFERENCES discoverers(id)
);
`);

// Initializing and converting the Excel file
const workbook = XLSX.readFile('catalogue-de-messier.xlsx');
const sheetName = workbook.SheetNames[0];
const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);


// Prepare teh SQL statement for the columns
const insertDiscoverer = db.prepare(`
    INSERT INTO discoverers (name, discovery_date)
    VALUES (?, ?)
`);

// Prepare teh SQL statement for the columns
const insertConstellations = db.prepare(`
    INSERT INTO constellations (name_en, name_fr, name_la, abbreviation)
    VALUES (?, ?, ?, ?)
`);

// Prepare teh SQL statement for the columns
const insertGalaxies = db.prepare(`
    INSERT INTO galaxies (messier, ngc, season, constellation_id, discoverer_id, magnitude, ra, dec, distance, size, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Prepare teh SQL statement for the columns
const insertGlobular_cluster = db.prepare(`
    INSERT INTO globular_cluster (messier, ngc, season, constellation_id, discoverer_id, magnitude, ra, dec, distance, size, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Prepare teh SQL statement for the columns
const insertEmission_nebula = db.prepare(`
    INSERT INTO emission_nebula (messier, ngc, season, constellation_id, discoverer_id, magnitude, ra, dec, distance, size, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Prepare teh SQL statement for the columns
const insertOpen_cluster = db.prepare(`
    INSERT INTO open_cluster (messier, ngc, season, constellation_id, discoverer_id, magnitude, ra, dec, distance, size, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Prepare teh SQL statement for the columns
const insertPlanetary_nebula = db.prepare(`
    INSERT INTO planetary_nebula (messier, ngc, season, constellation_id, discoverer_id, magnitude, ra, dec, distance, size, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Prepare teh SQL statement for the columns
const insertReflection_nebula = db.prepare(`
    INSERT INTO reflection_nebula (messier, ngc, season, constellation_id, discoverer_id, magnitude, ra, dec, distance, size, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Prepare teh SQL statement for the columns
const insertOther = db.prepare(`
    INSERT INTO other (messier, ngc, object_type, season, constellation_id, discoverer_id, magnitude, ra, dec, distance, size, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);



// Running the transaction
const discoverer = db.transaction((rows) => {
    for (const row of rows) {
        const nameValue = row['Discoverer / Découvreur'];
        const yearValue = row['Year / Année'];

        // Convert year to int if it exists, otherwise, leave it undefined
        const parsedYear = yearValue ? parseInt(yearValue, 10) : undefined;

        // Use ?? to convert missing values (undefined) directly into SQL null
        insertDiscoverer.run(
            nameValue ?? null,
            parsedYear ?? null
        );
    }
});

// Running the transaction
const constellations = db.transaction((rows) => {
    for (const row of rows) {
        const name_enValue = row['Constellation (EN)'];
        const name_frValue = row['Constellation (FR)'];
        const name_laValue = row['Constellation (Latin)'];
        const abbreviationValue = row['Constellation'];

        // Use ?? to convert missing values (undefined) directly into SQL null
        insertConstellations.run(
            name_enValue ?? null,
            name_frValue ?? null,
            name_laValue ?? null,
            abbreviationValue ?? null
        );
    }
});


// Running the transaction
const galaxies = db.transaction((rows) => {
    // 1. Prepare lookup statements once inside the transaction for speed
    const getConstellationId = db.prepare("SELECT id FROM constellations WHERE abbreviation = ?");
    const getDiscovererId = db.prepare("SELECT id FROM discoverers WHERE name = ?");

    for (const row of rows) {
        if (row["Object type / Type d'objet"] === "Galaxy / Galaxie") {
            const messierValue = row['Messier'];
            const ngcValue = row['NGC'];
            const seasonValue = row['Season / Saison'];
            const magnitudeValue = row['Magnitude'];
            const raValue = row['RA (Right Ascension)'];
            const decValue = row['Dec (Declinaison)'];
            const distanceValue = row['Distance (l.y / a. l.)'];
            const sizeValue = row['Size / Dimensions'];
            const image_urlValue = row['Image'];

            // 2. Extract string keys from the Excel row
            const constellationAbbrev = row['Constellation'];
            const discovererName = row['Discoverer / Découvreur']; 

            // 3. Query parent tables to find the matching rows
            const constellationRow = getConstellationId.get(constellationAbbrev);
            const discovererRow = getDiscovererId.get(discovererName);

            // 4. Strict Validation: Crash the transaction if a relationship is missing
            if (!constellationRow) {
                throw new Error(`Foreign Key Error: Constellation '${constellationAbbrev}' not found in database.`);
            }
            if (!discovererRow) {
                throw new Error(`Foreign Key Error: Discoverer '${discovererName}' not found in database.`);
            }

            // 5. Extract the numeric IDs for insertion
            const constellation_idValue = constellationRow.id;
            const discoverer_idValue = discovererRow.id;

            // 6. Run the insert statement inside the loop block
            insertGalaxies.run(
                messierValue ?? null,
                ngcValue ?? null,
                seasonValue ?? null,
                constellation_idValue, // Numeric ID reference
                discoverer_idValue,    // Numeric ID reference
                magnitudeValue ?? null,
                raValue ?? null,
                decValue ?? null,
                distanceValue ?? null,
                sizeValue ?? null,
                image_urlValue ?? null
            );
        }
    }
});


// Running the transaction
const globular_clusters = db.transaction((rows) => {
    // 1. Prepare lookup statements once inside the transaction for speed
    const getConstellationId = db.prepare("SELECT id FROM constellations WHERE abbreviation = ?");
    const getDiscovererId = db.prepare("SELECT id FROM discoverers WHERE name = ?");

    for (const row of rows) {
        if (row["Object type / Type d'objet"] === "Globular Cluster / Amas Globulaire") {
            const messierValue = row['Messier'];
            const ngcValue = row['NGC'];
            const seasonValue = row['Season / Saison'];
            const magnitudeValue = row['Magnitude'];
            const raValue = row['RA (Right Ascension)'];
            const decValue = row['Dec (Declinaison)'];
            const distanceValue = row['Distance (l.y / a. l.)'];
            const sizeValue = row['Size / Dimensions'];
            const image_urlValue = row['Image'];

            // 2. Extract string keys from the Excel row
            const constellationAbbrev = row['Constellation'];
            const discovererName = row['Discoverer / Découvreur']; 

            // 3. Query parent tables to find the matching rows
            const constellationRow = getConstellationId.get(constellationAbbrev);
            const discovererRow = getDiscovererId.get(discovererName);

            // 4. Strict Validation: Crash the transaction if a relationship is missing
            if (!constellationRow) {
                throw new Error(`Foreign Key Error: Constellation '${constellationAbbrev}' not found in database.`);
            }
            if (!discovererRow) {
                throw new Error(`Foreign Key Error: Discoverer '${discovererName}' not found in database.`);
            }

            // 5. Extract the numeric IDs for insertion
            const constellation_idValue = constellationRow.id;
            const discoverer_idValue = discovererRow.id;

            // 6. Run the insert statement inside the loop block
            insertGlobular_cluster.run(
                messierValue ?? null,
                ngcValue ?? null,
                seasonValue ?? null,
                constellation_idValue, // Numeric ID reference
                discoverer_idValue,    // Numeric ID reference
                magnitudeValue ?? null,
                raValue ?? null,
                decValue ?? null,
                distanceValue ?? null,
                sizeValue ?? null,
                image_urlValue ?? null
            );
        }
    }
});


// Running the transaction
const emission_nebula = db.transaction((rows) => {
    // 1. Prepare lookup statements once inside the transaction for speed
    const getConstellationId = db.prepare("SELECT id FROM constellations WHERE abbreviation = ?");
    const getDiscovererId = db.prepare("SELECT id FROM discoverers WHERE name = ?");

    for (const row of rows) {
        if (row["Object type / Type d'objet"] === "Emission Nebula / Nébuleuse à émission") {
            const messierValue = row['Messier'];
            const ngcValue = row['NGC'];
            const seasonValue = row['Season / Saison'];
            const magnitudeValue = row['Magnitude'];
            const raValue = row['RA (Right Ascension)'];
            const decValue = row['Dec (Declinaison)'];
            const distanceValue = row['Distance (l.y / a. l.)'];
            const sizeValue = row['Size / Dimensions'];
            const image_urlValue = row['Image'];

            // 2. Extract string keys from the Excel row
            const constellationAbbrev = row['Constellation'];
            const discovererName = row['Discoverer / Découvreur']; 

            // 3. Query parent tables to find the matching rows
            const constellationRow = getConstellationId.get(constellationAbbrev);
            const discovererRow = getDiscovererId.get(discovererName);

            // 4. Strict Validation: Crash the transaction if a relationship is missing
            if (!constellationRow) {
                throw new Error(`Foreign Key Error: Constellation '${constellationAbbrev}' not found in database.`);
            }
            if (!discovererRow) {
                throw new Error(`Foreign Key Error: Discoverer '${discovererName}' not found in database.`);
            }

            // 5. Extract the numeric IDs for insertion
            const constellation_idValue = constellationRow.id;
            const discoverer_idValue = discovererRow.id;

            // 6. Run the insert statement inside the loop block
            insertEmission_nebula.run(
                messierValue ?? null,
                ngcValue ?? null,
                seasonValue ?? null,
                constellation_idValue, // Numeric ID reference
                discoverer_idValue,    // Numeric ID reference
                magnitudeValue ?? null,
                raValue ?? null,
                decValue ?? null,
                distanceValue ?? null,
                sizeValue ?? null,
                image_urlValue ?? null
            );
        }
    }
});


// Running the transaction
const open_cluster = db.transaction((rows) => {
    // 1. Prepare lookup statements once inside the transaction for speed
    const getConstellationId = db.prepare("SELECT id FROM constellations WHERE abbreviation = ?");
    const getDiscovererId = db.prepare("SELECT id FROM discoverers WHERE name = ?");

    for (const row of rows) {
        if (row["Object type / Type d'objet"] === "Open Cluster / Amas Ouvert") {
            const messierValue = row['Messier'];
            const ngcValue = row['NGC'];
            const seasonValue = row['Season / Saison'];
            const magnitudeValue = row['Magnitude'];
            const raValue = row['RA (Right Ascension)'];
            const decValue = row['Dec (Declinaison)'];
            const distanceValue = row['Distance (l.y / a. l.)'];
            const sizeValue = row['Size / Dimensions'];
            const image_urlValue = row['Image'];

            // 2. Extract string keys from the Excel row
            const constellationAbbrev = row['Constellation'];
            const discovererName = row['Discoverer / Découvreur']; 

            // 3. Query parent tables to find the matching rows
            const constellationRow = getConstellationId.get(constellationAbbrev);
            const discovererRow = getDiscovererId.get(discovererName);

            // 4. Strict Validation: Crash the transaction if a relationship is missing
            if (!constellationRow) {
                throw new Error(`Foreign Key Error: Constellation '${constellationAbbrev}' not found in database.`);
            }
            if (!discovererRow) {
                throw new Error(`Foreign Key Error: Discoverer '${discovererName}' not found in database.`);
            }

            // 5. Extract the numeric IDs for insertion
            const constellation_idValue = constellationRow.id;
            const discoverer_idValue = discovererRow.id;

            // 6. Run the insert statement inside the loop block
            insertOpen_cluster.run(
                messierValue ?? null,
                ngcValue ?? null,
                seasonValue ?? null,
                constellation_idValue, // Numeric ID reference
                discoverer_idValue,    // Numeric ID reference
                magnitudeValue ?? null,
                raValue ?? null,
                decValue ?? null,
                distanceValue ?? null,
                sizeValue ?? null,
                image_urlValue ?? null
            );
        }
    }
});


// Running the transaction
const planetary_nebula = db.transaction((rows) => {
    // 1. Prepare lookup statements once inside the transaction for speed
    const getConstellationId = db.prepare("SELECT id FROM constellations WHERE abbreviation = ?");
    const getDiscovererId = db.prepare("SELECT id FROM discoverers WHERE name = ?");

    for (const row of rows) {
        if (row["Object type / Type d'objet"] === "Planetary Nebula / Nébuleuse Planétaire") {
            const messierValue = row['Messier'];
            const ngcValue = row['NGC'];
            const seasonValue = row['Season / Saison'];
            const magnitudeValue = row['Magnitude'];
            const raValue = row['RA (Right Ascension)'];
            const decValue = row['Dec (Declinaison)'];
            const distanceValue = row['Distance (l.y / a. l.)'];
            const sizeValue = row['Size / Dimensions'];
            const image_urlValue = row['Image'];

            // 2. Extract string keys from the Excel row
            const constellationAbbrev = row['Constellation'];
            const discovererName = row['Discoverer / Découvreur']; 

            // 3. Query parent tables to find the matching rows
            const constellationRow = getConstellationId.get(constellationAbbrev);
            const discovererRow = getDiscovererId.get(discovererName);

            // 4. Strict Validation: Crash the transaction if a relationship is missing
            if (!constellationRow) {
                throw new Error(`Foreign Key Error: Constellation '${constellationAbbrev}' not found in database.`);
            }
            if (!discovererRow) {
                throw new Error(`Foreign Key Error: Discoverer '${discovererName}' not found in database.`);
            }

            // 5. Extract the numeric IDs for insertion
            const constellation_idValue = constellationRow.id;
            const discoverer_idValue = discovererRow.id;

            // 6. Run the insert statement inside the loop block
            insertPlanetary_nebula.run(
                messierValue ?? null,
                ngcValue ?? null,
                seasonValue ?? null,
                constellation_idValue, // Numeric ID reference
                discoverer_idValue,    // Numeric ID reference
                magnitudeValue ?? null,
                raValue ?? null,
                decValue ?? null,
                distanceValue ?? null,
                sizeValue ?? null,
                image_urlValue ?? null
            );
        }
    }
});


// Running the transaction
const reflection_nebula = db.transaction((rows) => {
    // 1. Prepare lookup statements once inside the transaction for speed
    const getConstellationId = db.prepare("SELECT id FROM constellations WHERE abbreviation = ?");
    const getDiscovererId = db.prepare("SELECT id FROM discoverers WHERE name = ?");

    for (const row of rows) {
        if (row["Object type / Type d'objet"] === "Reflection Nebula / Nébuleuse à réflexion") {
            const messierValue = row['Messier'];
            const ngcValue = row['NGC'];
            const seasonValue = row['Season / Saison'];
            const magnitudeValue = row['Magnitude'];
            const raValue = row['RA (Right Ascension)'];
            const decValue = row['Dec (Declinaison)'];
            const distanceValue = row['Distance (l.y / a. l.)'];
            const sizeValue = row['Size / Dimensions'];
            const image_urlValue = row['Image'];

            // 2. Extract string keys from the Excel row
            const constellationAbbrev = row['Constellation'];
            const discovererName = row['Discoverer / Découvreur']; 

            // 3. Query parent tables to find the matching rows
            const constellationRow = getConstellationId.get(constellationAbbrev);
            const discovererRow = getDiscovererId.get(discovererName);

            // 4. Strict Validation: Crash the transaction if a relationship is missing
            if (!constellationRow) {
                throw new Error(`Foreign Key Error: Constellation '${constellationAbbrev}' not found in database.`);
            }
            if (!discovererRow) {
                throw new Error(`Foreign Key Error: Discoverer '${discovererName}' not found in database.`);
            }

            // 5. Extract the numeric IDs for insertion
            const constellation_idValue = constellationRow.id;
            const discoverer_idValue = discovererRow.id;

            // 6. Run the insert statement inside the loop block
            insertReflection_nebula.run(
                messierValue ?? null,
                ngcValue ?? null,
                seasonValue ?? null,
                constellation_idValue, // Numeric ID reference
                discoverer_idValue,    // Numeric ID reference
                magnitudeValue ?? null,
                raValue ?? null,
                decValue ?? null,
                distanceValue ?? null,
                sizeValue ?? null,
                image_urlValue ?? null
            );
        }
    }
});


const list_of_objects = ["Galaxy / Galaxie", "Globular Cluster / Amas Globulaire", "Emission Nebula / Nébuleuse à émission", "Open Cluster / Amas Ouvert", "Planetary Nebula / Nébuleuse Planétaire", "Reflection Nebula / Nébuleuse à réflexion"]

// Running the transaction
const other = db.transaction((rows) => {
    // 1. Prepare lookup statements once inside the transaction for speed
    const getConstellationId = db.prepare("SELECT id FROM constellations WHERE abbreviation = ?");
    const getDiscovererId = db.prepare("SELECT id FROM discoverers WHERE name = ?");

    for (const row of rows) {
        if (!list_of_objects.includes(row["Object type / Type d'objet"])) {
            const messierValue = row['Messier'];
            const ngcValue = row['NGC'];
            const objectTypeValue = row["Object type / Type d'objet"];
            const seasonValue = row['Season / Saison'];
            const magnitudeValue = row['Magnitude'];
            const raValue = row['RA (Right Ascension)'];
            const decValue = row['Dec (Declinaison)'];
            const distanceValue = row['Distance (l.y / a. l.)'];
            const sizeValue = row['Size / Dimensions'];
            const image_urlValue = row['Image'];

            // 2. Extract string keys from the Excel row
            const constellationAbbrev = row['Constellation'];
            const discovererName = row['Discoverer / Découvreur']; 

            // 3. Query parent tables to find the matching rows
            const constellationRow = getConstellationId.get(constellationAbbrev);
            const discovererRow = getDiscovererId.get(discovererName);

            // 4. Strict Validation: Crash the transaction if a relationship is missing
            if (!constellationRow) {
                throw new Error(`Foreign Key Error: Constellation '${constellationAbbrev}' not found in database.`);
            }
            if (!discovererRow) {
                throw new Error(`Foreign Key Error: Discoverer '${discovererName}' not found in database.`);
            }

            // 5. Extract the numeric IDs for insertion
            const constellation_idValue = constellationRow.id;
            const discoverer_idValue = discovererRow.id;

            // 6. Run the insert statement inside the loop block
            insertOther.run(
                messierValue ?? null,
                ngcValue ?? null,
                objectTypeValue ?? null,
                seasonValue ?? null,
                constellation_idValue, // Numeric ID reference
                discoverer_idValue,    // Numeric ID reference
                magnitudeValue ?? null,
                raValue ?? null,
                decValue ?? null,
                distanceValue ?? null,
                sizeValue ?? null,
                image_urlValue ?? null
            );
        }
    }
});

try {
    discoverer(sheetData);
    constellations(sheetData);
    galaxies(sheetData);
    globular_clusters(sheetData);
    emission_nebula(sheetData);
    open_cluster(sheetData);
    planetary_nebula(sheetData);
    reflection_nebula(sheetData);
    other(sheetData);
    console.log("Column data successfully imported!");
} catch (error) {
    console.error("Import Failed: ", error);
}
