// ============================================================
// The Astronomy App - server
// ============================================================
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Database = require("better-sqlite3");
const envPath = path.join(__dirname, ".env");

if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

// ============================================================
// Config
// ============================================================
const PORT = process.env.PORT || 3000;
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024; // 40 MB

const ASTROMETRY_API = "https://nova.astrometry.net";
// Any of these that are set in .env get used. Add more by extending the list.
const ASTROMETRY_API_KEYS = [
    process.env.ASTROMETRY_API_KEY_1,
    process.env.ASTROMETRY_API_KEY_2,
    process.env.ASTROMETRY_API_KEY_3,
    process.env.ASTROMETRY_API_KEY_4,
].filter(Boolean);   // drops any that are missing or empty
const POLL_INTERVAL_MS = 2000;
const MAX_SOLVE_WAIT_MS = 60 * 60 * 1000; // give up on a single job after 10 minutes

// Set SAVE_DEBUG_UPLOADS=true in .env to keep a copy of every uploaded image on disk.
const SAVE_DEBUG_UPLOADS = process.env.SAVE_DEBUG_UPLOADS === "true";

// Returns a random key each time it's called.
function getRandomApiKey() {
    return ASTROMETRY_API_KEYS[Math.floor(Math.random() * ASTROMETRY_API_KEYS.length)];
}

// Checking for missing keys here rather than later avoids a long wait for Astrometry to time out.
if (ASTROMETRY_API_KEYS.length === 0) {
    console.error("Missing ASTROMETRY_API_KEYS in .env");
    process.exit(1);
}
console.log(`Loaded ${ASTROMETRY_API_KEYS.length} Astrometry API key(s)`);

// Strategies tried in order. We only move to the next one if Astrometry
// reports that the solve itself failed (not on network/upload errors).
const SOLVE_STRATEGIES = [
    { label: "plain blind solve", options: {} },
    { label: "downsample x2", options: { downsample_factor: 2 } },
    { label: "downsample x4 + sextractor", options: { downsample_factor: 4, use_sextractor: true } },
];

// ============================================================
// Database
// ============================================================
const db = new Database(path.join(__dirname, "astronomydb.db"));

const COLUMNS = `id, messier, ngc, season, constellation_id, discoverer_id,
                 magnitude, ra, dec, distance, size, image_url`;

// table name for each object type (the "other" table stores its own object_type column)
const TYPED_TABLES = {
    galaxy: "galaxies",
    globular_cluster: "globular_cluster",
    emission_nebula: "emission_nebula",
    open_cluster: "open_cluster",
    planetary_nebula: "planetary_nebula",
    reflection_nebula: "reflection_nebula",
};

const ALL_OBJECTS_QUERY = [
    ...Object.entries(TYPED_TABLES).map(
        ([type, table]) => `SELECT ${COLUMNS}, '${type}' AS object_type FROM ${table}`
    ),
    `SELECT ${COLUMNS}, object_type FROM other`,
].join("\nUNION ALL\n");

// Prepared once at startup (also fails fast if a table is missing)
const allObjectsStmt = db.prepare(ALL_OBJECTS_QUERY);
const searchObjectStmt = db.prepare(
    `SELECT * FROM (${ALL_OBJECTS_QUERY}) WHERE messier = ? OR ngc = ?`
);

// ============================================================
// Astrometry.net client
// ============================================================
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Thrown when Astrometry ran the job but could not find a solution.
class SolveFailedError extends Error {}

// Calls an Astrometry endpoint and returns the parsed JSON.
// Retries network-level failures only; API-level errors are thrown right away.
async function astrometryFetch(endpoint, options = {}, retries = 3) {
    const url = `${ASTROMETRY_API}/${endpoint}`;
    const request = {
        ...options,
        headers: { Referer: `${ASTROMETRY_API}/api/login`, ...options.headers },
    };

    let response;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            response = await fetch(url, request);
            break;
        } catch (err) {
            console.warn(`Network error on ${endpoint} (attempt ${attempt}/${retries}): ${err.message}`);
            if (attempt === retries) throw err;
            await wait(1000 * attempt);
        }
    }

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Astrometry /${endpoint} returned non-JSON (${response.status}): ${text.slice(0, 150)}`);
    }

    if (!response.ok || data.status === "error") {
        throw new Error(data.errormessage || `Astrometry /${endpoint} failed (${response.status})`);
    }
    return data;
}

// Log in with the API key and return a session key.
async function login() {
    const apikey = getRandomApiKey();

    const data = await astrometryFetch("api/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            "request-json": JSON.stringify({ apikey }),
        }),
    });
    if (data.status !== "success") throw new Error("Astrometry login failed");
    return data.session;
}

// Upload an image and return the submission id.
async function submitImage(file, session, options = {}) {
    const request = {
        session,
        publicly_visible: "n",
        allow_modifications: "d",
        allow_commercial_use: "d",
        parity: 2, // 2 = try both
        scale_units: "degwidth", // field width in degrees
        scale_type: "ul", // upper/lower bounds
        scale_lower: 0.1,
        scale_upper: 180,
        ...options,
    };

    // Don't set Content-Type manually: fetch builds the multipart boundary itself.
    const formData = new FormData();
    formData.append("request-json", JSON.stringify(request));
    formData.append(
        "file",
        new Blob([file.buffer], { type: "application/octet-stream" }),
        file.originalname
    );

    const data = await astrometryFetch("api/upload", { method: "POST", body: formData });
    if (data.status !== "success") throw new Error("Astrometry upload failed");
    return data.subid;
}

// Poll until the job for this submission finishes. Returns the job id on success.
// Note: a finished *submission* only means the upload was ingested. The job is
// created afterwards, so "no job yet" is normal and just means keep waiting.
async function waitForJob(submissionId) {
    const deadline = Date.now() + MAX_SOLVE_WAIT_MS;
    let lastStatus;

    while (Date.now() < deadline) {
        const submission = await astrometryFetch(`api/submissions/${submissionId}`);
        const jobId = submission.jobs?.find((id) => id != null);

        if (jobId) {
            const { status } = await astrometryFetch(`api/jobs/${jobId}`);

            if (status !== lastStatus) {
                console.log(`Job ${jobId}: ${status}`);
                lastStatus = status;
            }
            if (status === "success") return jobId;
            if (status === "failure") {
                throw new SolveFailedError("Astrometry could not solve this image");
            }
        }

        await wait(POLL_INTERVAL_MS);
    }

    throw new Error("Astrometry was still processing after 10 minutes");
}

// Fetch everything we want to know about a solved job (in parallel).
async function getJobResults(jobId) {
    const endpoints = {
        info: `api/jobs/${jobId}/info/`,
        calibration: `api/jobs/${jobId}/calibration/`,
        tags: `api/jobs/${jobId}/machine_tags/`,
        objectsInField: `api/jobs/${jobId}/objects_in_field/`,
        annotations: `api/jobs/${jobId}/annotations/`,
    };

    const entries = await Promise.all(
        Object.entries(endpoints).map(async ([name, endpoint]) => [name, await astrometryFetch(endpoint)])
    );
    
    const result = Object.fromEntries(entries);
    result.annotatedImage = `${ASTROMETRY_API}/annotated_display/${jobId}`;
    return result;
}

// Full pipeline: login -> upload -> wait -> results, trying each strategy in turn.
async function solveImage(file) {
    const session = await login();
    let lastError;

    for (const [i, strategy] of SOLVE_STRATEGIES.entries()) {
        console.log(`Solve attempt ${i + 1}/${SOLVE_STRATEGIES.length}: ${strategy.label}`);
        try {
            const submissionId = await submitImage(file, session, strategy.options);
            const jobId = await waitForJob(submissionId);
            return await getJobResults(jobId);
        } catch (err) {
            // Only a genuine solve failure is worth retrying with different settings.
            if (!(err instanceof SolveFailedError)) throw err;
            console.warn(`Attempt ${i + 1} failed: ${err.message}`);
            lastError = err;
        }
    }

    throw lastError;
}

// ============================================================
// Express app
// ============================================================
const app = express();

// Uploaded files are kept in RAM as a Buffer so they can be forwarded to Astrometry.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
});

// Serve the front end (HTML, CSS, JS) from /public
app.use(express.static(path.join(__dirname, "public")));

// ---------------- Catalogue ----------------
// All objects: powers the initial card grid (filtering/search happens client-side)
app.get("/api/objects", (req, res) => {
    try {
        res.json(allObjectsStmt.all());
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Look up a single object by Messier or NGC name
app.get("/api/object/:nameOfObject", (req, res) => {
    try {
        const { nameOfObject } = req.params;
        res.json(searchObjectStmt.all(nameOfObject, nameOfObject));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------- Plate solving ----------------
// Receives the browser's "image" field and forwards it to Astrometry as "file".
app.post("/api/objectInfo", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Did not receive an image file" });
    }

    console.log(`Received ${req.file.originalname} (${req.file.buffer.length} bytes)`);

    if (SAVE_DEBUG_UPLOADS) {
        const debugName = "debug_upload_" + path.basename(req.file.originalname);
        fs.writeFileSync(path.join(__dirname, debugName), req.file.buffer);
    }

    try {
        const results = await solveImage(req.file);
        res.json(results);
    } catch (err) {
        console.error(err);
        // 422: the image was fine to upload but couldn't be solved. 502: Astrometry/network problem.
        const status = err instanceof SolveFailedError ? 422 : 502;
        res.status(status).json({ error: err.message });
    }
});

// Friendly errors for upload problems (e.g. file too large)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: err.message });
    }
    next(err);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});