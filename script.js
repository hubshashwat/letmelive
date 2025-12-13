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
            // Fetch both JSONs in parallel
            const [trustifiedRes, unboxRes] = await Promise.all([
                fetch('trustified_data.json'),
                fetch('unbox_data.json')
            ]);

            const trustifiedData = await trustifiedRes.json();
            const unboxData = await unboxRes.json();

            // Normalize Trustified
            const trustifiedNormalized = normalizeTrustified(trustifiedData);

            // Normalize Unbox
            const unboxNormalized = normalizeUnbox(unboxData);

            // Combine
            allProducts = [...trustifiedNormalized, ...unboxNormalized];

            // Initial Render
            updateStats();
            renderProducts(allProducts);

        } catch (error) {
            console.error("Data load failed:", error);
            resultsGrid.innerHTML = `<div class="loading-state" style="color:var(--neon-red)">Failed to load database uplink. Check console.</div>`;
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

        // Update Chart Gradient
        if (total > 0) {
            const safeP = (safe / total) * 100;
            const notHealthyP = (notHealthy / total) * 100;
            const failP = (fail / total) * 100;
            // pending is remainder

            // Calculate stops
            const stop1 = safeP;
            const stop2 = safeP + notHealthyP;
            const stop3 = safeP + notHealthyP + failP;

            const chart = document.getElementById('statsChart');
            chart.style.background = `conic-gradient(
                var(--neon-green) 0% ${stop1}%,
                #ffb700 ${stop1}% ${stop2}%,
                var(--neon-red) ${stop2}% ${stop3}%,
                var(--neon-blue) ${stop3}% 100%
            )`;
        }
    }

    // 4. Filtering & Search
    function filterData() {
        const query = searchInput.value.toLowerCase();

        const filtered = allProducts.filter(p => {
            // Search Query only
            if (query && !p.name.toLowerCase().includes(query) && !p.category.toLowerCase().includes(query)) return false;
            return true;
        });

        renderProducts(filtered);
    }

    // Global function for category click
    window.filterByCategory = (category) => {
        searchInput.value = category;
        filterData();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Events
    searchInput.addEventListener('input', filterData);

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
