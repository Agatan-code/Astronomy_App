
// Backend Knowledge
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const sharp = require("sharp");

// Initializing the database
const Database = require('better-sqlite3');
const db = new Database('./astronomydb.db');

// Create server applications
const app = express();
const PORT = 3000;

const upload = multer({
    // Uploaded files are kept in RAM as a Buffer, so it could be sent to Astrometry
    storage: multer.memoryStorage(),
    // Caps upload at 40 MB (1024 bytes * 1024 bytes = 1 MB, times 40)
    limits: { fileSize: 40 * 1024 * 1024 }
});

// ========== API_Key support variable =========
const { loadEnvFile } = require('node:process');
const { parse } = require("node:path");
loadEnvFile('./.env');

// Test to see if the API key is loaded correctly | Additionally extracting session key
const astrometry_api_key = process.env.ASTROMETRY_API_KEY;

const ASTROMETRY_HEADERS = {
    "Referer": "https://nova.astrometry.net/api/login"
};

// Logging into astrometry and retrieving the session key.
async function getData() {
    const response = await fetch('https://nova.astrometry.net/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': "application/x-www-form-urlencoded",
            ...ASTROMETRY_HEADERS
        },
        body: new URLSearchParams({
            'request-json': JSON.stringify({ apikey: astrometry_api_key })
        })
    });

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
        throw new Error(data.errormessage || "Astrometry login failed");
    }

    return data.session;
}

async function parseJsonResponse(response, label) {
    const rawText = await response.text();
    console.log(`[${label}] raw response:`,
        rawText.slice(0, 200));
    try {
        return JSON.parse(rawText);
    } catch {
        throw new Error(
            `Astrometry ${label} returned non-JSON (${response.status} ${response.statusText}): ${rawText.slice(0, 200)}`
        );
    }
}

// ----------- Function to insure the program doesn't crash due to a disconnect from the API --------------------
async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 1000) {
    const mergedOptions = {
        ...options,
        headers: { ...ASTROMETRY_HEADERS, ...(options.headers || {}) }
    };
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fetch(url, mergedOptions);
        } catch (err) {
            console.warn(`Fetch attempt ${attempt} failed for ${url}: ${err.message}`);
            if (attempt === retries) throw err;
            await wait(delayMs);
        }
    }
}

async function reencodeForRetry(buffer, variant) {
    return sharp(buffer)
        .jpeg({ quality: 95 })
        .withMetadata({ density: 72 + variant })
        .toBuffer();
}

// Uploading images to Astrometry
async function submitFile(file, sessionKey, overrides = {}) {
    const request = {
        session: sessionKey,
        publicly_visible: "n",
        allow_modifications: "d",
        allow_commercial_use: "d",
        ...overrides
    };

    const formData = new FormData(); // native — no import needed, global in Node 18+
    formData.append("request-json", JSON.stringify(request));
    formData.append(
        "file",
        new Blob([file.buffer], { type: "application/octet-stream" }),
        file.originalname
    );

    // Do NOT set Content-Type or Content-Length manually — fetch computes
    // the correct multipart boundary and length for you when body is a
    // native FormData object. Setting them yourself is what risks mismatches.
    const response = await fetch("https://nova.astrometry.net/api/upload", {
        method: "POST",
        body: formData,
        headers: { ...ASTROMETRY_HEADERS }
    });

    const responseText = await response.text();

    let data;
    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(`Astrometry server returned HTML/Invalid data instead of JSON (${response.status}). Details: ${responseText.slice(0, 150)}`);
    }

    if (!response.ok || data.status !== "success") {
        throw new Error(data.errormessage || `Astrometry upload failed (${response.status})`);
    }
    return data.subid;
}

// Try a few strategies in order; return the first one that actually solves.
async function solveWithRetries(file, sessionKey) {
    const attempts = [
        {},                                              // 1. plain blind solve
        { downsample_factor: 2 },                        // 2. bin 2x - helps noisy/large images
        { downsample_factor: 4, use_sextractor: true },  // 3. bin 4x + alternate star detector
    ];

    let lastErr;
        for (const [i, overrides] of attempts.entries()) {
            const variantBuffer = await reencodeForRetry(file.buffer, i);
            const variantFile = { ...file, buffer: variantBuffer };

            try {
                console.log(`Solve attempt ${i + 1}:`, overrides);

                const subid = await submitFile(variantFile, sessionKey, {
                    // "try both simultaneously"
                    parity: 2,
                    // "width of the field(in degrees)"
                    scale_units: "degwidth",
                    scale_type: "ul",
                    scale_lower: 0.1,
                    scale_upper: 180.0,
                    ...overrides
                });

                const jobId = await getSolvedJob(subid);
                return await getJobResults(jobId);
            } catch (err) {
                console.warn(`Attempt ${i + 1} failed: ${err.message}`);
                lastErr = err;
            }
        }
        throw lastErr;
}

const wait = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
});

// Polling until the image is resolved
async function getSolvedJob(submissionId) {
    for (let attempt = 0; attempt < 90; attempt++) {   // ~3 minutes
        const response = await fetchWithRetry(
            `https://nova.astrometry.net/api/submissions/${submissionId}`
        );
        const submission = await parseJsonResponse(response, "submission status");

        // jobs is [] or [null] until the job is actually created
        const jobId = submission.jobs?.find(j => j !== null && j !== undefined);

        if (jobId) {
            const jobRes = await fetchWithRetry(`https://nova.astrometry.net/api/jobs/${jobId}`);
            const job = await parseJsonResponse(jobRes, "job status");

            if (job.status === "success") return jobId;
            if (job.status === "failure") {
                throw new Error("Astrometry could not solve this image (job failed)");
            }
            // otherwise "solving": keep waiting
        }

        await wait(2000);
    }
    throw new Error("Astrometry is still processing after 3 minutes");
}



async function getJobResults(jobId) {
    const endpoints = {
        info: `jobs/${jobId}/info/`,
        calibration: `jobs/${jobId}/calibration/`,
        tags: `jobs/${jobId}/machine_tags/`,
        objectsInField: `jobs/${jobId}/objects_in_field/`,
        annotations: `jobs/${jobId}/annotations/`
    };

    const results = {};
    for (const [name, endpoint] of Object.entries(endpoints)) {
        const response = await fetchWithRetry(`https://nova.astrometry.net/api/${endpoint}`);
        if (!response.ok) {
            throw new Error(`Could not fetch Astrometry ${name}`);
        }

        results[name] = await parseJsonResponse(response, name);
    }

    return results;
}
// ==============================================

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

// This is commented out because the filtering is now done on the client side, but it could be re-enabled if needed for server-side filtering.
/*
app.get("/api/objects/:type", (req, res) => {
    try {
        const { type } = req.params;
        
        if (type === "other") {
            // If the type is "other", we need to query the "other" table directly.
            const stmt = db.prepare(`SELECT * FROM other`);
            const results = stmt.all();
            res.status(200).json(results);
            return;
        }
        // For other types, we can use the ALL_OBJECTS_QUERY to filter by object_type.
        const stmt = db.prepare(`SELECT * FROM (${ALL_OBJECTS_QUERY}) WHERE object_type = ?`);
        const results = stmt.all(type);
        res.status(200).json(results);    
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });    
    }
});
*/

// Search by name — powers the search form
app.get("/api/object/:nameOfObject", (req, res) => {
    const { nameOfObject } = req.params;
    const stmt = db.prepare(`SELECT * FROM (${ALL_OBJECTS_QUERY}) WHERE messier = ? OR ngc = ?`);
    const results = stmt.all(nameOfObject, nameOfObject);
    res.status(200).json(results);
});


// Receive the browser's field named "image", then forward it as Astrometry's "file" field.
app.post("/api/objectInfo", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Did not receive an image file" });
    }

    // Debug: write out exactly what multer captured
    fs.writeFileSync("./debug_upload_" + req.file.originalname, req.file.buffer);
    console.log("Buffer size:", req.file.buffer.length, "bytes");

    try {
        const sessionKey = await getData();
        const results = await solveWithRetries(req.file, sessionKey);
        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(502).json({ error: err.message });
    }


});

