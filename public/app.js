// This is v_0_0_3

// ============================ MENU BUTTONS ============================
const menu_buttons = document.getElementById("menu_buttons");

menu_buttons.addEventListener("click", async (e) => {
    const button = e.target.closest(".main-buttons");
    if (!button) return;

    document.querySelectorAll(".main-buttons").forEach((button) => {
        button.classList.remove("active");

        const menu_type = button.dataset.type;
        document.getElementById(menu_type).setAttribute("hidden", "true");
    });

    button.classList.add("active");

    const menu_type = button.dataset.type;
    document.getElementById(menu_type).removeAttribute("hidden");
});


// =========================== IMPORT =============================




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
    document.querySelectorAll(".chip").forEach((chip) => {
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