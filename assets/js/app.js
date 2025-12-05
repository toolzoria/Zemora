// ===== GLOBAL STATE =====
let allTools = [];
let allGuides = [];
let allBlogPosts = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Zemora initialized 🚀');
    
    // Load data based on current page
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'index.html' || currentPage === '') {
        loadFeaturedTools();
        loadLatestGuides();
        setupGlobalSearch();
    } else if (currentPage === 'tools.html') {
        loadAllTools();
        setupToolsFilter();
    } else if (currentPage === 'guides.html') {
        loadAllGuides();
    }
    
    // Common setup
    setupMobileMenu();
    setupExternalLinks();
});

// ===== DATA LOADING =====
async function loadFeaturedTools() {
    try {
        const response = await fetch('data/tools.json');
        allTools = await response.json();
        const featuredTools = allTools.filter(tool => tool.featured).slice(0, 6);
        
        const container = document.getElementById('featuredTools');
        if (container) {
            container.innerHTML = featuredTools.map(tool => `
                <div class="tool-card">
                    <div class="tool-icon">${tool.icon}</div>
                    <h3>${tool.name}</h3>
                    <span class="tool-category">${formatCategory(tool.category)}</span>
                    <p>${tool.description}</p>
                    <div class="tool-platforms">
                        ${tool.platform.map(p => `<span class="platform-tag">${p}</span>`).join('')}
                    </div>
                    <a href="${tool.download}" target="_blank" class="download-btn">Download →</a>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading tools:', error);
        showError('Failed to load tools. Please try again later.');
    }
}

async function loadAllTools() {
    try {
        const response = await fetch('data/tools.json');
        allTools = await response.json();
        
        const container = document.getElementById('toolsContainer');
        if (container) {
            renderTools(allTools);
        }
    } catch (error) {
        console.error('Error loading tools:', error);
        showError('Failed to load tools. Please try again later.');
    }
}

async function loadLatestGuides() {
    try {
        const response = await fetch('data/guides.json');
        allGuides = await response.json();
        const latestGuides = allGuides.slice(0, 3);
        
        const container = document.getElementById('latestGuides');
        if (container) {
            container.innerHTML = latestGuides.map(guide => `
                <div class="guide-card">
                    <div class="guide-image">📖</div>
                    <div class="guide-content">
                        <h3 class="guide-title">${guide.title}</h3>
                        <p class="guide-excerpt">${guide.excerpt || guide.content.substring(0, 100)}...</p>
                        <a href="guide-detail.html?id=${guide.id}" class="read-more">Read Guide →</a>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading guides:', error);
    }
}

// ===== SEARCH FUNCTIONALITY =====
function setupGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    const searchButton = document.querySelector('.search-box button');
    
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }
    
    // Setup tag clicks
    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const searchTerm = this.textContent;
            document.getElementById('globalSearch').value = searchTerm;
            performSearch();
        });
    });
}

function performSearch() {
    const searchInput = document.getElementById('globalSearch');
    const query = searchInput ? searchInput.value.trim() : '';
    
    if (query) {
        // Store search query and redirect to tools page
        sessionStorage.setItem('searchQuery', query);
        window.location.href = `tools.html?search=${encodeURIComponent(query)}`;
    } else {
        window.location.href = 'tools.html';
    }
}

// ===== TOOLS PAGE FUNCTIONS =====
function renderTools(tools) {
    const container = document.getElementById('toolsContainer');
    if (!container) return;
    
    if (tools.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <h3>No tools found</h3>
                <p>Try a different search or browse categories</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tools.map(tool => `
        <div class="tool-card">
            <div class="tool-icon">${tool.icon}</div>
            <h3>${tool.name}</h3>
            <span class="tool-category">${formatCategory(tool.category)}</span>
            <p>${tool.description}</p>
            <div class="tool-platforms">
                ${tool.platform.map(p => `<span class="platform-tag">${p}</span>`).join('')}
            </div>
            <div class="tool-meta">
                <span class="tool-difficulty">${tool.difficulty}</span>
                <span class="tool-license">${tool.license}</span>
            </div>
            <a href="${tool.download}" target="_blank" class="download-btn">Download →</a>
        </div>
    `).join('');
}

function setupToolsFilter() {
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search') || sessionStorage.getItem('searchQuery');
    const categoryQuery = urlParams.get('category');
    
    if (searchQuery) {
        filterTools(searchQuery);
        document.getElementById('toolsSearch').value = searchQuery;
        sessionStorage.removeItem('searchQuery');
    }
    
    if (categoryQuery) {
        filterByCategory(categoryQuery);
    }
    
    // Setup search input
    const searchInput = document.getElementById('toolsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterTools(this.value);
        });
    }
    
    // Setup category buttons
    document.querySelectorAll('.category-filter').forEach(button => {
        button.addEventListener('click', function() {
            const category = this.dataset.category;
            filterByCategory(category);
        });
    });
    
    // Setup clear filters
    const clearButton = document.getElementById('clearFilters');
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            renderTools(allTools);
            document.getElementById('toolsSearch').value = '';
            updateActiveCategory('all');
        });
    }
}

function filterTools(query) {
    if (!query.trim()) {
        renderTools(allTools);
        return;
    }
    
    const filtered = allTools.filter(tool => 
        tool.name.toLowerCase().includes(query.toLowerCase()) ||
        tool.description.toLowerCase().includes(query.toLowerCase()) ||
        tool.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
    
    renderTools(filtered);
}

function filterByCategory(category) {
    if (category === 'all') {
        renderTools(allTools);
    } else {
        const filtered = allTools.filter(tool => tool.category === category);
        renderTools(filtered);
    }
    updateActiveCategory(category);
}

function updateActiveCategory(category) {
    document.querySelectorAll('.category-filter').forEach(btn => {
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ===== UTILITY FUNCTIONS =====
function formatCategory(category) {
    const categories = {
        'developer': 'Developer Tool',
        'design': 'Design Tool',
        'windows': 'Windows Utility',
        'ai': 'AI Tool',
        'security': 'Security Tool',
        'mobile': 'Mobile App',
        'productivity': 'Productivity'
    };
    return categories[category] || category;
}

function setupMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', function() {
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        });
        
        // Close menu on window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                navLinks.style.display = '';
            }
        });
    }
}

function setupExternalLinks() {
    // Open external links in new tab
    document.querySelectorAll('a[href^="http"]').forEach(link => {
        if (!link.href.includes(window.location.hostname)) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
    });
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <p>${message}</p>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--danger);
        color: white;
        padding: 1rem;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        gap: 1rem;
        z-index: 1000;
        box-shadow: var(--shadow-lg);
    `;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

// ===== EXPORT FOR USE IN OTHER FILES =====
window.Zemora = {
    filterTools,
    filterByCategory,
    performSearch
};