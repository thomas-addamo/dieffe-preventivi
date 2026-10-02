import { BrowserWindow, Menu, clipboard, shell, type MenuItemConstructorOptions } from 'electron';
import { isDev, isMac } from './config';

// Menu contestuale nativo (tasto destro / ctrl+clic), come in Safari o Note:
// correzione ortografica, taglia/copia/incolla, "Cerca", link e immagini.

export function attachContextMenu(win: BrowserWindow) {
  win.webContents.on('context-menu', (_event, p) => {
    const items: MenuItemConstructorOptions[] = [];
    const sep = () => {
      if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' });
    };

    // Suggerimenti ortografici sulla parola sottolineata
    if (p.misspelledWord) {
      for (const s of p.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) });
      }
      if (p.dictionarySuggestions.length === 0) items.push({ label: 'Nessun suggerimento', enabled: false });
      items.push({
        label: 'Impara ortografia',
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord),
      });
      sep();
    }

    const text = p.selectionText.trim();
    if (text && isMac) {
      const short = text.length > 24 ? `${text.slice(0, 24)}…` : text;
      items.push({ label: `Cerca “${short}”`, click: () => win.webContents.showDefinitionForSelection() });
      sep();
    }

    if (p.linkURL) {
      items.push(
        { label: 'Apri link nel browser', click: () => shell.openExternal(p.linkURL) },
        { label: 'Copia link', click: () => clipboard.writeText(p.linkURL) }
      );
      sep();
    }

    if (p.mediaType === 'image' && p.srcURL) {
      items.push(
        { label: 'Copia immagine', click: () => win.webContents.copyImageAt(p.x, p.y) },
        { label: 'Apri immagine nel browser', click: () => shell.openExternal(p.srcURL) }
      );
      sep();
    }

    if (p.isEditable) {
      items.push(
        { role: 'cut', label: 'Taglia', enabled: p.editFlags.canCut },
        { role: 'copy', label: 'Copia', enabled: p.editFlags.canCopy },
        { role: 'paste', label: 'Incolla', enabled: p.editFlags.canPaste },
        { role: 'selectAll', label: 'Seleziona tutto', enabled: p.editFlags.canSelectAll }
      );
    } else if (text) {
      items.push({ role: 'copy', label: 'Copia' });
    }

    if (isDev) {
      sep();
      items.push({ label: 'Ispeziona elemento', click: () => win.webContents.inspectElement(p.x, p.y) });
    }

    while (items.length && items[items.length - 1].type === 'separator') items.pop();
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
}
