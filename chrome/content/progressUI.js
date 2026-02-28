/**
 * LitGap - Progress UI Module
 * Non-blocking floating progress panel injected into Zotero's main window DOM
 *
 * @module progressUI
 * @version 2.0.5
 *
 * Shared between Feature 1 (Find Hidden Papers) and Feature 2 (KGM).
 *
 * CHANGELOG v2.0.5:
 *   - Fixed: innerHTML also throws "An invalid or illegal string was specified"
 *     in Zotero 8 XUL/XHTML mixed namespace context. Replaced ALL innerHTML
 *     assignments with textContent. Newlines in messages now render as " | "
 *     instead of <br> — acceptable tradeoff for stability.
 *
 * CHANGELOG v2.0.4:
 *   - Fixed (root cause): Removed ALL querySelector() calls.
 *     In Zotero 8's XUL/XHTML mixed-namespace document, querySelector()
 *     throws "An invalid or illegal string was specified" when called on
 *     elements created via doc.createElement() (which carry the XHTML
 *     namespace). Fix: build the DOM element-by-element and store direct
 *     references (_titleEl, _msgEl, _barEl, _pctEl) on the object.
 *     update() / showComplete() / show() all use these refs directly.
 *   - Fixed: injection target is document.documentElement so that
 *     position:fixed resolves to the viewport, not the XUL window origin.
 *   - Simplified: all style mutations use setAttribute('style', ...) —
 *     single reliable path, no try/catch needed.
 *
 * Public API:
 *   ProgressUI.show(title)
 *   ProgressUI.update(message, percent)
 *   ProgressUI.hide()
 *   ProgressUI.showComplete(message)
 */

var ProgressUI = {

  // Panel root element
  _panel:   null,
  // Direct references to inner elements — NO querySelector ever used
  _titleEl: null,
  _msgEl:   null,
  _barEl:   null,
  _pctEl:   null,

  _hideTimer: null,

  // ─── Public API ────────────────────────────────────────────────────────────

  show: function(title) {
    try {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }

      // Re-use existing panel
      if (this._panel) {
        if (this._titleEl) this._titleEl.textContent = title || 'LitGap';
        this._panel.setAttribute('style', this._panelCSS('#1F3864'));
        this._resetBar();
        return;
      }

      const doc = this._getDocument();
      if (!doc) {
        Zotero.debug('ProgressUI: show() — cannot get document');
        return;
      }

      // ── Build DOM element-by-element (no innerHTML, no querySelector) ──────

      // Title span
      const titleEl = doc.createElement('span');
      titleEl.textContent = title || 'LitGap';
      titleEl.setAttribute('style',
        'font-weight:bold;font-size:13px;color:#ffffff;'
      );

      // Percent label
      const pctEl = doc.createElement('span');
      pctEl.textContent = '0%';
      pctEl.setAttribute('style',
        'font-size:11px;color:#aaccff;margin-left:12px;'
      );

      // Header row
      const headerRow = doc.createElement('div');
      headerRow.setAttribute('style',
        'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'
      );
      headerRow.appendChild(titleEl);
      headerRow.appendChild(pctEl);

      // Message area
      const msgEl = doc.createElement('div');
      msgEl.setAttribute('style',
        'font-size:12px;color:#cce0ff;line-height:1.5;' +
        'min-height:32px;margin-bottom:10px;word-break:break-word;'
      );

      // Progress bar fill
      const barEl = doc.createElement('div');
      barEl.setAttribute('style',
        'width:0%;height:100%;background:#4a9eff;' +
        'border-radius:4px;transition:width 0.3s ease;'
      );

      // Progress bar track
      const trackEl = doc.createElement('div');
      trackEl.setAttribute('style',
        'background:rgba(255,255,255,0.2);border-radius:4px;height:6px;overflow:hidden;'
      );
      trackEl.appendChild(barEl);

      // Panel root
      const panel = doc.createElement('div');
      panel.setAttribute('style', this._panelCSS('#1F3864'));
      panel.appendChild(headerRow);
      panel.appendChild(msgEl);
      panel.appendChild(trackEl);

      // Inject into documentElement (correct anchor for position:fixed in Zotero 8)
      doc.documentElement.appendChild(panel);

      // Store direct references — used by update() / showComplete() / hide()
      this._panel   = panel;
      this._titleEl = titleEl;
      this._msgEl   = msgEl;
      this._barEl   = barEl;
      this._pctEl   = pctEl;

      Zotero.debug('ProgressUI: Panel shown — ' + title);
    } catch (e) {
      Zotero.debug('ProgressUI: show() failed — ' + e.message);
    }
  },

  update: function(message, percent) {
    try {
      if (!this._panel) return;

      if (this._msgEl) {
        // textContent only — innerHTML throws in Zotero 8 XUL/XHTML context
        this._msgEl.textContent = (message || '').replace(/\n/g, ' | ');
      }

      const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));

      if (this._barEl) {
        this._barEl.setAttribute('style',
          'width:' + pct + '%;height:100%;background:#4a9eff;' +
          'border-radius:4px;transition:width 0.3s ease;'
        );
      }

      if (this._pctEl) this._pctEl.textContent = pct + '%';

    } catch (e) {
      Zotero.debug('ProgressUI: update() failed — ' + e.message);
    }
  },

  hide: function() {
    try {
      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
      if (this._panel && this._panel.parentNode) {
        this._panel.parentNode.removeChild(this._panel);
      }
      this._panel   = null;
      this._titleEl = null;
      this._msgEl   = null;
      this._barEl   = null;
      this._pctEl   = null;
      Zotero.debug('ProgressUI: Panel hidden');
    } catch (e) {
      Zotero.debug('ProgressUI: hide() failed — ' + e.message);
    }
  },

  showComplete: function(message) {
    try {
      if (!this._panel) this.show('LitGap');
      if (!this._panel) return;

      // Switch panel to green
      this._panel.setAttribute('style', this._panelCSS('#1a5c2a'));

      if (this._titleEl) this._titleEl.textContent = '\u2713 Complete';
      if (this._msgEl)   this._msgEl.textContent = message || 'Done!';
      if (this._barEl) {
        this._barEl.setAttribute('style',
          'width:100%;height:100%;background:#4caf50;border-radius:4px;'
        );
      }
      if (this._pctEl) this._pctEl.textContent = '100%';

      Zotero.debug('ProgressUI: showComplete — ' + message);
      this._hideTimer = setTimeout(() => { this.hide(); }, 4000);
    } catch (e) {
      Zotero.debug('ProgressUI: showComplete() failed — ' + e.message);
    }
  },

  // ─── Internal helpers ──────────────────────────────────────────────────────

  _resetBar: function() {
    if (this._barEl) {
      this._barEl.setAttribute('style',
        'width:0%;height:100%;background:#4a9eff;' +
        'border-radius:4px;transition:width 0.3s ease;'
      );
    }
    if (this._msgEl) this._msgEl.textContent = '';
    if (this._pctEl) this._pctEl.textContent = '0%';
  },

  _getDocument: function() {
    try {
      const win = Zotero.getMainWindow();
      if (win && win.document) return win.document;
    } catch (e) {
      Zotero.debug('ProgressUI: Cannot get main window — ' + e.message);
    }
    return null;
  },

  /**
   * Build panel root style string.
   * @param {string} bgColor   CSS colour
   * @param {string} [display] 'block'|'none' (default 'block')
   */
  _panelCSS: function(bgColor, display) {
    return 'position:fixed;bottom:24px;right:24px;width:320px;' +
      'background:' + (bgColor || '#1F3864') + ';' +
      'color:white;border-radius:10px;padding:16px 18px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;' +
      'font-size:13px;z-index:99999;' +
      'box-shadow:0 6px 20px rgba(0,0,0,0.35);' +
      'display:' + (display || 'block') + ';' +
      'transition:background 0.4s ease;';
  },

  _esc: function(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
};
