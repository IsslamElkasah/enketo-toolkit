# Enketo Toolkit

Tools for Enketo forms, available as a browser extension for computers and as a bookmark for phones and tablets. Only works on the form page you have open.

It helps you save your data and avoid losing it when a draft gets stuck: you can save a copy of a draft as an XML file, rename and fix a stuck draft, and restore a saved draft onto a fresh form.

## What it does

- **Refresh Parent Data**\*: for dynamic data attachments, clears the cached parent data for the current form and reloads the page, so the form picks up the latest parent data. Extension only.
- **Saved Drafts**: lists the drafts saved for the current form. Each draft has **Rename/Fix** (for stuck submission errors like 401, 409), **Save a copy** (downloads it as an XML file) and **Delete**.
- **Choose a saved draft**: fills a fresh copy of the form from a draft saved with **Save a copy**. By default, calculated fields are skipped, and you can list extra field names to skip.

\* Kobo's documentation notes a "five-minute delay" in syncing new parent project data with the child project when collecting online ([Dynamic data attachments](https://support.kobotoolbox.org/dynamic_data_attachment.html)). A new parent record may not be available in the child form until then.

Drafts saved with **Save a copy** in the extension and in the bookmark are the same format, so a draft saved on a phone can be restored on a computer, and the other way round.

## Fixing a stuck draft

1. Use **Save a copy** on the draft first.
2. Use **Rename/Fix**. This usually clears the error.
3. If the draft is still stuck, **Delete** it, open a fresh copy of the form, and use **Choose a saved draft** to restore the file you saved.

## Install

### Chrome, Edge, Brave

1. Download this repository (**Code** > **Download ZIP**) and extract it.
2. Open the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `chromium-extension` folder.
5. Pin the extension from the puzzle-piece menu so it is always visible.

Keep the folder where it is. The browser loads the extension from it.

### Firefox

1. Download `firefox-extension/enketo-toolkit.xpi` from this repository.
2. Drag the file into a Firefox window, or open `about:addons`, click the gear icon, and choose **Install Add-on From File**.
3. Confirm the install.

### Phones and tablets (bookmark)

Mobile browsers such as Chrome on Android can't install extensions, so the toolkit is also available as a bookmark that opens a panel on the form.

Open the setup page on your phone and follow the steps: [Enketo Toolkit - Bookmark Setup](https://isslamelkasah.github.io/enketo-toolkit/)

The bookmark also works in desktop browsers.

## Use

### Extension

1. Open the Enketo form you want to work on.
2. Click the extension icon.
3. Pick an action: **Refresh Parent Data**, a draft's **Rename/Fix**, **Save a copy** or **Delete**, or **Choose a saved draft** to restore a saved draft.

### Bookmark

1. Open the Enketo form you want to work on.
2. On Android, tap the address bar, type **Enketo**, and tap the **Enketo Toolkit** suggestion with the star icon. On a computer, click the bookmark.
3. Pick an action: a draft's **Rename/Fix**, **Save a copy** or **Delete**, or **Choose a saved draft** to restore a saved draft.

## Update

- **Chrome, Edge, Brave**: download the repository again, replace the contents of your `chromium-extension` folder with the new files, then click the reload icon on the extension's card in the extensions page. Or simply remove the old extension and follow the same steps above.
- **Firefox**: install the new `.xpi` the same way as before.
- **Bookmark**: nothing to do. It always loads the latest version.

## Repository layout

- `chromium-extension/`: the extension. `core.js` holds the draft logic shared by the extension and the bookmark.
- `firefox-extension/`: the signed Firefox build.
- `bookmarklet/toolkit.js`: the bookmark panel.
- `docs/`: the bookmark setup page.
