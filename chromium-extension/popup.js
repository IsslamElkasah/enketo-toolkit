const refreshBtn = document.getElementById('refreshBtn');
const statusDiv = document.getElementById('status');
const draftsList = document.getElementById('draftsList');
const importBtn = document.getElementById('importBtn');
const importFileInput = document.getElementById('importFileInput');
const excludeFieldsInput = document.getElementById('excludeFieldsInput');
const skipCalculatedInput = document.getElementById('skipCalculatedInput');

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function runCore(tabId, method, args = []) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['core.js'],
  });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (m, a) => {
      try {
        return { ok: true, value: await window.EnketoToolkitCore[m](...a) };
      } catch (e) {
        return { ok: false, error: (e && e.message) || String(e) };
      }
    },
    args: [method, args],
  });
  if (!result) throw new Error('No response from the page. Make sure an Enketo form is open.');
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleString();
}

function showDraftsMessage(text) {
  draftsList.textContent = '';
  const div = document.createElement('div');
  div.id = 'noDrafts';
  div.textContent = text;
  draftsList.appendChild(div);
}

async function loadDrafts() {
  showDraftsMessage('Loading...');

  try {
    const tab = await getActiveTab();
    const drafts = await runCore(tab.id, 'listDrafts');
    renderDrafts(drafts || [], tab.id);
  } catch (err) {
    showDraftsMessage('Could not load drafts: ' + err.message);
  }
}

function renderDrafts(drafts, tabId) {
  if (!drafts.length) {
    showDraftsMessage('No saved drafts for this form.');
    return;
  }

  draftsList.textContent = '';

  drafts.forEach((draft) => {
    const row = document.createElement('div');
    row.className = 'draft-row';

    const info = document.createElement('div');
    info.className = 'draft-info';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'draft-name';
    nameDiv.dir = 'auto';
    nameDiv.textContent = draft.name || '(unnamed)';
    const dateDiv = document.createElement('div');
    dateDiv.className = 'draft-date';
    dateDiv.textContent = (draft.draft ? '' : 'Waiting to upload · ') + formatDate(draft.updated);
    info.appendChild(nameDiv);
    info.appendChild(dateDiv);

    const actions = document.createElement('div');
    actions.className = 'draft-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'rename-btn';
    renameBtn.textContent = 'Rename/Fix';
    renameBtn.addEventListener('click', async () => {
      const newName = prompt(
        'New name for this draft.\n',
        draft.name || ''
      );
      if (newName === null) return;
      const trimmed = newName.trim();
      if (!trimmed) {
        alert('Name cannot be empty.');
        return;
      }

      renameBtn.disabled = true;
      try {
        await runCore(tabId, 'fixDraft', [draft.instanceId, trimmed]);
        await chrome.tabs.reload(tabId);
        window.close();
      } catch (err) {
        alert('Rename failed: ' + err.message);
        renameBtn.disabled = false;
      }
    });

    const exportBtn = document.createElement('button');
    exportBtn.className = 'export-btn';
    exportBtn.textContent = 'Save a copy';
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      try {
        await runCore(tabId, 'downloadDraft', [draft.instanceId]);
      } catch (err) {
        alert('Save a copy failed: ' + err.message);
      }
      exportBtn.disabled = false;
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      const confirmed = confirm(`Delete draft "${draft.name || draft.instanceId}"? This cannot be undone.`);
      if (!confirmed) return;

      deleteBtn.disabled = true;
      try {
        await runCore(tabId, 'deleteDraft', [draft.instanceId]);
        await chrome.tabs.reload(tabId);
        window.close();
      } catch (err) {
        alert('Delete failed: ' + err.message);
        deleteBtn.disabled = false;
      }
    });

    actions.appendChild(renameBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(deleteBtn);
    row.appendChild(info);
    row.appendChild(actions);
    draftsList.appendChild(row);
  });
}

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  statusDiv.textContent = 'Clearing cached data...';

  try {
    const tab = await getActiveTab();
    await runCore(tab.id, 'clearFormCache');
    await chrome.tabs.reload(tab.id);
    statusDiv.textContent = 'Done. Page is reloading...';
    setTimeout(() => window.close(), 1200);
  } catch (err) {
    statusDiv.textContent = 'Error: ' + err.message;
    refreshBtn.disabled = false;
  }
});

importBtn.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files[0];
  if (!file) return;

  importBtn.disabled = true;
  importBtn.textContent = 'Restoring...';

  try {
    const xmlString = await file.text();
    const skipFields = (excludeFieldsInput.value || '').split(',');
    const skipCalculated = skipCalculatedInput.checked;
    const tab = await getActiveTab();
    const result = await runCore(tab.id, 'restoreFromXml', [xmlString, { skipFields, skipCalculated }]);

    let msg = `Restored ${result.filled} field(s).`;
    if (result.calculatedSkipped && result.calculatedSkipped.length > 0) {
      msg += ` ${result.calculatedSkipped.length} calculated field(s) left as-is.`;
    }
    if (result.skipped.length > 0) {
      msg += ` ${result.skipped.length} field(s) could not be restored.`;
    }
    alert(msg);
  } catch (err) {
    alert('Restore failed: ' + err.message);
  }

  importBtn.disabled = false;
  importBtn.textContent = 'Choose a saved draft';
  importFileInput.value = '';
});

loadDrafts();
