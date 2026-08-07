/*// ========================== Search ==========================
let printObject = document.querySelector("#showObject");

const postObject = document.getElementById('printObject');

printObject.addEventListener("submit", async (e) => {
    e.preventDefault();

    let nameOfObject = printObject.show_nameOfObject.value;

    postObject.innerHTML = '';

    console.log("[PROCESS] Communicating with server");
    
    fetch(`/api/object/${nameOfObject}`)
        .then(response => {
            if (!response.ok) {
                throw new Error("[ERROR] Problem with the network.");
            }
            console.log("[COMPLETE] Data Received")
//                console.log(response);
//                console.log(response.json());
            return response.json();
        })
        .then(object => {
            postObject.innerHTML = '';
            console.log(object);

            var posts = [];
            if (Array.isArray(object)) {
                posts = object;
            }
            else {
                posts = [object];
            }

            posts.forEach(post => {
                const postHtml = `
                    <li class="gradient-text">
                        <strong>${post.id}</strong>
                        <strong>${post.messier}</strong>
                        <strong>${post.ngc}</strong>
                        <strong>${post.season}</strong>
                        <strong>${post.constellation_id}</strong>
                        <strong>${post.discoverer_id}</strong>
                        <strong>${post.magnitude}</strong>
                        <strong>${post.ra}</strong>
                        <strong>${post.dec}</strong>
                        <strong>${post.distance}</strong>
                        <strong>${post.size}</strong>
                        <strong>${post.image_url}</strong>
                    </li>
                `;

                postObject.insertAdjacentHTML('beforeend', postHtml);
            });
        })
        .catch(error => {
            console.error("[ERROR] There was a problem with the fetch: ", error);
        });

});
*/

// ============================ CARD GRID ============================
const cardGrid = document.getElementById("cardGrid");
const searchForm = document.getElementById("showObject");

const filter_options = document.getElementById("filters");  

// In memory copy of the whole catalog.
let allObjects = [];

// 1. On page load, fetch everything and render cards
async function loadAllObjects() {
    const response = await fetch("/api/objects");
    allObjects = await response.json();
    renderCards(allObjects);
}

filter_options.addEventListener("click", async (e) => {
    // The program looks for the closest ancestor of the clicked element that has the class "chip".
    const button = e.target.closest(".chip");
    // If nothing is found, the code stops executing and returns early. This prevents errors from trying to access properties of undefined.
    if (!button) return;

    // This selects all elements with the class chip.
    // forEach runs the same code for each one.
    document.querySelectorAll(".chip").forEach((chip) => {
        // This removes the active class from every chip button.
        // That makes sure only one button is highlighted at a time.
        chip.classList.remove("active");
    });
    // Adds the active class to the button that was clicked.
    // This visually marks it as the selected filter.
    button.classList.add("active");

    // Reads the value stored in the button’s data-type attribute.
    const selectedType = button.dataset.type;

    let url;

    // Starts building the API URL based on which filter button was clicked.
    if (selectedType === "all") {
        // If selectedType is "all", the URL becomes /api/objects.
        url = "/api/objects";
    }
    else {
        // Otherwise, it builds a URL like /api/objects/galaxies.
        url = `/api/objects/${selectedType}`;
    }

    // Sends a request to the server using the URL.
    // await pauses until the server responds.
    const response = await fetch(url);
    // Converts the server response into a JavaScript object/array.
    // This is the data for the selected category.
    const filteredObjects = await response.json();
    // Passes the filtered data into the renderCards function.
    // That function updates the page to show only the matching cards.
    renderCards(filteredObjects);
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
    const query = searchForm.show_nameOfObject.value.trim().toLowerCase();

    if (query === "") {
        renderCards(allObjects);
        return;
    }

    /*
    .filter() is a built in method that goes through every item in allObjects, 
    runs the function on each, and builds a new array containing only the items where
    the function returned true.
    */
    const matches = allObjects.filter(obj =>
        obj.messier?.toLowerCase().includes(query) ||
        obj.ngc?.toLowerCase().includes(query)
    );

    renderCards(matches);
});

// 4. Event delegation -- one listener on cardGrid handles clicks on any card
cardGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;

    const id = card.dataset.id;
    const obj = allObjects.find(o => String(o.id) === id);
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