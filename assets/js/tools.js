// Tools page logic: fetch tools, handle search/category filters, and render
(function() {
    const state = {
        all: [],
        filtered: [],
        search: '',
        category: 'all',
        sort: 'featured',
        featuredOnly: false,
        loading: true,
        error: ''
    };

    const els = {
        container: () => document.getElementById('toolsContainer'),
        count: () => document.getElementById('toolsCount'),
        search: () => document.getElementById('toolsSearch'),
        categoryButtons: () => document.querySelectorAll('.category-btn'),
        clearBtn: () => document.getElementById('clearFilters'),
        toolsControls: () => document.querySelector('.tools-controls')
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        buildAdvancedControls();
        await loadTools();
        applyInitialFilters();
        bindEvents();
        render();
    }

    async function loadTools() {
        state.loading = true;
        render();
        try {
            const res = await fetch('data/tools.json');
            state.all = await res.json();
        } catch (err) {
            console.error('Failed to load tools', err);
            state.error = 'Could not load tools. Please try again later.';
            state.all = [];
        }
        state.loading = false;
    }

    function applyInitialFilters() {
        const params = new URLSearchParams(window.location.search);
        const searchQuery = params.get('search') || sessionStorage.getItem('searchQuery') || '';
        const categoryQuery = params.get('category');
        const sortQuery = params.get('sort');
        const featuredQuery = params.get('featured');

        if (searchQuery) {
            state.search = searchQuery;
            const searchEl = els.search();
            if (searchEl) searchEl.value = searchQuery;
            sessionStorage.removeItem('searchQuery');
        }

        if (categoryQuery) {
            state.category = categoryQuery;
            updateActiveCategory(categoryQuery);
        }

        if (sortQuery) {
            state.sort = sortQuery;
            const sortEl = document.getElementById('toolsSort');
            if (sortEl) sortEl.value = sortQuery;
        }

        if (featuredQuery === '1') {
            state.featuredOnly = true;
            const featuredEl = document.getElementById('featuredToggle');
            if (featuredEl) featuredEl.checked = true;
        }

        filterData();
    }

    function bindEvents() {
        const searchEl = els.search();
        if (searchEl) {
            searchEl.addEventListener('input', debounce((e) => {
                state.search = e.target.value.trim();
                filterData();
                render();
                syncUrl();
            }, 200));
        }

        els.categoryButtons().forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.category;
                state.category = cat;
                updateActiveCategory(cat);
                filterData();
                render();
                syncUrl();
            });
        });

        const sortEl = document.getElementById('toolsSort');
        if (sortEl) {
            sortEl.addEventListener('change', () => {
                state.sort = sortEl.value;
                filterData();
                render();
                syncUrl();
            });
        }

        const featuredEl = document.getElementById('featuredToggle');
        if (featuredEl) {
            featuredEl.addEventListener('change', () => {
                state.featuredOnly = featuredEl.checked;
                filterData();
                render();
                syncUrl();
            });
        }

        const clear = els.clearBtn();
        if (clear) {
            clear.addEventListener('click', () => {
                state.search = '';
                state.category = 'all';
                state.sort = 'featured';
                state.featuredOnly = false;
                if (searchEl) searchEl.value = '';
                updateActiveCategory('all');
                const sortEl = document.getElementById('toolsSort');
                if (sortEl) sortEl.value = 'featured';
                const featuredEl = document.getElementById('featuredToggle');
                if (featuredEl) featuredEl.checked = false;
                filterData();
                render();
                syncUrl(true);
            });
        }
    }

    function filterData() {
        const q = state.search.toLowerCase();
        state.filtered = state.all.filter(tool => {
            const matchesCategory = state.category === 'all' || tool.category === state.category;
            const matchesSearch = !q || [
                tool.name,
                tool.description,
                ...(tool.tags || []),
                ...(tool.platform || [])
            ].some(val => (val || '').toString().toLowerCase().includes(q));
            const matchesFeatured = !state.featuredOnly || tool.featured;
            return matchesCategory && matchesSearch && matchesFeatured;
        });

        state.filtered = applySort(state.filtered, state.sort);
    }

    function applySort(list, sortKey) {
        const cloned = [...list];
        switch (sortKey) {
            case 'name-asc':
                return cloned.sort((a, b) => a.name.localeCompare(b.name));
            case 'name-desc':
                return cloned.sort((a, b) => b.name.localeCompare(a.name));
            case 'difficulty':
                return cloned.sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty));
            case 'featured':
            default:
                return cloned.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
        }
    }

    function difficultyRank(level = '') {
        const order = ['beginner', 'intermediate', 'advanced'];
        const idx = order.indexOf(level.toLowerCase());
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    }

    function render() {
        const container = els.container();
        const countEl = els.count();
        if (countEl) countEl.textContent = state.filtered.length;
        if (!container) return;

        if (state.loading) {
            container.innerHTML = `
                <div class="no-results">
                    <p>Loading tools...</p>
                </div>
            `;
            return;
        }

        if (state.error) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>Error</h3>
                    <p>${state.error}</p>
                </div>
            `;
            return;
        }

        if (!state.filtered.length) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>No tools found</h3>
                    <p>Try a different search or browse categories</p>
                </div>
            `;
            return;
        }

        container.innerHTML = state.filtered.map(tool => `
            <div class="tool-card">
                <div class="tool-icon">${tool.icon || '🛠️'}</div>
                <h3>${tool.name}</h3>
                <span class="tool-category">${formatCategory(tool.category)}</span>
                <p>${tool.description}</p>
                <div class="tool-platforms">
                    ${(tool.platform || []).map(p => `<span class="platform-tag">${p}</span>`).join('')}
                </div>
                <div class="tool-meta">
                    <span class="tool-difficulty">${tool.difficulty || ''}</span>
                    <span class="tool-license">${tool.license || ''}</span>
                </div>
                <a href="${tool.download}" target="_blank" class="download-btn">Download →</a>
            </div>
        `).join('');
    }

    function updateActiveCategory(category) {
        els.categoryButtons().forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
    }

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

    function syncUrl(reset = false) {
        const params = new URLSearchParams();
        if (state.search) params.set('search', state.search);
        if (state.category && state.category !== 'all') params.set('category', state.category);
        if (state.sort && state.sort !== 'featured') params.set('sort', state.sort);
        if (state.featuredOnly) params.set('featured', '1');
        const newUrl = reset ? window.location.pathname : `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }

    function debounce(fn, wait) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }

    function buildAdvancedControls() {
        const controls = els.toolsControls();
        if (!controls) return;

        // Sort select
        const sortLabel = document.createElement('label');
        sortLabel.textContent = 'Sort';
        sortLabel.style.color = 'var(--text-secondary)';
        sortLabel.style.fontSize = '0.9rem';
        sortLabel.style.display = 'flex';
        sortLabel.style.flexDirection = 'column';

        const sortSelect = document.createElement('select');
        sortSelect.id = 'toolsSort';
        sortSelect.style.padding = '0.85rem';
        sortSelect.style.background = 'var(--bg-tertiary)';
        sortSelect.style.border = '1px solid var(--border)';
        sortSelect.style.borderRadius = 'var(--radius-sm)';
        sortSelect.style.color = 'var(--text-primary)';
        sortSelect.innerHTML = `
            <option value="featured">Featured first</option>
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="difficulty">Difficulty</option>
        `;
        sortLabel.appendChild(sortSelect);

        // Featured toggle
        const featuredWrap = document.createElement('label');
        featuredWrap.style.display = 'inline-flex';
        featuredWrap.style.alignItems = 'center';
        featuredWrap.style.gap = '8px';
        featuredWrap.style.color = 'var(--text-secondary)';
        featuredWrap.style.fontSize = '0.95rem';

        const featuredCheckbox = document.createElement('input');
        featuredCheckbox.type = 'checkbox';
        featuredCheckbox.id = 'featuredToggle';
        featuredWrap.appendChild(featuredCheckbox);
        featuredWrap.appendChild(document.createTextNode('Featured only'));

        controls.appendChild(sortLabel);
        controls.appendChild(featuredWrap);
    }
})();

