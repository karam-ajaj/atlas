// // Define the API endpoint to fetch data
// const API_URL = "http://localhost:8889/hosts";

// // Fetch host data from the FastAPI backend
// async function fetchHostData() {
//     try {
//         const response = await fetch(API_URL);
//         const data = await response.json();
//         return data.map(host => ({
//             id: host[0],
//             ip: host[1],
//             name: host[2] || "Unknown",
//             os: host[3] || "Unknown",
//             mac: host[4] || "Unknown",
//             ports: host[5] || "Unknown",
//         }));
//     } catch (error) {
//         console.error("Error fetching host data:", error);
//         return [];
//     }
// }

const apiBase = window.location.hostname.includes('vnerd.nl')
  ? 'https://atlas-api.vnerd.nl'
  : 'http://192.168.2.81:8889';

fetch(`${apiBase}/hosts`)


// const API_URL = "http://localhost:8889/hosts";

async function fetchHostData() {
    try {
        const response = await fetch(API_URL);
        const rawData = await response.json();

        // Assume first list is normal hosts, second is docker hosts
        const [regularHosts = [], dockerHosts = []] = rawData;

        renderTable(regularHosts, "regular-hosts-table");
        renderTable(dockerHosts, "docker-hosts-table");
    } catch (error) {
        console.error("Error fetching host data:", error);
    }
}

function renderTable(data, tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = ""; // Clear existing rows

    data.forEach(host => {
        const row = document.createElement("tr");

        const [id, ip, name, os, mac, ports] = host;

        row.innerHTML = `
            <td>${id}</td>
            <td>${ip}</td>
            <td>${name || "Unknown"}</td>
            <td>${os || "Unknown"}</td>
            <td>${mac || "Unknown"}</td>
            <td>${ports || "Unknown"}</td>
        `;

        tbody.appendChild(row);
    });
}

// Call it on load
fetchHostData();



// Draw the network diagram
async function drawDiagram() {
    const data = await fetchHostData();

    // Create an SVG canvas
    const width = 800, height = 600;
    const svg = d3.select("#diagram")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Create force simulation
    const simulation = d3.forceSimulation(data)
        .force("link", d3.forceLink().id(d => d.id))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2));

    // Add links (empty for now)
    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data([])
        .enter().append("line")
        .attr("stroke-width", 2)
        .attr("stroke", "#999");

    // Add nodes
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("r", 10)
        .attr("fill", "blue")
        .call(d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded));

    // Add labels
    const labels = svg.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(data)
        .enter().append("text")
        .text(d => `${d.name} (${d.ip})`)
        .attr("x", 12)
        .attr("y", 3);

    // Update simulation
    simulation
        .nodes(data)
        .on("tick", () => {
            node.attr("cx", d => d.x).attr("cy", d => d.y);
            labels.attr("x", d => d.x + 12).attr("y", d => d.y + 3);
        });

    // Drag functions
    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

// Run the diagram drawing function
drawDiagram();

