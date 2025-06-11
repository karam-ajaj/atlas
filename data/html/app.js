const apiBase = "/api"; // Works through Nginx reverse proxy

async function fetchHostData() {
    try {
        const response = await fetch(`${apiBase}/hosts`);
        const rawData = await response.json();

        const [regularHosts = [], dockerHosts = []] = rawData;

        renderTable(regularHosts, "regular-hosts-table");
        renderTable(dockerHosts, "docker-hosts-table");

        return [...regularHosts, ...dockerHosts];
    } catch (error) {
        console.error("Error fetching host data:", error);
        return [];
    }
}

function renderTable(data, tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = ""; // Clear existing rows

    data.forEach(host => {
        const [id, ip, name, os, mac, ports] = host;

        const row = document.createElement("tr");
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

async function drawDiagram() {
    const data = await fetchHostData();

    const width = 800, height = 600;
    const svg = d3.select("#diagram")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const simulation = d3.forceSimulation(data)
        .force("link", d3.forceLink().id(d => d.id))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2));

    svg.append("g").attr("class", "links").selectAll("line")
        .data([]) // Placeholder
        .enter().append("line")
        .attr("stroke-width", 2)
        .attr("stroke", "#999");

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

    const labels = svg.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(data)
        .enter().append("text")
        .text(d => `${d.name} (${d.ip})`)
        .attr("x", 12)
        .attr("y", 3);

    simulation.nodes(data).on("tick", () => {
        node.attr("cx", d => d.x).attr("cy", d => d.y);
        labels.attr("x", d => d.x + 12).attr("y", d => d.y + 3);
    });

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
