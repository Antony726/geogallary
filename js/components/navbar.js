/**
 * Top Navigation Bar & Global Header Controller
 */

import { CONFIG } from '../config.js';
import { googleDriveService } from '../services/googleDriveService.js';

export class Navbar {
  constructor(app) {
    this.app = app;
    this.initElements();
    this.attachEvents();
    this.updateStorageIndicator();
  }

  initElements() {
    this.navTabs = document.querySelectorAll('.nav-tab');
    this.mobileNavTabs = document.querySelectorAll('.mobile-nav-tab');
    this.searchInput = document.getElementById('global-search-input');
    this.searchClearBtn = document.getElementById('search-clear-btn');
    this.searchContainer = document.getElementById('header-search-container');
    this.btnMobileSearchToggle = document.getElementById('btn-mobile-search-toggle');
    this.btnUpload = document.getElementById('btn-open-upload');
    this.btnMobileFabUpload = document.getElementById('btn-mobile-fab-upload');
    this.btnSettings = document.getElementById('btn-open-settings');
    this.btnStorageStatus = document.getElementById('btn-storage-status');
    this.storageLabel = document.getElementById('storage-status-label');
    this.storageIcon = document.getElementById('storage-type-icon');
    this.storageDot = document.getElementById('storage-indicator-dot');
    this.btnLogo = document.getElementById('btn-logo');
  }

  attachEvents() {
    // Desktop Tab Switching
    this.navTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const viewName = tab.dataset.view;
        this.app.switchView(viewName);
      });
    });

    // Mobile Bottom Tab Switching
    this.mobileNavTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const viewName = tab.dataset.view;
        this.app.switchView(viewName);
      });
    });

    // Logo Click -> Go to Dashboard
    if (this.btnLogo) {
      this.btnLogo.addEventListener('click', () => {
        this.app.switchView('dashboard');
      });
    }

    // Mobile Search Bar Toggle
    if (this.btnMobileSearchToggle && this.searchContainer) {
      this.btnMobileSearchToggle.addEventListener('click', () => {
        this.searchContainer.classList.toggle('mobile-active');
        if (this.searchContainer.classList.contains('mobile-active') && this.searchInput) {
          this.searchInput.focus();
        }
      });
    }

    // Global Search
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (this.searchClearBtn) {
          this.searchClearBtn.style.display = query ? 'block' : 'none';
        }
        this.app.handleGlobalSearch(query);
      });
    }

    if (this.searchClearBtn) {
      this.searchClearBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchClearBtn.style.display = 'none';
        this.app.handleGlobalSearch('');
      });
    }

    // Storage Status Button
    if (this.btnStorageStatus) {
      this.btnStorageStatus.addEventListener('click', () => {
        this.app.storageSettingsModal.open();
      });
    }

    // Upload Buttons (Desktop & Mobile FAB)
    if (this.btnUpload) {
      this.btnUpload.addEventListener('click', () => {
        this.app.uploadModal.open();
      });
    }

    if (this.btnMobileFabUpload) {
      this.btnMobileFabUpload.addEventListener('click', () => {
        this.app.uploadModal.open();
      });
    }

    if (this.btnSettings) {
      this.btnSettings.addEventListener('click', () => {
        this.app.storageSettingsModal.open();
      });
    }
  }

  setActiveTab(viewName) {
    this.navTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    this.mobileNavTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });
  }

  updateStorageIndicator() {
    const provider = localStorage.getItem(CONFIG.STORAGE_KEYS.PROVIDER) || 'local';
    const localDir = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_ROOT_NAME);

    if (provider === 'gdrive' && googleDriveService.isConnected()) {
      this.storageLabel.textContent = googleDriveService.folderLink ? 'Google Drive Link' : 'Google Drive Cloud';
      this.storageIcon.className = 'fa-brands fa-google-drive';
      this.storageDot.className = 'storage-indicator online';
    } else if (provider === 'local') {
      this.storageLabel.textContent = localDir ? `Local: ${localDir}` : 'Local Device';
      this.storageIcon.className = 'fa-solid fa-hard-drive';
      this.storageDot.className = 'storage-indicator online';
    } else {
      this.storageLabel.textContent = 'Sample Memories';
      this.storageIcon.className = 'fa-solid fa-wand-magic-sparkles';
      this.storageDot.className = 'storage-indicator online';
    }
  }
}
