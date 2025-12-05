// Guides page logic: fetch guides, search/filter, render
(function() {
    const state = {
        all: [],
        filtered: [],
        search: '',
        loading: true,
        error: ''
    };

    const els = {
        container: () => document.getElementById('guidesContainer'),
        search: () => document.getElementById('guidesSearch'),
        searchBtn: () => document.getElementById('guidesSearchBtn'),
        tags: () => document.querySelectorAll('.guide-tag'),
        clear: () => document.getElementById('guidesClear'),
        count: () => document.getElementById('guidesCount')
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        await loadGuides();
        bindEvents();
        filter();
        render();
    }

    async function loadGuides() {
        try {
            const res = await fetch('data/guides.json');
            state.all = await res.json();
        } catch (err) {
            console.error('Failed to load guides', err);
            state.error = 'Could not load guides.';
            state.all = [];
        }
        state.loading = false;
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
            });
        }
        els.tags().forEach(tag => {
            tag.addEventListener('click', () => {
                state.search = tag.textContent.trim();
                if (searchEl) searchEl.value = state.search;
                filter();
                render();
            });
        });
        const clear = els.clear();
        if (clear) {
            clear.addEventListener('click', () => {
                state.search = '';
                if (searchEl) searchEl.value = '';
                filter();
                render();
            });
        }
    }

    function filter() {
        const q = state.search.toLowerCase();
        state.filtered = state.all.filter(g =>
            !q ||
            (g.title || '').toLowerCase().includes(q) ||
            (g.excerpt || '').toLowerCase().includes(q) ||
            (g.content || '').toLowerCase().includes(q)
        );
    }

    function render() {
        const container = els.container();
        const count = els.count();
        if (count) count.textContent = `${state.filtered.length} guides`;
        if (!container) return;

        if (state.loading) {
            container.innerHTML = `<p class="no-results">Loading guides...</p>`;
            return;
        }
        if (state.error) {
            container.innerHTML = `<p class="no-results">${state.error}</p>`;
            return;
        }
        if (!state.filtered.length) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>No guides found</h3>
                    <p>Try another keyword.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = state.filtered.map(guide => `
            <div class="guide-card">
                <div class="guide-image">📖</div>
                <div class="guide-content">
                    <h3 class="guide-title">${guide.title}</h3>
                    <p class="guide-excerpt">${(guide.excerpt || guide.content || '').slice(0, 140)}...</p>
                    <a href="guide-detail.html?id=${guide.id || ''}" class="read-more">Read Guide →</a>
                </div>
            </div>
        `).join('');
    }

    function debounce(fn, wait) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }
})();

