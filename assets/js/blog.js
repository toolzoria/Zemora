// Blog page logic: fetch posts, search/filter/sort, render
(function() {
    const state = {
        all: [],
        filtered: [],
        search: '',
        category: 'all',
        sort: 'newest',
        loading: true,
        error: ''
    };

    const els = {
        container: () => document.getElementById('blogContainer'),
        search: () => document.getElementById('blogSearch'),
        searchBtn: () => document.getElementById('blogSearchBtn'),
        tags: () => document.querySelectorAll('.blog-tag'),
        clear: () => document.getElementById('blogClear'),
        count: () => document.getElementById('blogCount'),
        categories: () => document.getElementById('blogCategories'),
        sort: () => document.getElementById('blogSort')
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        await loadPosts();
        buildCategories();
        applyInitialFilters();
        bindEvents();
        filter();
        render();
    }

    async function loadPosts() {
        try {
            const res = await fetch('data/blog.json');
            state.all = await res.json();
        } catch (err) {
            console.error('Failed to load blog', err);
            state.error = 'Could not load blog posts.';
            state.all = [];
        }
        state.loading = false;
    }

    function applyInitialFilters() {
        const params = new URLSearchParams(window.location.search);
        const searchQuery = params.get('search') || '';
        const categoryQuery = params.get('category');
        const sortQuery = params.get('sort');

        if (searchQuery) {
            state.search = searchQuery;
            const searchEl = els.search();
            if (searchEl) searchEl.value = searchQuery;
        }
        if (categoryQuery) {
            state.category = categoryQuery;
        }
        if (sortQuery) {
            state.sort = sortQuery;
            const sortEl = els.sort();
            if (sortEl) sortEl.value = sortQuery;
        }
    }

    function buildCategories() {
        const container = els.categories();
        if (!container) return;
        const categories = Array.from(new Set(state.all.map(p => p.category).filter(Boolean)));
        const btnAll = createCategoryBtn('all', 'All');
        container.innerHTML = '';
        container.appendChild(btnAll);
        categories.forEach(cat => container.appendChild(createCategoryBtn(cat, cat)));
        updateActiveCategory();
    }

    function createCategoryBtn(value, label) {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.dataset.category = value;
        btn.textContent = label;
        btn.addEventListener('click', () => {
            state.category = value;
            updateActiveCategory();
            filter();
            render();
            syncUrl();
        });
        return btn;
    }

    function updateActiveCategory() {
        const buttons = document.querySelectorAll('#blogCategories .category-btn');
        buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.category === state.category));
    }

    function bindEvents() {
        const searchEl = els.search();
        if (searchEl) {
            searchEl.addEventListener('input', debounce((e) => {
                state.search = e.target.value.trim();
                filter();
                render();
            }, 200));
        }
        const searchBtn = els.searchBtn();
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                state.search = (els.search()?.value || '').trim();
                filter();
                render();
                syncUrl();
            });
        }
        els.tags().forEach(tag => {
            tag.addEventListener('click', () => {
                state.search = tag.textContent.trim();
                if (searchEl) searchEl.value = state.search;
                filter();
                render();
                syncUrl();
            });
        });
        const clear = els.clear();
        if (clear) {
            clear.addEventListener('click', () => {
                state.search = '';
                state.category = 'all';
                state.sort = 'newest';
                if (searchEl) searchEl.value = '';
                const sortEl = els.sort();
                if (sortEl) sortEl.value = 'newest';
                updateActiveCategory();
                filter();
                render();
                syncUrl(true);
            });
        }
        const sortEl = els.sort();
        if (sortEl) {
            sortEl.addEventListener('change', () => {
                state.sort = sortEl.value;
                filter();
                render();
                syncUrl();
            });
        }
    }

    function filter() {
        const q = state.search.toLowerCase();
        state.filtered = state.all.filter(post => {
            const matchesSearch =
                !q ||
                (post.title || '').toLowerCase().includes(q) ||
                (post.excerpt || '').toLowerCase().includes(q) ||
                (post.content || '').toLowerCase().includes(q) ||
                (post.tags || []).some(t => t.toLowerCase().includes(q));
            const matchesCategory = state.category === 'all' || post.category === state.category;
            return matchesSearch && matchesCategory;
        });
        state.filtered = sortPosts(state.filtered, state.sort);
    }

    function sortPosts(list, sortKey) {
        const arr = [...list];
        switch (sortKey) {
            case 'oldest':
                return arr.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
            case 'title-asc':
                return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            case 'title-desc':
                return arr.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
            case 'newest':
            default:
                return arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        }
    }

    function render() {
        const container = els.container();
        const count = els.count();
        if (count) count.textContent = `${state.filtered.length} posts`;
        if (!container) return;

        if (state.loading) {
            container.innerHTML = `<p class="no-results">Loading posts...</p>`;
            return;
        }
        if (state.error) {
            container.innerHTML = `<p class="no-results">${state.error}</p>`;
            return;
        }
        if (!state.filtered.length) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>No posts found</h3>
                    <p>Try another keyword.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = state.filtered.map(post => `
            <div class="guide-card">
                <div class="guide-image">📰</div>
                <div class="guide-content">
                    <h3 class="guide-title">${post.title}</h3>
                    <div class="tool-meta" style="margin: 0.5rem 0; display:flex; gap:10px; flex-wrap:wrap;">
                        <span class="tool-difficulty">${formatDate(post.date)}</span>
                        <span class="tool-license">${estimateReadTime(post.content)} min read</span>
                        ${post.category ? `<span class="tool-license">${post.category}</span>` : ''}
                    </div>
                    <p class="guide-excerpt">${(post.excerpt || post.content || '').slice(0, 160)}...</p>
                    <div class="tool-platforms" style="margin: 0.5rem 0;">
                        ${(post.tags || []).map(t => `<span class="platform-tag">${t}</span>`).join('')}
                    </div>
                    <a href="blog-detail.html?id=${post.id || ''}" class="read-more">Read Article →</a>
                </div>
            </div>
        `).join('');
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'No date';
        const d = new Date(dateStr);
        if (isNaN(d)) return 'No date';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function estimateReadTime(content = '') {
        const words = content.split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / 200));
    }

    function syncUrl(reset = false) {
        const params = new URLSearchParams();
        if (state.search) params.set('search', state.search);
        if (state.category && state.category !== 'all') params.set('category', state.category);
        if (state.sort && state.sort !== 'newest') params.set('sort', state.sort);
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
})();

