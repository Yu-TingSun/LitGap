/**
 * LitGap - Overlay for Zotero 7.x
 */

(function() {
  'use strict';
  
  // 立即輸出 debug 訊息確認載入
  if (typeof Zotero !== 'undefined') {
    Zotero.debug('[LitGap Overlay] ===== LOADING =====');
  }
  
  window.LitGapOverlay = {
    init() {
      Zotero.debug('[LitGap Overlay] Initializing...');
      
      // 等待 window 完全載入
      if (document.readyState === 'complete') {
        this.addMenuItem();
      } else {
        window.addEventListener('load', () => {
          this.addMenuItem();
        }, { once: true });
      }
    },
    
    addMenuItem() {
      Zotero.debug('[LitGap Overlay] Adding menu item...');
      
      try {
        // 尋找 collection context menu
        const collectionMenu = document.getElementById('zotero-collectionmenu');
        
        if (!collectionMenu) {
          Zotero.debug('[LitGap Overlay] ERROR: Collection menu not found!');
          // 列出所有可能的選單
          const menus = document.querySelectorAll('menupopup[id*="menu"]');
          Zotero.debug(`[LitGap Overlay] Found ${menus.length} menus:`);
          menus.forEach(m => Zotero.debug(`  - ${m.id}`));
          return;
        }
        
        Zotero.debug('[LitGap Overlay] Collection menu found!');
        
        // 檢查是否已經添加過
        if (document.getElementById('litgap-analyze')) {
          Zotero.debug('[LitGap Overlay] Menu item already exists');
          return;
        }
        
        // 創建分隔線
        const separator = document.createXULElement('menuseparator');
        separator.id = 'litgap-separator';
        
        // 創建選單項目
        const menuitem = document.createXULElement('menuitem');
        menuitem.id = 'litgap-analyze';
        menuitem.setAttribute('label', '🔍 Find Missing Papers (Test)');
        menuitem.setAttribute('class', 'menuitem-non-iconic');
        
        // 添加點擊事件
        menuitem.addEventListener('command', () => {
          this.runAnalysis();
        });
        
        // 添加到選單
        collectionMenu.appendChild(separator);
        collectionMenu.appendChild(menuitem);
        
        Zotero.debug('[LitGap Overlay] ✅ Menu item added successfully!');
        
      } catch (error) {
        Zotero.debug(`[LitGap Overlay] ERROR: ${error.message}`);
        Zotero.debug(error.stack);
      }
    },
    
    runAnalysis() {
      Zotero.debug('[LitGap Overlay] Button clicked!');
      
      try {
        const collection = Zotero.getActiveZoteroPane().getSelectedCollection();
        
        if (!collection) {
          alert('Please select a collection first!');
          return;
        }
        
        alert(`LitGap is working!\n\nZotero: ${Zotero.version}\nCollection: ${collection.name}`);
        
      } catch (error) {
        Zotero.debug(`[LitGap Overlay] Error in runAnalysis: ${error.message}`);
        alert(`Error: ${error.message}`);
      }
    }
  };
  
  // 立即初始化
  if (typeof Zotero !== 'undefined') {
    Zotero.debug('[LitGap Overlay] Zotero found, initializing...');
    window.LitGapOverlay.init();
  } else {
    Zotero.debug('[LitGap Overlay] ERROR: Zotero not found!');
  }
  
})();