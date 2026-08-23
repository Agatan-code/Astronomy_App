// Backend Knowledge
const express = require("express");
const path = require("path");
const multer = require("multer");
const FormData = require('form-data');

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

// Logging into astrometry and retrieving the session key.
async function getData() {
    const response = await fetch('http://nova.astrometry.net/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': "application/x-www-form-urlencoded"
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

// Uploading images to Astrometry
async function submitFile(file, sessionKey) {
    // FormData is the object type used to build a multipart/form-data request
    const formData = new FormData();
    // request holds the metadata Astrometry wants alongside the file:
    // session key token, flags to say that don't make this public, etc...
    const request = {
        session: sessionKey,
        publicly_visible: "n",
        allow_modifications: "d",
        allow_commercial_use: "d"
    };

    // Astrometry expects request-json to be the first multipart part.
    formData.append(
        "request-json",
        JSON.stringify(request)
    );
    // formData gets the actual image attached to it.
    /*
    formData.append(
        "file",
        new Blob([file.buffer], { type: "application/octet-stream" }),
        // This preserves the original name of the file, which is useful for Astrometry to identify it.
        file.originalname
    );
    */
    formData.append(
        'file',
        file.buffer,
        { filename: file.originalname, contentType: 'application/octet-stream' }
    )

    const bodyBuffer = formData.getBuffer();

    const response = await fetch("http://nova.astrometry.net/api/upload", {
        method: "POST",
        body: bodyBuffer,
        headers: {
            ...
            formData.getHeaders(),
            "Content-Length": bodyBuffer.length
        }
    });
    const responseText = await response.text();
    let data;

    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(
            `Astrometry returned ${response.status} ${response.statusText}: ${responseText.slice(0, 200)}`
        );
    }

    console.log(data);

    if (!response.ok || data.status !== "success") {
        throw new Error(data.errormessage || "Astrometry upload failed");
    }

    return data.subid;
}

const wait = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
});

// Polling until the image is resolved
async function getSolvedJob(submissionId) {
    // This loops up to 30 times, each time asking Astrometry: "What's the status of the submission?"
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const response = await fetch(
            `http://nova.astrometry.net/api/submissions/${submissionId}`
        );
        const submission = await parseJsonResponse(response, "submission status");

        if (!response.ok) {
            throw new Error("Could not read Astrometry submission status");
        }

        if (submission.jobs?.length) {
            const jobId = submission.jobs[0];

            for (let jobAttempt = 0; jobAttempt < 30; jobAttempt += 1) {
                const jobResponse = await fetch(
                    `http://nova.astrometry.net/api/jobs/${jobId}`
                );
                const job = await parseJsonResponse(jobResponse, "job status");

                if (!jobResponse.ok) {
                    throw new Error("Could not read Astrometry job status");
                }
                if (job.status === "success") {
                    return jobId;
                }
                if (["failure", "error"].includes(job.status)) {
                    throw new Error("Astrometry could not solve the image");
                }

                await wait(2000);
            }

            throw new Error("Astrometry job did not finish after one minute");
        }

        await wait(2000);
    }

    throw new Error("Astrometry is still processing after one minute");
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
        const response = await fetch(`http://nova.astrometry.net/api/${endpoint}`);
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

    try {
        const sessionKey = await getData();
        const submissionId = await submitFile(req.file, sessionKey);
        const jobId = await getSolvedJob(submissionId);
        const results = await getJobResults(jobId);

        res.status(200).json({ submissionId, jobId, ...results });
    } catch (err) {
        console.error(err);
        res.status(502).json({ error: err.message });
    }
});

