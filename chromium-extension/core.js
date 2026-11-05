(() => {
    const VERSION = '1.1.1';
    const DB_NAME = 'enketo';
    const ID_RE = /<((?:[\w-]+:)?instanceID)>([^<]*)<\/\1>/;
    const AUTOSAVE_PREFIX = '__autoSave';

    const req = (q) => new Promise((resolve, reject) => {
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
    });

    const txDone = (tx) => new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject((e && e.target && e.target.error) || tx.error);
        tx.onabort = () => reject(tx.error || new Error('The change was cancelled.'));
    });

    const friendly = (e) => {
        if (e && e.name === 'ConstraintError') {
            return new Error('A draft with that name already exists for this form. Choose a different name.');
        }
        return e instanceof Error ? e : new Error(String((e && e.message) || e || 'Unknown error'));
    };

    const uuid = () => {
        if (crypto.randomUUID) return crypto.randomUUID();
        const b = crypto.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    };

    const getEnketoId = (path = location.pathname) => {
        const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
        const id = trimmed.substring(trimmed.lastIndexOf('/') + 1);
        return id === 'preview' || id === 'i' || id === '' ? null : id;
    };

    const isFormPage = () => !!document.querySelector('form.or');

    const hasStore = (db, name) => db.objectStoreNames.contains(name);

    const withDb = async (fn) => {
        const db = await req(indexedDB.open(DB_NAME));
        try {
            return await fn(db);
        } finally {
            db.close();
        }
    };

    const requireRecords = (db) => {
        if (!hasStore(db, 'records')) throw new Error('No saved drafts were found on this page.');
    };

    const listDrafts = ({ includeAutoSave = false, includeXml = false } = {}) => {
        const enketoId = getEnketoId();
        if (!enketoId) return Promise.resolve([]);
        return withDb(async (db) => {
            if (!hasStore(db, 'records')) return [];
            const all = await req(
                db.transaction('records', 'readonly').objectStore('records').index('enketoId').getAll(IDBKeyRange.only(enketoId))
            );
            return all
                .filter((r) => includeAutoSave || !String(r.instanceId).startsWith(AUTOSAVE_PREFIX))
                .map((r) => {
                    const item = { instanceId: r.instanceId, name: r.name || '', updated: r.updated || 0, draft: !!r.draft };
                    if (includeXml) item.xml = r.xml || '';
                    return item;
                })
                .sort((a, b) => b.updated - a.updated);
        });
    };

    const getDraft = (instanceId) => withDb(async (db) => {
        requireRecords(db);
        const rec = await req(db.transaction('records', 'readonly').objectStore('records').get(instanceId));
        if (!rec) throw new Error('This draft no longer exists.');
        return rec;
    });

    const fixDraft = (instanceId, newName) => withDb(async (db) => {
        requireRecords(db);
        const tx = db.transaction('records', 'readwrite');
        const done = txDone(tx);
        const store = tx.objectStore('records');
        const rec = await req(store.get(instanceId));
        if (!rec) {
            await done;
            throw new Error('This draft no longer exists.');
        }
        if (!ID_RE.test(rec.xml || '')) {
            await done;
            throw new Error('The draft ID could not be found. Nothing was changed.');
        }
        const instanceID = 'uuid:' + uuid();
        rec.xml = rec.xml.replace(ID_RE, (m, tag) => `<${tag}>${instanceID}</${tag}>`);
        const name = String(newName || '').trim();
        if (name) rec.name = name;
        rec.updated = Date.now();
        store.put(rec);
        try {
            await done;
        } catch (e) {
            throw friendly(e);
        }
        return { instanceID };
    });

    const fileNameFor = (rec) => {
        const base = String(rec.name || 'draft').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 80) || 'draft';
        const date = new Date(rec.updated || Date.now()).toISOString().slice(0, 10);
        return `${base}_${date}.xml`;
    };

    const saveRecordAsFile = (rec) => {
        if (!rec || !rec.xml) throw new Error('This draft has no data to save.');
        const fileName = fileNameFor(rec);
        const url = URL.createObjectURL(new Blob([rec.xml], { type: 'application/xml' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return { fileName };
    };

    const downloadDraft = async (instanceId) => saveRecordAsFile(await getDraft(instanceId));

    const deleteDraft = (instanceId) => withDb(async (db) => {
        requireRecords(db);
        const stores = ['records', 'files'].filter((n) => hasStore(db, n));
        const tx = db.transaction(stores, 'readwrite');
        const done = txDone(tx);
        const records = tx.objectStore('records');
        const rec = await req(records.get(instanceId));
        if (rec) {
            records.delete(instanceId);
            if (Array.isArray(rec.files) && stores.includes('files')) {
                const files = tx.objectStore('files');
                rec.files.forEach((f) => {
                    const key = typeof f === 'string' ? f : f && f.name;
                    if (key) files.delete(`${instanceId}:${key}`);
                });
            }
        }
        await done;
        return { deleted: !!rec };
    });

    const clearFormCache = () => {
        const enketoId = getEnketoId();
        if (!enketoId) return Promise.resolve({ cleared: false });
        return withDb(async (db) => {
            const stores = ['surveys', 'resources'].filter((n) => hasStore(db, n));
            if (!stores.length) return { cleared: false };
            const tx = db.transaction(stores, 'readwrite');
            const done = txDone(tx);
            if (stores.includes('surveys')) tx.objectStore('surveys').delete(enketoId);
            if (stores.includes('resources')) {
                tx.objectStore('resources').delete(IDBKeyRange.bound(`${enketoId}:`, `${enketoId}:\uffff`));
            }
            await done;
            return { cleared: true };
        });
    };

    const fireEvents = (el) => {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new CustomEvent('inputupdate', { bubbles: true }));
    };

    const groupByRepeat = (matches) => {
        const groups = new Map();
        matches.forEach((el) => {
            const repeatEl = el.closest('.or-repeat') || document;
            if (!groups.has(repeatEl)) groups.set(repeatEl, []);
            groups.get(repeatEl).push(el);
        });
        return Array.from(groups.values());
    };

    const restoreFromXml = (xmlString, { skipFields = [], skipCalculated = true } = {}) => {
        const xmlDoc = new DOMParser().parseFromString(String(xmlString || ''), 'application/xml');
        if (xmlDoc.querySelector('parsererror') || !xmlDoc.documentElement) {
            throw new Error('The selected file is not a valid saved draft.');
        }

        const excludeSet = new Set(skipFields.map((n) => String(n).trim().toLowerCase()).filter(Boolean));
        const root = xmlDoc.documentElement;
        const valuesByPath = {};

        const walk = (node, path) => {
            const children = Array.from(node.children);
            if (!children.length) {
                (valuesByPath[path] = valuesByPath[path] || []).push(node.textContent || '');
                return;
            }
            children.forEach((child) => walk(child, `${path}/${child.tagName}`));
        };
        walk(root, `/${root.tagName}`);

        let filled = 0;
        const skipped = [];
        const calculatedSkipped = [];

        Object.keys(valuesByPath).forEach((path) => {
            const segments = path.split('/').filter(Boolean);
            if (segments.includes('meta')) return;
            const leafName = segments[segments.length - 1];
            if (leafName && excludeSet.has(leafName.toLowerCase())) return;

            const values = valuesByPath[path];
            const matches = Array.from(
                document.querySelectorAll(`[name="${CSS.escape(path)}"], [data-name="${CSS.escape(path)}"]`)
            );

            if (!matches.length) {
                skipped.push(path);
                return;
            }

            const first = matches[0];

            if (skipCalculated && first.hasAttribute('data-calculate')) {
                calculatedSkipped.push(path);
                return;
            }

            if (first.type === 'radio') {
                const groups = groupByRepeat(matches);
                values.forEach((value, i) => {
                    const group = groups[i];
                    if (!group) return;
                    const target = group.find((el) => el.value === value);
                    if (target) {
                        target.checked = true;
                        fireEvents(target);
                        filled += 1;
                    } else if (value) {
                        skipped.push(`${path} (option "${value}" not found)`);
                    }
                });
                return;
            }

            if (first.type === 'checkbox') {
                const groups = groupByRepeat(matches);
                values.forEach((value, i) => {
                    const group = groups[i];
                    if (!group) return;
                    const tokens = value.split(/\s+/).filter(Boolean);
                    let any = false;
                    group.forEach((el) => {
                        if (tokens.includes(el.value)) {
                            el.checked = true;
                            fireEvents(el);
                            any = true;
                        }
                    });
                    if (any) filled += 1;
                });
                return;
            }

            if (first.type === 'file') {
                skipped.push(`${path} (file upload cannot be restored automatically)`);
                return;
            }

            values.forEach((value, i) => {
                const el = matches[i];
                if (!el || !value) return;
                el.value = value;
                fireEvents(el);
                filled += 1;
            });
        });

        return { filled, skipped, calculatedSkipped };
    };

    window.EnketoToolkitCore = Object.freeze({
        version: VERSION,
        getEnketoId,
        isFormPage,
        listDrafts,
        getDraft,
        fixDraft,
        saveRecordAsFile,
        downloadDraft,
        deleteDraft,
        clearFormCache,
        restoreFromXml,
    });
})();
