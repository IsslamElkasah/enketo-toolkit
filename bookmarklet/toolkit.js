(() => {
    const VERSION = '1.1.0';
    const HOST_ID = 'enketo-toolkit-panel';
    const FALLBACK_CORE = 'https://cdn.jsdelivr.net/gh/IsslamElkasah/enketo-toolkit@main/chromium-extension/core.js';
    const selfSrc = document.currentScript && document.currentScript.src;
    const existing = document.getElementById(HOST_ID);
    if (existing) { existing.remove(); return; }
    if (!document.querySelector('form.or')) { alert('Enketo Toolkit: open an Enketo form first.'); return; }

    const coreUrl = () => {
        try { return selfSrc ? new URL('../chromium-extension/core.js', selfSrc).href : FALLBACK_CORE; } catch (e) { return FALLBACK_CORE; }
    };

    const loadCore = () => new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = coreUrl() + '?t=' + Date.now();
        s.onload = () => window.EnketoToolkitCore ? resolve(window.EnketoToolkitCore) : reject(new Error('Enketo Toolkit could not start.'));
        s.onerror = () => reject(new Error('Enketo Toolkit could not load. Check your connection.'));
        document.head.appendChild(s);
    });

    const host = document.createElement('div');
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
<style>
:host { all: initial; }
.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 2147483647; display: flex; align-items: flex-start; justify-content: center; padding-top: 4vh; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.panel { --bg: #fff; --fg: #1d1d1f; --muted: #6b6b70; --line: #e4e4e8; --soft: #f3f4f6; --accent: #1f6feb; --danger: #c62828; --ok: #2e7d32; background: var(--bg); color: var(--fg); width: calc(100% - 24px); max-width: 480px; max-height: 90vh; overflow: auto; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
@media (prefers-color-scheme: dark) { .panel { --bg: #1e1e20; --fg: #f2f2f4; --muted: #a0a0a8; --line: #333338; --soft: #2a2a2e; --accent: #5b9dff; --danger: #ff6b6b; --ok: #66bb6a; } }
.head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--bg); z-index: 1; }
.title { font-size: 17px; font-weight: 600; }
.ver { font-size: 12px; color: var(--muted); margin-left: 6px; font-weight: 400; }
.close { border: 0; background: transparent; color: var(--fg); font-size: 26px; line-height: 1; width: 44px; height: 44px; cursor: pointer; }
.section { padding: 8px 16px 16px; }
.section + .section { border-top: 1px solid var(--line); }
h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 10px 0 4px; }
.msg { padding: 12px 0; color: var(--muted); font-size: 15px; }
.item { padding: 12px 0; border-bottom: 1px solid var(--line); }
.item:last-child { border-bottom: 0; }
.name { font-size: 16px; font-weight: 600; word-break: break-word; }
.meta { font-size: 13px; color: var(--muted); margin: 4px 0 10px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn { flex: 1 1 0; min-width: 90px; min-height: 44px; border-radius: 10px; border: 1px solid var(--line); background: transparent; color: var(--fg); font-size: 15px; font-weight: 500; cursor: pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.danger { color: var(--danger); border-color: var(--danger); }
.btn.wide { width: 100%; flex: none; }
.btn:disabled { opacity: .5; }
.hint { font-size: 14px; color: var(--muted); margin: 4px 0 12px; line-height: 1.45; }
.check { display: flex; align-items: center; gap: 10px; font-size: 15px; margin: 8px 0; }
.check input { width: 20px; height: 20px; margin: 0; }
label.field { display: block; font-size: 14px; color: var(--muted); margin: 10px 0 4px; }
input.text { width: 100%; box-sizing: border-box; min-height: 44px; padding: 8px 10px; font-size: 15px; border: 1px solid var(--line); border-radius: 10px; background: var(--soft); color: var(--fg); margin-bottom: 12px; }
.result { font-size: 14px; margin-top: 12px; }
.result.ok { color: var(--ok); }
.result.err { color: var(--danger); }
details { margin-top: 6px; color: var(--fg); }
details ul { margin: 6px 0 0; padding-left: 20px; color: var(--muted); word-break: break-word; }
.status { font-size: 14px; padding: 10px 16px; border-top: 1px solid var(--line); display: none; position: sticky; bottom: 0; background: var(--bg); }
.status.show { display: block; }
.status.err { color: var(--danger); }
.status.ok { color: var(--ok); }
</style>
<div class="backdrop">
<div class="panel" role="dialog" aria-label="Enketo Toolkit">
<div class="head"><div class="title">Enketo Toolkit<span class="ver">v${VERSION}</span></div><button class="close" aria-label="Close">×</button></div>
<div class="section">
<h3>Saved drafts</h3>
<div class="list"><div class="msg">Loading...</div></div>
</div>
<div class="section">
<h3>Restore from saved copy</h3>
<p class="hint">Open a new, empty copy of this form first. Then choose a copy you saved with Save copy. Photos and file uploads are not restored.</p>
<label class="check"><input type="checkbox" class="calc" checked>Skip calculated fields (recommended)</label>
<label class="field" for="skip">Also skip these fields (optional, separate with commas)</label>
<input class="text skip" id="skip" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
<button class="btn primary wide choose" type="button">Choose saved copy...</button>
<input class="file" type="file" accept=".xml,text/xml,application/xml" hidden>
<div class="result"></div>
</div>
<div class="status"></div>
</div>
</div>`;

    const $ = (sel) => root.querySelector(sel);
    const backdrop = $('.backdrop');
    const list = $('.list');
    const statusEl = $('.status');
    const chooseBtn = $('.choose');
    const fileInput = $('.file');
    const calcBox = $('.calc');
    const skipInput = $('.skip');
    const resultEl = $('.result');

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { document.removeEventListener('keydown', onKey, true); host.remove(); };
    $('.close').onclick = close;
    backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
    document.addEventListener('keydown', onKey, true);

    const setStatus = (text, kind) => {
        statusEl.textContent = text;
        statusEl.className = 'status show' + (kind ? ' ' + kind : '');
    };

    const reloadSoon = (text) => {
        setStatus(text, 'ok');
        setTimeout(() => location.reload(), 900);
    };

    const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    };

    const showMessage = (text) => {
        list.textContent = '';
        list.appendChild(el('div', 'msg', text));
    };

    const renderDrafts = async (core) => {
        showMessage('Loading...');
        let drafts;
        try { drafts = await core.listDrafts({ includeXml: true }); } catch (e) { showMessage(e.message); return; }
        if (!drafts.length) { showMessage('No saved drafts for this form.'); return; }
        list.textContent = '';
        drafts.forEach((d) => {
            const item = el('div', 'item');
            const name = el('div', 'name', d.name || '(no name)');
            name.dir = 'auto';
            const state = d.draft ? 'Saved draft' : 'Waiting to upload';
            const when = d.updated ? new Date(d.updated).toLocaleString() : '';
            const meta = el('div', 'meta', state + (when ? ' · ' + when : ''));
            const actions = el('div', 'actions');
            const fixBtn = el('button', 'btn primary', 'Fix');
            const saveBtn = el('button', 'btn', 'Save copy');
            const delBtn = el('button', 'btn danger', 'Delete');
            const lock = (on) => [fixBtn, saveBtn, delBtn].forEach((b) => { b.disabled = on; });

            fixBtn.onclick = async () => {
                const newName = prompt('Name for this draft:', d.name || '');
                if (newName === null) return;
                if (!confirm('Fix this draft? The page will reload.')) return;
                lock(true);
                try {
                    await core.fixDraft(d.instanceId, newName);
                    reloadSoon('Draft fixed. Reloading...');
                } catch (e) {
                    setStatus(e.message, 'err');
                    lock(false);
                }
            };

            saveBtn.onclick = () => {
                try {
                    const r = core.saveRecordAsFile(d);
                    setStatus('Saved ' + r.fileName + ' to Downloads.', 'ok');
                } catch (e) {
                    setStatus(e.message, 'err');
                }
            };

            delBtn.onclick = async () => {
                if (!confirm('Delete "' + (d.name || 'this draft') + '"?\n\nSave a copy first if you may need it. This cannot be undone.')) return;
                lock(true);
                try {
                    await core.deleteDraft(d.instanceId);
                    reloadSoon('Draft deleted. Reloading...');
                } catch (e) {
                    setStatus(e.message, 'err');
                    lock(false);
                }
            };

            actions.append(fixBtn, saveBtn, delBtn);
            item.append(name, meta, actions);
            list.appendChild(item);
        });
    };

    const showResult = (res) => {
        resultEl.textContent = '';
        resultEl.className = 'result ok';
        let text = 'Restored ' + res.filled + ' field(s).';
        if (res.calculatedSkipped.length) text += ' ' + res.calculatedSkipped.length + ' calculated field(s) left as they are.';
        if (res.skipped.length) text += ' ' + res.skipped.length + ' field(s) could not be restored. Check them before saving.';
        resultEl.appendChild(el('div', '', text));
        if (res.skipped.length) {
            const details = el('details');
            details.appendChild(el('summary', '', 'Show fields not restored'));
            const ul = el('ul');
            res.skipped.forEach((p) => ul.appendChild(el('li', '', p.split('/').filter(Boolean).slice(1).join(' / ') || p)));
            details.appendChild(ul);
            resultEl.appendChild(details);
        }
    };

    const setupRestore = (core) => {
        chooseBtn.onclick = () => fileInput.click();
        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            if (!file) return;
            chooseBtn.disabled = true;
            chooseBtn.textContent = 'Restoring...';
            resultEl.textContent = '';
            try {
                const xml = await file.text();
                showResult(core.restoreFromXml(xml, { skipFields: skipInput.value.split(','), skipCalculated: calcBox.checked }));
            } catch (e) {
                resultEl.className = 'result err';
                resultEl.textContent = e.message;
            }
            chooseBtn.disabled = false;
            chooseBtn.textContent = 'Choose saved copy...';
            fileInput.value = '';
        };
    };

    chooseBtn.disabled = true;
    document.body.appendChild(host);

    loadCore()
        .then((core) => {
            chooseBtn.disabled = false;
            setupRestore(core);
            return renderDrafts(core);
        })
        .catch((e) => showMessage(e.message));
})();