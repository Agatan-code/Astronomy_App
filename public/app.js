// This is v_0_0_4
alert("Hello World!");
// ============================ Twinkle Star Background ============================
(function makeSky() {
    const sky = document.createElement('div');
    sky.id = 'sky';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colors = ['#ffffff', '#ffffff', '#cfe3ff', '#a9d4ff', '#ffe8d1'];
    const count = Math.min(300, Math.round(innerWidth * innerHeight / 5500)); 

    const SPEED = 3; // 2 = twice as fast, 0.5 half speed
    
    for (let i = 0; i < count; i++) {
        const star = document.createElement('span');
        star.className = 'star';

        const bright = Math.random() < 0.15;
        const size = bright ? 3.5 + Math.random() * 2 : 1.5 + Math.random() * 1.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const glow = bright ? 14 : 5;
        const lo = Math.random() * 0.06;

        star.style.cssText = `
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        box-shadow: 0 0 ${glow}px ${color};
        opacity: ${lo};
        `;

        // Normal: fast fade plus size pulse.
        // Reduced motion: slow, gentle fade only (no scaling).
        const half = reduceMotion ? (4000 + Math.random() * 5000) / SPEED
                                  : (800 + Math.random() * 2200) / SPEED;
        const frames = reduceMotion
          ? [{ opacity: 0.1 }, { opacity: 0.9 }]
          : [{ opacity: lo, transform: 'scale(0.5)' },
             { opacity: 1,  transform: 'scale(1.5)' }];

        star.animate(frames, {
          duration: half,
          delay: -Math.random() * half * 2,
          iterations: Infinity,
          direction: 'alternate',
          easing: 'ease-in-out'
        });

        sky.appendChild(star);
    }

    document.body.prepend(sky);
    console.log('Sky v_0_0_7:', count, 'stars | reduceMotion =', reduceMotion,
                  '| running animations =', document.getAnimations().length);
})();


// ============================ MENU BUTTONS ============================
const menu_buttons = document.getElementById("menu_buttons");

// Handle actual clicks
menu_buttons.addEventListener("click", (e) => {
    const button = e.target.closest(".main-buttons");
    if (!button) return;

    selectMenu(button);
});

function selectMenu(button) {
    if (!button) return;

    document.querySelectorAll(".main-buttons").forEach((btn) => {
        btn.classList.remove("active");

        const menu_type = btn.dataset.type;
        document.getElementById(menu_type).setAttribute("hidden", "true");
    });

    button.classList.add("active");

    const menu_type = button.dataset.type;
    document.getElementById(menu_type).removeAttribute("hidden");
}



// =========================== IMPORT =============================
const user_input = document.getElementById("photoInput");
const annotatedImageLink = document.getElementById("annotatedImageLink");
const explore_button = document.getElementById("explore_button");
const notification_explore = document.getElementById("notification_explore");
const notification_finished = document.getElementById("notification_finished");
const close_explore = document.getElementById("close_explore");
const close_finished = document.getElementById("close_finished");

function triggerNotificationExplore() {
    notification_explore.classList.add("show");
}

function triggerNotificationFinished() {
    notification_finished.classList.add("show");
}

close_explore.addEventListener("click", () => {
    notification_explore.classList.remove("show");
});

close_finished.addEventListener("click", () => {
    notification_finished.classList.remove("show");
});

user_input_button.addEventListener("click", async (e) => {
    const input = user_input.files[0];

    if (!input) return;

    console.log("User input file:", input);

    // Switch to the Explore menu after the user submits an image
    selectMenu(explore_button);
    
    // Pop up a notification to inform the user that they can explore while waiting for the submission
    triggerNotificationExplore();


    async function InputToServer() {
        const formData = new FormData();
        formData.append("image", input);
        const response = await fetch("/api/objectInfo", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        
        if (!response.ok) { 
            throw new Error(data.error || "Plate solving failed");
        }

        annotatedImageLink.src = data.annotatedImage;
        annotatedImageLink.hidden = false;
        console.log(data);
    }

    try {
        await InputToServer();
        // Pop up a notification to inform the user that they can view the annotated image after the server has finished processing
        triggerNotificationFinished();
    } catch (err) {
        console.error("Error during plate solving:", err);
        notification_explore.classList.remove("show");
        alert(err.message);
    }
});
// ==================================================================




// =========================== Explore =============================
let currentOption = "milky_way";

const option_buttons = document.getElementById("options");
const explore_option_display = document.getElementById("explore_option_display");
const explore_option_list = [
    "milky_way",
    "solar_system",
    "asteroids",
    "mars",
    "earth",
    "dsn"
];
const explore_option_display_list = [
    "https://eyes.nasa.gov/apps/exo/",
    "https://eyes.nasa.gov/apps/solar-system/#/home",
    "https://eyes.nasa.gov/apps/asteroids/#/home",
    "https://eyes.nasa.gov/apps/mrn/#/mars",
    "https://eyes.nasa.gov/apps/earth/#/",
    "https://eyes.nasa.gov/apps/dsn-now/dsn.html"
];


option_buttons.addEventListener("click", async (e) => {
    // Use event delegation to handle clicks on any of the filter buttons
    const button = e.target.closest(".chip");
    // If the click wasn't on a button, do nothing
    if (!button) return;

    // Remove the "active" class from all buttons, then add it to the clicked button
    option_buttons.querySelectorAll(".chip").forEach((chip) => {
        // Remove the "active" class from each chip
        chip.classList.remove("active");
    });

    // Add the "active" class to the clicked button
    button.classList.add("active");

    // Update the current type
    currentOption = button.dataset.type;
    // After changing the currentOption, show the selected option
    showOption();
});

function showOption() {
    for (let i = 0; i < explore_option_list.length; i++) {
        if (currentOption === explore_option_list[i]) {
            explore_option_display.src = explore_option_display_list[i];
        }
    }
}
// =================================================================




// ============================ DISPLAY ============================
const cardGrid = document.getElementById("cardGrid");
const searchForm = document.getElementById("showObject");

const filter_options = document.getElementById("filters");  

// In memory copy of the whole catalog.
let masterObjects = [];
let temporaryObjects = [];

// Track current selections
let currentType = "all";
let currentQuery = "";

// 1. On page load, fetch everything and render cards
async function loadAllObjects() {
    const response = await fetch("/api/objects");
    masterObjects = await response.json();
    // Initially, temporaryObjects is the same as masterObjects.
    temporaryObjects = masterObjects;
    renderCards(masterObjects);
}


filter_options.addEventListener("click", async (e) => {
    // Use event delegation to handle clicks on any of the filter buttons
    const button = e.target.closest(".chip");
    // If the click wasn't on a button, do nothing
    if (!button) return;

    // Remove the "active" class from all buttons, then add it to the clicked button
    filter_options.querySelectorAll(".chip").forEach((chip) => {
        // Remove the "active" class from each chip
        chip.classList.remove("active");
    });

    // Add the "active" class to the clicked button
    button.classList.add("active");

    // Update the current type
    currentType = button.dataset.type;
    // After changing the currentType, apply filters and search to update the displayed cards
    applyFiltersAndSearch();
});

// 2. Turn an array of objects into card HTML and inject into #cardGrid
function renderCards(objects) {
    /*
    .map() is a build-in array method that goes through every item in objects one at a time, 
    runs the function you give it on each one, and collects all the results into a brand new array.
    */
    cardGrid.innerHTML = objects.map(obj => `
        <div class="card" data-id="${obj.id}" data-type="${obj.object_type}">
            <img src="${obj.image_url}">
            <div class="card-body">
                <p>${obj.messier}${obj.ngc ? " · " + obj.ngc : ""}</p>
                <p>${obj.object_type} · mag ${obj.magnitude}</p>
            </div>
        </div>
    `).join("");
}

// 3. Search -- filters the in-memory array, no server round-trip
searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    // Get the search query from the input field, trim whitespace, and convert to lowercase
    currentQuery = searchForm.show_nameOfObject.value.trim().toLowerCase();
    // Apply the filters and search to update the displayed cards
    applyFiltersAndSearch();
});

// Apply filters and search to the in-memory array of objects, then render the results
function applyFiltersAndSearch() {
    // Start with the full catalog in memory
    let results = masterObjects;

    if (currentType === "other") {
        // If the type is "other", we want to exclude all named types from the results
        const namedTypes = ["galaxy", "globular_cluster", "emission_nebula", "open_cluster", "planetary_nebula", "reflection_nebula"];
        // Filter the results to only include objects whose object_type is not in the namedTypes array
        results = results.filter(obj => !namedTypes.includes(obj.object_type));
    }

    // Apply type filter first, unless "all" is selected
    else if (currentType !== "all") {
        // Filter the results to only include objects of the selected type
        results = results.filter(obj => obj.object_type === currentType);
    }

    // Then apply the search query filter, if a query is present
    if (currentQuery !== "") {
        // Filter the results to only include objects whose messier or ngc properties match the search query
        results = results.filter(obj =>
            // Use optional chaining (?.) to safely access messier and ngc properties, and convert them to lowercase for case-insensitive comparison
            obj.messier?.toLowerCase().includes(currentQuery) ||
            obj.ngc?.toLowerCase().includes(currentQuery)
        );
    }

    // Update the in-memory copy of temporaryObjects to only include the filtered results
    temporaryObjects = results;
    // Pass the filtered results into renderCards to update the page
    renderCards(results);
}

// 4. Event delegation -- one listener on cardGrid handles clicks on any card
cardGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;

    const id = card.dataset.id;
    const type = card.dataset.type;
    const obj = temporaryObjects.find(o => String(o.id) === id && o.object_type === type);
    if (!obj) return;

    document.getElementById("modalContent").innerHTML = `
        <h3>${obj.messier}${obj.ngc ? " · " + obj.ngc : ""}</h3>
        <p><strong>Type:</strong> ${obj.object_type}</p>
        <p><strong>Magnitude:</strong> ${obj.magnitude}</p>
        <p><strong>RA / Dec:</strong> ${obj.ra} / ${obj.dec}</p>
        <p><strong>Distance:</strong> ${obj.distance}</p>
        <p><strong>Size:</strong> ${obj.size}</p>
        <button class="close-btn" id="closeModal">Close</button>
    `;

    document.getElementById("detailModal").hidden = false;
    document.getElementById("closeModal").addEventListener("click", () => {
        document.getElementById("detailModal").hidden = true;
    });
});

loadAllObjects();
// ===================================================================