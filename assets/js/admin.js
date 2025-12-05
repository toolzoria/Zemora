// Zemora Admin Panel - client-side content manager with multi-tab sync
// This is a static admin; data persists in localStorage and can be exported.

(function() {
    const PASSWORD = 'zemora123'; // replace with env/server-side check in production
    const CLIENT_ID = Math.random().toString(16).slice(2);
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('zemora-admin-sync') : null;
    const storeKeys = {
        tools: 'zemora_tools',
        guides: 'zemora_guides',
        blog: 'zemora_blog'
    };

    const state = {
        tools: [],
        guides: [],
        blog: [],
        activeSection: 'tools',
        editing: { tools: null, guides: null, blog: null }
    };

    // ====== Helpers ======
    const qs = (sel) => document.querySelector(sel);
    const qsa = (sel) => Array.from(document.querySelectorAll(sel));

    const persist = (key, data) => localStorage.setItem(key, JSON.stringify(data));
    const loadPersisted = (key) => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.error('Failed to parse storage', key, err);
            return null;
        }
    };

    const setHidden = (el, hidden) => {
        if (!el) return;
        el.classList[hidden ? 'add' : 'remove']('hidden');
    };

    const createId = () => Date.now();

    const toast = (msg, type = 'info') => {
        const div = document.createElement('div');
        div.textContent = msg;
        div.style.position = 'fixed';
        div.style.bottom = '20px';
        div.style.right = '20px';
        div.style.padding = '12px 14px';
        div.style.borderRadius = '10px';
        div.style.background = type === 'error' ? 'rgba(239,68,68,0.9)' : 'rgba(14,165,233,0.9)';
        div.style.color = '#0b1220';
        div.style.zIndex = '2000';
        div.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2600);
    };

    const slugify = (str = '') =>
        str.toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');

    const isValidUrl = (url) => {
        if (!url) return false;
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (_) {
            return false;
        }
    };

    const setSyncStatus = (msg) => {
        const el = qs('#syncStatus');
        if (el) el.innerHTML = `<span class="status-dot"></span> ${msg}`;
    };

    const broadcast = (dataset) => {
        if (!channel) return;
        channel.postMessage({
            type: 'dataset:update',
            dataset,
            data: state[dataset],
            origin: CLIENT_ID,
            ts: Date.now()
        });
    };

    const persistDataset = (dataset) => {
        persist(storeKeys[dataset], state[dataset]);
        broadcast(dataset);
        setSyncStatus(`Synced ${dataset} @ ${new Date().toLocaleTimeString()}`);
    };

    // ====== Auth ======
    function bindAuth() {
        const loginBtn = qs('#loginBtn');
        const logoutBtn = qs('#logoutBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                const pwd = qs('#adminPassword').value.trim();
                if (pwd === PASSWORD) {
                    localStorage.setItem('zemora_admin_authed', '1');
                    showApp();
                } else {
                    toast('Invalid password', 'error');
                }
            });
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('zemora_admin_authed');
                window.location.reload();
            });
        }

        if (localStorage.getItem('zemora_admin_authed') === '1') {
            showApp();
        }
    }

    function showApp() {
        setHidden(qs('#authPanel'), true);
        setHidden(qs('#dashboardPanel'), false);
        setHidden(qs(`[data-section-panel="${state.activeSection}"]`), false);
        initData();
        bindNavigation();
        bindTools();
        bindGuides();
        bindBlog();
        bindImportExport();
        bindRealtime();
        updateStats();
    }

    // ====== Data loading ======
    async function initData() {
        const persistedTools = loadPersisted(storeKeys.tools);
        const persistedGuides = loadPersisted(storeKeys.guides);
        const persistedBlog = loadPersisted(storeKeys.blog);

        state.tools = persistedTools || await fetchJson('../data/tools.json') || [];
        state.guides = persistedGuides || await fetchJson('../data/guides.json') || [];
        state.blog = persistedBlog || await fetchJson('../data/blog.json') || [];

        renderTools(state.tools);
        renderGuides(state.guides);
        renderBlog(state.blog);
        setSyncStatus('Ready');
    }

    async function fetchJson(path) {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error('Network error');
            return await res.json();
        } catch (err) {
            console.warn('Fetch failed', path, err);
            return null;
        }
    }

    function updateStats() {
        qs('#statTools').textContent = state.tools.length;
        qs('#statGuides').textContent = state.guides.length;
        qs('#statBlog').textContent = state.blog.length;
    }

    // ====== Navigation ======
    function bindNavigation() {
        qsa('.nav-buttons button').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.section;
                state.activeSection = target;
                qsa('.nav-buttons button').forEach(b => b.classList.toggle('active', b === btn));
                qsa('[data-section-panel]').forEach(panel => setHidden(panel, panel.dataset.sectionPanel !== target));
                updateModePills();
            });
        });
    }

    // ====== Tools ======
    function bindTools() {
        qs('#saveToolBtn').addEventListener('click', saveTool);
        qs('#cancelToolEdit').addEventListener('click', () => resetToolForm());
        qs('#toolsSearch').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = state.tools.filter(tool =>
                tool.name.toLowerCase().includes(q) ||
                (tool.tags || []).some(t => t.toLowerCase().includes(q)) ||
                (tool.platform || []).some(p => p.toLowerCase().includes(q))
            );
            renderTools(filtered);
        });
        qs('#toolsReset').addEventListener('click', () => {
            qs('#toolsSearch').value = '';
            renderTools(state.tools);
        });
    }

    function renderTools(data) {
        const container = qs('#toolsTable');
        if (!container) return;
        if (!data.length) {
            container.innerHTML = '<p class="notice">No tools yet. Add one below.</p>';
            return;
        }
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Platforms</th>
                        <th>Tags</th>
                        <th>Featured</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(t => `
                        <tr>
                            <td>${t.icon || ''} ${t.name}</td>
                            <td>${t.category}</td>
                            <td>${(t.platform || []).join(', ')}</td>
                            <td>${(t.tags || []).join(', ')}</td>
                            <td>${t.featured ? 'Yes' : 'No'}</td>
                            <td class="actions">
                                <button class="btn" data-edit-tool="${t.id}">Edit</button>
                                <button class="btn danger" data-delete-tool="${t.id}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        qsa('[data-edit-tool]').forEach(btn => btn.addEventListener('click', () => {
            const id = Number(btn.dataset.editTool);
            startToolEdit(id);
        }));
        qsa('[data-delete-tool]').forEach(btn => btn.addEventListener('click', () => {
            const id = Number(btn.dataset.deleteTool);
            deleteTool(id);
        }));
    }

    function collectToolForm() {
        return {
            id: state.editing.tools || createId(),
            name: qs('#toolName').value.trim(),
            category: qs('#toolCategory').value,
            platform: qs('#toolPlatforms').value.split(',').map(p => p.trim()).filter(Boolean),
            tags: qs('#toolTags').value.split(',').map(t => t.trim()).filter(Boolean),
            difficulty: qs('#toolDifficulty').value.trim(),
            license: qs('#toolLicense').value.trim(),
            icon: qs('#toolIcon').value.trim(),
            download: qs('#toolDownload').value.trim(),
            description: qs('#toolDescription').value.trim(),
            featured: qs('#toolFeatured').checked
        };
    }

    function validateTool(tool) {
        if (!tool.name) return 'Name is required';
        if (!tool.download) return 'Download URL is required';
        if (tool.download && !isValidUrl(tool.download)) return 'Download URL must be http/https';
        return null;
    }

    function saveTool() {
        const tool = collectToolForm();
        const error = validateTool(tool);
        if (error) return toast(error, 'error');

        if (state.editing.tools) {
            state.tools = state.tools.map(t => t.id === tool.id ? tool : t);
        } else {
            state.tools.push(tool);
        }

        persistDataset('tools');
        renderTools(state.tools);
        updateStats();
        toast('Tool saved');
        resetToolForm();
    }

    function startToolEdit(id) {
        const tool = state.tools.find(t => t.id === id);
        if (!tool) return;
        state.editing.tools = id;
        qs('#toolName').value = tool.name || '';
        qs('#toolCategory').value = tool.category || 'developer';
        qs('#toolPlatforms').value = (tool.platform || []).join(', ');
        qs('#toolTags').value = (tool.tags || []).join(', ');
        qs('#toolDifficulty').value = tool.difficulty || '';
        qs('#toolLicense').value = tool.license || '';
        qs('#toolIcon').value = tool.icon || '';
        qs('#toolDownload').value = tool.download || '';
        qs('#toolDescription').value = tool.description || '';
        qs('#toolFeatured').checked = !!tool.featured;
        updateModePills();
    }

    function deleteTool(id) {
        if (!confirm('Delete this tool?')) return;
        state.tools = state.tools.filter(t => t.id !== id);
        persistDataset('tools');
        renderTools(state.tools);
        updateStats();
        toast('Tool deleted', 'error');
        resetToolForm();
    }

    function resetToolForm() {
        state.editing.tools = null;
        ['toolName','toolPlatforms','toolTags','toolDifficulty','toolLicense','toolIcon','toolDownload','toolDescription'].forEach(id => qs(`#${id}`).value = '');
        qs('#toolCategory').value = 'developer';
        qs('#toolFeatured').checked = false;
        updateModePills();
    }

    // ====== Guides ======
    function bindGuides() {
        qs('#saveGuideBtn').addEventListener('click', saveGuide);
        qs('#cancelGuideEdit').addEventListener('click', () => resetGuideForm());
        qs('#guideTitle').addEventListener('input', (e) => {
            if (!state.editing.guides || !qs('#guideSlug').value.trim()) {
                qs('#guideSlug').value = slugify(e.target.value);
            }
        });
        qs('#guidesSearch').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = state.guides.filter(g =>
                (g.title || '').toLowerCase().includes(q) ||
                (g.slug || '').toLowerCase().includes(q) ||
                (g.excerpt || '').toLowerCase().includes(q)
            );
            renderGuides(filtered);
        });
        qs('#guidesReset').addEventListener('click', () => {
            qs('#guidesSearch').value = '';
            renderGuides(state.guides);
        });
    }

    function renderGuides(data) {
        const container = qs('#guidesTable');
        if (!container) return;
        if (!data.length) {
            container.innerHTML = '<p class="notice">No guides yet.</p>';
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Title</th><th>Slug</th><th>Excerpt</th><th></th></tr></thead>
                <tbody>
                    ${data.map(g => `
                        <tr>
                            <td>${g.title || ''}</td>
                            <td>${g.slug || ''}</td>
                            <td>${(g.excerpt || '').slice(0,60)}${(g.excerpt || '').length>60?'...':''}</td>
                            <td class="actions">
                                <button class="btn" data-edit-guide="${g.id}">Edit</button>
                                <button class="btn danger" data-delete-guide="${g.id}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        qsa('[data-edit-guide]').forEach(btn => btn.addEventListener('click', () => startGuideEdit(Number(btn.dataset.editGuide))));
        qsa('[data-delete-guide]').forEach(btn => btn.addEventListener('click', () => deleteGuide(Number(btn.dataset.deleteGuide))));
    }

    function collectGuideForm() {
        return {
            id: state.editing.guides || createId(),
            title: qs('#guideTitle').value.trim(),
            slug: qs('#guideSlug').value.trim(),
            excerpt: qs('#guideExcerpt').value.trim(),
            content: qs('#guideContent').value.trim()
        };
    }

    function validateGuide(g) {
        if (!g.title) return 'Title is required';
        if (!g.slug) return 'Slug is required';
        return null;
    }

    function saveGuide() {
        const guide = collectGuideForm();
        const error = validateGuide(guide);
        if (error) return toast(error, 'error');
        if (state.editing.guides) {
            state.guides = state.guides.map(g => g.id === guide.id ? guide : g);
        } else {
            state.guides.push(guide);
        }
        persistDataset('guides');
        renderGuides(state.guides);
        updateStats();
        toast('Guide saved');
        resetGuideForm();
    }

    function startGuideEdit(id) {
        const guide = state.guides.find(g => g.id === id);
        if (!guide) return;
        state.editing.guides = id;
        qs('#guideTitle').value = guide.title || '';
        qs('#guideSlug').value = guide.slug || '';
        qs('#guideExcerpt').value = guide.excerpt || '';
        qs('#guideContent').value = guide.content || '';
        updateModePills();
    }

    function deleteGuide(id) {
        if (!confirm('Delete this guide?')) return;
        state.guides = state.guides.filter(g => g.id !== id);
        persistDataset('guides');
        renderGuides(state.guides);
        updateStats();
        toast('Guide deleted', 'error');
        resetGuideForm();
    }

    function resetGuideForm() {
        state.editing.guides = null;
        ['guideTitle','guideSlug','guideExcerpt','guideContent'].forEach(id => qs(`#${id}`).value = '');
        updateModePills();
    }

    // ====== Blog ======
    function bindBlog() {
        qs('#saveBlogBtn').addEventListener('click', saveBlog);
        qs('#cancelBlogEdit').addEventListener('click', () => resetBlogForm());
        qs('#blogTitle').addEventListener('input', (e) => {
            if (!state.editing.blog || !qs('#blogSlug').value.trim()) {
                qs('#blogSlug').value = slugify(e.target.value);
            }
        });
        qs('#blogSearch').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = state.blog.filter(b =>
                (b.title || '').toLowerCase().includes(q) ||
                (b.slug || '').toLowerCase().includes(q) ||
                (b.excerpt || '').toLowerCase().includes(q)
            );
            renderBlog(filtered);
        });
        qs('#blogReset').addEventListener('click', () => {
            qs('#blogSearch').value = '';
            renderBlog(state.blog);
        });
    }

    function renderBlog(data) {
        const container = qs('#blogTable');
        if (!container) return;
        if (!data.length) {
            container.innerHTML = '<p class="notice">No blog posts yet.</p>';
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Title</th><th>Slug</th><th>Excerpt</th><th></th></tr></thead>
                <tbody>
                    ${data.map(b => `
                        <tr>
                            <td>${b.title || ''}</td>
                            <td>${b.slug || ''}</td>
                            <td>${(b.excerpt || '').slice(0,60)}${(b.excerpt || '').length>60?'...':''}</td>
                            <td class="actions">
                                <button class="btn" data-edit-blog="${b.id}">Edit</button>
                                <button class="btn danger" data-delete-blog="${b.id}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        qsa('[data-edit-blog]').forEach(btn => btn.addEventListener('click', () => startBlogEdit(Number(btn.dataset.editBlog))));
        qsa('[data-delete-blog]').forEach(btn => btn.addEventListener('click', () => deleteBlog(Number(btn.dataset.deleteBlog))));
    }

    function collectBlogForm() {
        return {
            id: state.editing.blog || createId(),
            title: qs('#blogTitle').value.trim(),
            slug: qs('#blogSlug').value.trim(),
            excerpt: qs('#blogExcerpt').value.trim(),
            content: qs('#blogContent').value.trim()
        };
    }

    function validateBlog(b) {
        if (!b.title) return 'Title is required';
        if (!b.slug) return 'Slug is required';
        return null;
    }

    function saveBlog() {
        const blog = collectBlogForm();
        const error = validateBlog(blog);
        if (error) return toast(error, 'error');
        if (state.editing.blog) {
            state.blog = state.blog.map(b => b.id === blog.id ? blog : b);
        } else {
            state.blog.push(blog);
        }
        persistDataset('blog');
        renderBlog(state.blog);
        updateStats();
        toast('Blog post saved');
        resetBlogForm();
    }

    function startBlogEdit(id) {
        const blog = state.blog.find(b => b.id === id);
        if (!blog) return;
        state.editing.blog = id;
        qs('#blogTitle').value = blog.title || '';
        qs('#blogSlug').value = blog.slug || '';
        qs('#blogExcerpt').value = blog.excerpt || '';
        qs('#blogContent').value = blog.content || '';
        updateModePills();
    }

    function deleteBlog(id) {
        if (!confirm('Delete this post?')) return;
        state.blog = state.blog.filter(b => b.id !== id);
        persistDataset('blog');
        renderBlog(state.blog);
        updateStats();
        toast('Post deleted', 'error');
        resetBlogForm();
    }

    function resetBlogForm() {
        state.editing.blog = null;
        ['blogTitle','blogSlug','blogExcerpt','blogContent'].forEach(id => qs(`#${id}`).value = '');
        updateModePills();
    }

    // ====== Import / Export ======
    function bindImportExport() {
        const fileInput = qs('#importFile');
        const targetSelect = qs('#importTarget');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const json = JSON.parse(text);
                    const target = targetSelect.value;
                    if (!Array.isArray(json)) throw new Error('JSON must be an array');
                    state[target] = json.map(item => ({ id: item.id || createId(), ...item }));
                    persistDataset(target);
                    rerenderAll();
                    toast(`Imported ${json.length} ${target}`);
                } catch (err) {
                    toast('Failed to import: ' + err.message, 'error');
                } finally {
                    e.target.value = '';
                }
            });
        }
        const exportBtn = qs('#exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = state[state.activeSection];
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `zemora-${state.activeSection}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }
    }

    function rerenderAll() {
        renderTools(state.tools);
        renderGuides(state.guides);
        renderBlog(state.blog);
        updateStats();
        updateModePills();
    }

    function updateModePills() {
        const toolPill = qs('#toolModePill');
        const guidePill = qs('#guideModePill');
        const blogPill = qs('#blogModePill');
        if (toolPill) toolPill.textContent = 'Mode: ' + (state.editing.tools ? 'edit' : 'create');
        if (guidePill) guidePill.textContent = 'Mode: ' + (state.editing.guides ? 'edit' : 'create');
        if (blogPill) blogPill.textContent = 'Mode: ' + (state.editing.blog ? 'edit' : 'create');
    }

    // ====== Realtime sync (multi-tab) ======
    function bindRealtime() {
        if (channel) {
            channel.onmessage = (event) => {
                const { type, dataset, data, origin, ts } = event.data || {};
                if (type !== 'dataset:update' || origin === CLIENT_ID) return;
                if (!dataset || !Array.isArray(data)) return;
                state[dataset] = data;
                persist(storeKeys[dataset], data);
                rerenderAll();
                setSyncStatus(`Updated from peer @ ${new Date(ts || Date.now()).toLocaleTimeString()}`);
            };
        }

        window.addEventListener('storage', (e) => {
            const dataset = Object.keys(storeKeys).find(key => storeKeys[key] === e.key);
            if (!dataset) return;
            try {
                const data = JSON.parse(e.newValue || '[]');
                if (!Array.isArray(data)) return;
                state[dataset] = data;
                rerenderAll();
                setSyncStatus(`Storage sync @ ${new Date().toLocaleTimeString()}`);
            } catch (_) { /* ignore */ }
        });

        const forceRefresh = qs('#forceRefresh');
        if (forceRefresh) {
            forceRefresh.addEventListener('click', () => {
                ['tools','guides','blog'].forEach(ds => {
                    const stored = loadPersisted(storeKeys[ds]);
                    if (stored) state[ds] = stored;
                });
                rerenderAll();
                setSyncStatus('Refreshed from local storage');
            });
        }
    }

    // ====== Init ======
    document.addEventListener('DOMContentLoaded', bindAuth);
})();
