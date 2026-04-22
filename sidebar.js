// sidebar.js

// KADH Admin Sidebar Functionality

// Floating sidebar toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

// Breadcrumb builder
function buildBreadcrumb(crumbs) {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    breadcrumbContainer.innerHTML = '';

    crumbs.forEach(crumb => {
        const crumbElement = document.createElement('li');
        crumbElement.textContent = crumb;
        breadcrumbContainer.appendChild(crumbElement);
    });
}

// Date range filter helper
function dateRangeFilter(startDate, endDate) {
    // Logic for filtering by date range
}

// Revenue chart renderer
function renderRevenueChart(data) {
    // Logic for rendering revenue chart
}

// Audit log helper
function fetchAuditLogs() {
    // Logic for fetching audit logs
}

// Funnel bar renderer
function renderFunnelBar(data) {
    // Logic for rendering funnel bar
}

// Variant row builder utilities
function buildVariantRow(variant) {
    // Logic for building a variant row
}