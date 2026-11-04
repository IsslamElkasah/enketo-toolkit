(() => {
    const VERSION = '1.0.0';
    const HOST_ID = 'enketo-toolkit-panel';
    const existing = document.getElementById(HOST_ID);
    if (existing) { existing.remove(); return; }
    if (!document.querySelector('form.or')) { alert('Enketo Toolkit: open an Enketo form first.'); return; }

    const ID_RE = /<((?:[\w-]+:)?instanceID)>([^<]*)<\/\1>/;
    const enketoId = location.pathname.replace(/\/$/, '').split('/').pop();
    const req = q => new Promise((r, j) => { q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });

    const openDb = async () => {
        const db = await req(indexedDB.open('enketo'));
        if (!db.objectStoreNames.contains('records')) { db.close(); throw new Error('No saved drafts storage found on this page.'); }
        return db;
    };

    const getDrafts = async () => {
        const db = await openDb();
        try {
            const all = await req(db.transaction('records', 'readonly').objectStore('records').index('enketoId').getAll(IDBKeyRange.only(enketoId)));
            return all.filter(x => !String(x.instanceId).startsWith('__autoSave')).sort((a, b) => (b.updated || 0) - (a.updated || 0));
        } finally { db.close(); }
    };

    const fixDraft = async (key, newName) => {
        const db = await openDb();
        try {
            const tx = db.transaction('records', 'readwrite');
            const done = new Promise((r, j) => { tx.oncomplete = r; tx.onerror = () => j(tx.error); tx.onabort = () => j(tx.error); });
            const store = tx.objectStore('records');
            const rec = await req(store.get(key));
            if (!rec) throw new Error('This draft no longer exists.');
            if (!ID_RE.test(rec.xml)) throw new Error('Could not find the draft ID. Nothing was changed.');
            const fresh = 'uuid:' + crypto.randomUUID();
            rec.xml = rec.xml.replace(ID_RE, (m, t) => '<' + t + '>' + fresh + '</' + t + '>');
            rec.name = newName || rec.name;
            rec.updated = Date.now();
            await req(store.put(rec));
            await done;
        } finally { db.close(); }
    };

    const saveCopy = rec => {
        const safe = (rec.name || 'draft').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'draft';
        const date = new Date(rec.updated || Date.now()).toISOString().slice(0, 10);
        const url = URL.createObjectURL(new Blob([rec.xml], { type: 'application/xml' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = safe + '_' + date + '.xml';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    const host = document.createElement('div');
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
<style>
:host { all: initial; }
.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 2147483647; display: flex; align-items: flex-start; justify-content: center; padding-top: 6vh; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.panel { --bg: #fff; --fg: #1d1d1f; --muted: #6b6b70; --line: #e4e4e8; --accent: #1f6feb; --danger: #c62828; --ok: #2e7d32; background: var(--bg); color: var(--fg); width: calc(100% - 24px); max-width: 480px; max-height: 85vh; overflow: auto; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
@media (prefers-color-scheme: dark) { .panel { --bg: #1e1e20; --fg: #f2f2f4; --muted: #a0a0a8; --line: #333338; --accent: #5b9dff; --danger: #ff6b6b; --ok: #66bb6a; } }
.head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--bg); }
.title { font-size: 17px; font-weight: 600; }
.ver { font-size: 12px; color: var(--muted); margin-left: 6px; font-weight: 400; }
.close { border: 0; background: transparent; color: var(--fg); font-size: 26px; line-height: 1; width: 44px; height: 44px; cursor: pointer; }
.body { padding: 8px 16px 16px; }
.msg { padding: 16px 0; color: var(--muted); font-size: 15px; }
.item { padding: 12px 0; border-bottom: 1px solid var(--line); }
.item:last-child { border-bottom: 0; }
.name { font-size: 16px; font-weight: 600; word-break: break-word; }
.meta { font-size: 13px; color: var(--muted); margin: 4px 0 10px; }
.actions { display: flex; gap: 8px; }
.btn { flex: 1; min-height: 44px; border-radius: 10px; border: 1px solid var(--line); background: transparent; color: var(--fg); font-size: 15px; font-weight: 500; cursor: pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn:disabled { opacity: .5; }
.status { font-size: 14px; padding: 10px 16px; border-top: 1px solid var(--line); display: none; }
.status.show { display: block; }
.status.err { color: var(--danger); }
.status.ok { color: var(--ok); }
</style>
<div class="backdrop">
<div class="panel" role="dialog" aria-label="Enketo Toolkit">
<div class="head"><div class="title">Enketo Toolkit<span class="ver">v${VERSION}</span></div><button class="close" aria-label="Close">×</button></div>
<div class="body"><div class="msg">Loading drafts...</div></div>
<div class="status"></div>
</div>
</div>`;

    const backdrop = root.querySelector('.backdrop');
    const body = root.querySelector('.body');
    const statusEl = root.querySelector('.status');
    const close = () => host.remove();
    root.querySelector('.close').onclick = close;
    backdrop.onclick = e => { if (e.target === backdrop) close(); };

    const setStatus = (text, kind) => {
        statusEl.textContent = text;
        statusEl.className = 'status show' + (kind ? ' ' + kind : '');
    };

    const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    };

    const render = async () => {
        body.textContent = '';
        body.appendChild(el('div', 'msg', 'Loading drafts...'));
        let drafts;
        try { drafts = await getDrafts(); } catch (e) { body.textContent = ''; body.appendChild(el('div', 'msg', e.message)); return; }
        body.textContent = '';
        if (!drafts.length) { body.appendChild(el('div', 'msg', 'No saved drafts for this form.')); return; }
        drafts.forEach(rec => {
            const item = el('div', 'item');
            const name = el('div', 'name', rec.name || '(no name)');
            name.dir = 'auto';
            const state = rec.draft ? 'Saved draft' : 'Waiting to upload';
            const when = rec.updated ? new Date(rec.updated).toLocaleString() : '';
            const meta = el('div', 'meta', state + (when ? ' · ' + when : ''));
            const actions = el('div', 'actions');
            const fixBtn = el('button', 'btn primary', 'Fix');
            const saveBtn = el('button', 'btn', 'Save copy');
            fixBtn.onclick = async () => {
                const newName = prompt('Name for this draft:', rec.name || '');
                if (newName === null) return;
                if (!confirm('Fix this draft? The page will reload.')) return;
                fixBtn.disabled = saveBtn.disabled = true;
                try {
                    await fixDraft(rec.instanceId, newName.trim());
                    setStatus('Draft fixed. Reloading...', 'ok');
                    setTimeout(() => location.reload(), 900);
                } catch (e) {
                    setStatus(e.message, 'err');
                    fixBtn.disabled = saveBtn.disabled = false;
                }
            };
            saveBtn.onclick = () => {
                try { saveCopy(rec); setStatus('Copy saved to Downloads.', 'ok'); } catch (e) { setStatus(e.message, 'err'); }
            };
            actions.append(fixBtn, saveBtn);
            item.append(name, meta, actions);
            body.appendChild(item);
        });
    };

    document.body.appendChild(host);
    render();
})();