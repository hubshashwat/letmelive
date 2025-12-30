document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const searchInput = document.getElementById('searchInput');
    const resultsGrid = document.getElementById('resultsGrid');

    // Stats Elements
    const stats = {
        total: document.getElementById('totalProducts'),
        safe: document.getElementById('safeProducts'),
        notHealthy: document.getElementById('notHealthyProducts'),
        unsafe: document.getElementById('unsafeProducts'),
        pending: document.getElementById('pendingProducts')
    };

    // State
    let allProducts = [];
    let activeFilter = 'all';

    // 1. Fetch and Normalize Data
    async function loadData() {
        try {
            // Fetch all 3 JSONs in parallel
            const [trustifiedRes, unboxRes, openRes] = await Promise.all([
                fetch('trustified_data.json'),
                fetch('unbox_data.json'),
                fetch('open_data.json')
            ]);

            const trustifiedData = await trustifiedRes.json();
            const unboxData = await unboxRes.json();
            const openData = await openRes.json();

            // Normalize Trustified
            const trustifiedNormalized = normalizeTrustified(trustifiedData);

            // Normalize Unbox
            const unboxNormalized = normalizeUnbox(unboxData);

            // Normalize Open Data
            const openNormalized = normalizeOpenData(openData);

            // Combine
            allProducts = [...trustifiedNormalized, ...unboxNormalized, ...openNormalized];

            // Initial Render
            updateStats();
            renderProducts(allProducts);

        } catch (error) {
            console.error("Data load failed:", error);
            resultsGrid.innerHTML = `<div class="loading-state" style="color:var(--neon-red)">Failed to load database. Check console.</div>`;
        }
    }

    // Normalization Logic: Trustified
    function normalizeTrustified(data) {
        let products = [];

        for (const [category, lists] of Object.entries(data)) {

            // PASS List (Array of {name, link})
            if (lists.pass) {
                lists.pass.forEach(p => {
                    products.push({
                        name: p.name,
                        source: 'Trustified',
                        category: category,
                        status: 'pass',
                        link: p.link || 'https://www.trustified.in/passandfail'
                    });
                });
            }

            // FAIL List (Array of {name, link})
            if (lists.fail) {
                lists.fail.forEach(p => {
                    products.push({
                        name: p.name,
                        source: 'Trustified',
                        category: category,
                        status: 'fail',
                        link: p.link
                    });
                });
            }

            // EXPIRED (Array of {name, link})
            if (lists.expired) {
                lists.expired.forEach(p => {
                    products.push({
                        name: p.name,
                        source: 'Trustified',
                        category: category,
                        status: 'pending',
                        link: p.link || 'https://www.trustified.in/passandfail'
                    });
                });
            }
        }
        return products;
    }

    // Normalization Logic: UnboxHealth
    function normalizeUnbox(data) {
        let products = [];

        for (const [category, lists] of Object.entries(data)) {
            const cleanCategory = category.replace(/_/g, ' ').replace('supplements', '').trim();

            // PASS (Array of {name, link})
            if (lists.pass) {
                lists.pass.forEach(p => {
                    products.push({
                        name: p.name,
                        source: 'UnboxHealth',
                        category: cleanCategory,
                        status: 'pass',
                        link: p.link
                    });
                });
            }

            // NOT HEALTHY (Array of {name, link}) - New Category
            if (lists.not_healthy) {
                lists.not_healthy.forEach(p => {
                    products.push({
                        name: p.name,
                        source: 'UnboxHealth',
                        category: cleanCategory,
                        status: 'not_healthy',
                        link: p.link
                    });
                });
            }

            // FAIL (if any)
            if (lists.fail) {
                lists.fail.forEach(p => {
                    products.push({
                        name: p.name,
                        source: 'UnboxHealth',
                        category: cleanCategory,
                        status: 'fail',
                        link: p.link
                    });
                });
            }
        }
        return products;
    }

    // Normalization Logic: Open Data (TWT)
    function normalizeOpenData(data) {
        let products = [];
        // Structure is simple: { category: { pass: [] } }
        for (const [category, lists] of Object.entries(data)) {
            if (lists.pass) {
                lists.pass.forEach(p => {
                    products.push({
                        name: p.name,
                        source: p.source || 'Open Data',
                        category: category,
                        status: 'pass',
                        link: p.link
                    });
                });
            }

            if (lists.fail) {
                lists.fail.forEach(p => {
                    products.push({
                        name: p.name,
                        source: p.source || 'Open Data',
                        category: category,
                        status: 'fail',
                        link: p.link
                    });
                });
            }

            if (lists.expired) {
                lists.expired.forEach(p => {
                    products.push({
                        name: p.name,
                        source: p.source || 'Open Data',
                        category: category,
                        status: 'pending',
                        link: p.link
                    });
                });
            }
        }
        return products;
    }

    // 2. Rendering
    function renderProducts(products) {
        resultsGrid.innerHTML = '';

        if (products.length === 0) {
            resultsGrid.innerHTML = `<div class="loading-state">No records found matching your query.</div>`;
            return;
        }

        const query = searchInput.value.toLowerCase();

        products.forEach((p, index) => {
            const card = document.createElement('div');
            // Clean status for CSS class (not_healthy -> not-healthy)
            const statusClass = p.status.replace('_', '-');
            card.className = `product-card status-${statusClass}`;

            // Staggered Animation Delay
            card.style.animationDelay = `${index * 30}ms`; // 30ms stagger

            let statusLabel = 'UNKNOWN';
            let btnText = 'View Source';

            if (p.status === 'pass') {
                statusLabel = 'PASSED TEST';
            } else if (p.status === 'fail') {
                statusLabel = 'FAILED TEST';
                btnText = 'View Failure Report';
            } else if (p.status === 'pending') {
                statusLabel = 'UNDER REVIEW';
            } else if (p.status === 'not_healthy') {
                statusLabel = 'NOT HEALTHY';
                btnText = 'View Analysis';
            }

            // Search Highlighting
            let displayName = p.name;
            if (query && query.length > 1) {
                const regex = new RegExp(`(${query})`, 'gi');
                displayName = displayName.replace(regex, '<span class="highlight">$1</span>');
            }

            // Clickable Category
            const safeCategory = p.category.replace(/'/g, "\\'");

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-category" onclick="filterByCategory('${safeCategory}')">${p.category}</span>
                </div>
                <h3 class="card-title">${displayName}</h3>
                
                <div class="status-indicator">
                    <span class="status-dot"></span> ${statusLabel}
                </div>

                <a href="${p.link}" target="_blank" class="view-btn">${btnText}</a>
            `;
            resultsGrid.appendChild(card);
        });
    }

    // 3. Stats & Chart
    function updateStats() {
        const total = allProducts.length;
        const safe = allProducts.filter(p => p.status === 'pass').length;
        const fail = allProducts.filter(p => p.status === 'fail').length;
        const notHealthy = allProducts.filter(p => p.status === 'not_healthy').length;
        const pending = allProducts.filter(p => p.status === 'pending').length;

        // Update Text
        stats.total.textContent = total;
        stats.safe.textContent = safe;
        stats.unsafe.textContent = fail;
        stats.notHealthy.textContent = notHealthy;
        stats.pending.textContent = pending;

        // Update Chart with SVG segments
        if (total > 0) {
            const safeP = (safe / total) * 100;
            const notHealthyP = (notHealthy / total) * 100;
            const failP = (fail / total) * 100;
            const pendingP = (pending / total) * 100;

            drawPieChart([
                { percentage: safeP, color: '#00ffa3', status: 'pass', label: 'Safe/Pass' },
                { percentage: notHealthyP, color: '#ffb700', status: 'not_healthy', label: 'Not Healthy' },
                { percentage: failP, color: '#ff4d4d', status: 'fail', label: 'Fail/Hazard' },
                { percentage: pendingP, color: '#00d2ff', status: 'pending', label: 'Under Review' }
            ]);
        }
    }

    // Draw interactive SVG pie chart
    function drawPieChart(segments) {
        const chart = document.getElementById('statsChart');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 200 200');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.transform = 'rotate(-90deg)';

        const centerX = 100;
        const centerY = 100;
        const radius = 90;
        const innerRadius = 72; // For donut shape

        let currentAngle = 0;

        segments.forEach((segment) => {
            if (segment.percentage === 0) return;

            const angle = (segment.percentage / 100) * 360;
            const endAngle = currentAngle + angle;

            // Create path for outer arc
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const pathData = createDonutSegment(centerX, centerY, radius, innerRadius, currentAngle, endAngle);

            path.setAttribute('d', pathData);
            path.setAttribute('fill', segment.color);
            path.setAttribute('class', 'pie-segment');
            path.setAttribute('data-status', segment.status);

            // Click to filter
            path.addEventListener('click', function() {
                filterByStatus(segment.status);
            });

            svg.appendChild(path);
            currentAngle = endAngle;
        });

        // Remove old SVG if it exists, keeping the center element intact
        const existingSvg = chart.querySelector('svg');
        if (existingSvg) {
            chart.removeChild(existingSvg);
        }
        chart.insertBefore(svg, chart.firstChild);

        // Add click listener to center to reset filter (if not already added)
        const centerDiv = chart.querySelector('.chart-center');
        if (centerDiv && !centerDiv.hasAttribute('data-click-listener')) {
            centerDiv.addEventListener('click', function() {
                activeFilter = 'all';
                searchInput.value = '';
                filterData();
                updateChartHighlight();
                window.scrollTo({ top: document.getElementById('resultsGrid').offsetTop - 100, behavior: 'smooth' });
            });
            centerDiv.setAttribute('data-click-listener', 'true');
        }
    }

    // Helper function to create SVG path for donut segment
    function createDonutSegment(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
        const startRadians = (startAngle * Math.PI) / 180;
        const endRadians = (endAngle * Math.PI) / 180;

        const outerStartX = cx + outerRadius * Math.cos(startRadians);
        const outerStartY = cy + outerRadius * Math.sin(startRadians);
        const outerEndX = cx + outerRadius * Math.cos(endRadians);
        const outerEndY = cy + outerRadius * Math.sin(endRadians);

        const innerStartX = cx + innerRadius * Math.cos(startRadians);
        const innerStartY = cy + innerRadius * Math.sin(startRadians);
        const innerEndX = cx + innerRadius * Math.cos(endRadians);
        const innerEndY = cy + innerRadius * Math.sin(endRadians);

        const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

        return `
            M ${outerStartX} ${outerStartY}
            A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}
            L ${innerEndX} ${innerEndY}
            A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}
            Z
        `;
    }

    // 4. Filtering & Search
    function filterData() {
        const query = searchInput.value.toLowerCase();

        const filtered = allProducts.filter(p => {
            // Status filter
            if (activeFilter !== 'all' && p.status !== activeFilter) return false;

            // Search Query
            if (query && !p.name.toLowerCase().includes(query) && !p.category.toLowerCase().includes(query)) return false;
            return true;
        });

        renderProducts(filtered);
    }

    // Filter by status (called when pie segment is clicked)
    function filterByStatus(status) {
        if (activeFilter === status) {
            // Toggle off if clicking the same filter
            activeFilter = 'all';
        } else {
            activeFilter = status;
        }

        // Clear search input to show all products with this status
        searchInput.value = '';
        filterData();

        // Scroll to results
        window.scrollTo({ top: document.getElementById('resultsGrid').offsetTop - 100, behavior: 'smooth' });

        // Update visual feedback on chart
        updateChartHighlight();
    }

    // Update chart visual feedback for active filter
    function updateChartHighlight() {
        const segments = document.querySelectorAll('.pie-segment');
        segments.forEach(segment => {
            const segmentStatus = segment.getAttribute('data-status');
            if (activeFilter === 'all') {
                segment.style.opacity = '1';
                segment.style.filter = 'none';
            } else if (segmentStatus === activeFilter) {
                segment.style.opacity = '1';
                segment.style.filter = 'drop-shadow(0 0 10px currentColor)';
            } else {
                segment.style.opacity = '0.3';
                segment.style.filter = 'none';
            }
        });
    }

    // Global function for category click
    window.filterByCategory = (category) => {
        activeFilter = 'all'; // Reset status filter when filtering by category
        searchInput.value = category;
        filterData();
        updateChartHighlight();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Events
    searchInput.addEventListener('input', () => {
        activeFilter = 'all'; // Reset status filter when searching
        filterData();
        updateChartHighlight();
    });

    // Disclaimer Modal Logic
    const modal = document.getElementById('disclaimerModal');
    const acceptBtn = document.getElementById('acceptDisclaimer');

    // Show on load
    setTimeout(() => {
        modal.classList.add('active');
    }, 100);

    acceptBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Mouse Follower Logic
    const cursor = document.getElementById('cursor-glow');
    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });

    // Init
    loadData();
});
