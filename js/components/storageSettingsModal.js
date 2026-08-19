/**
 * Storage & Cloud Settings / Onboarding Modal Component
 * Configures Google Drive Folder Links, OAuth, or Local Disk Directory backup destinations
 */

import { CONFIG, showToast } from '../config.js';
import { storageService } from '../services/storageService.js';
import { googleDriveService } from '../services/googleDriveService.js';

export class StorageSettingsModal {
  constructor(app) {
    this.app = app;
    this.modalEl = document.getElementById('modal-storage-settings');
    this.selectedProvider = localStorage.getItem(CONFIG.STORAGE_KEYS.PROVIDER) || 'local';

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.optionCards = document.querySelectorAll('.storage-option-card');
    
    // Folder Link Elements
    this.inputFolderLink = document.getElementById('input-gdrive-folder-link');
    this.btnSaveFolderLink = document.getElementById('btn-save-folder-link');
    this.labelLinkStatus = document.getElementById('label-link-status');
    this.btnInstantCloudSync = document.getElementById('btn-instant-cloud-sync');
    this.btnToggleOAuth = document.getElementById('btn-toggle-oauth-advanced');
    this.oauthBox = document.getElementById('oauth-advanced-box');

    // Webhook Bridge Elements
    this.inputWebhookUrl = document.getElementById('input-gdrive-webhook-url');
    this.btnSaveWebhook = document.getElementById('btn-save-webhook-url');
    this.btnCopyAppsScript = document.getElementById('btn-copy-apps-script');

    // OAuth & Local Elements
    this.inputClientId = document.getElementById('input-gdrive-client-id');
    this.btnConnectGDrive = document.getElementById('btn-connect-gdrive');
    this.btnSelectLocalDir = document.getElementById('btn-select-local-dir');
    this.labelLocalDir = document.getElementById('label-selected-local-dir');
    
    this.btnSave = document.getElementById('btn-save-storage-settings');
    this.btnClose = document.getElementById('btn-close-storage-modal');
    this.btnCancel = document.getElementById('btn-cancel-storage-modal');

    // Load saved folder link if any
    const savedFolderLink = localStorage.getItem(CONFIG.STORAGE_KEYS.GDRIVE_FOLDER_LINK);
    if (savedFolderLink && this.inputFolderLink) {
      this.inputFolderLink.value = savedFolderLink;
      if (this.labelLinkStatus) {
        this.labelLinkStatus.style.display = 'block';
        this.labelLinkStatus.textContent = `✓ Linked: ${savedFolderLink}`;
      }
    }

    // Load saved webhook url if any
    const savedWebhook = localStorage.getItem(CONFIG.STORAGE_KEYS.GDRIVE_WEBHOOK_URL);
    if (savedWebhook && this.inputWebhookUrl) {
      this.inputWebhookUrl.value = savedWebhook;
    }

    // Load saved client id if any
    const savedClientId = localStorage.getItem(CONFIG.STORAGE_KEYS.GDRIVE_CLIENT_ID);
    if (savedClientId && this.inputClientId) {
      this.inputClientId.value = savedClientId;
    }

    const savedLocalRoot = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_ROOT_NAME);
    if (savedLocalRoot && this.labelLocalDir) {
      this.labelLocalDir.textContent = `Target: ${savedLocalRoot}`;
    }
  }

  attachEvents() {
    // Option Card Selection
    this.optionCards.forEach((card) => {
      card.addEventListener('click', () => {
        this.optionCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedProvider = card.dataset.provider;
      });
    });

    // Copy Apps Script Code Button
    if (this.btnCopyAppsScript) {
      this.btnCopyAppsScript.addEventListener('click', (e) => {
        e.stopPropagation();
        const link = this.inputFolderLink ? this.inputFolderLink.value.trim() : '';
        const folderId = googleDriveService.extractFolderId(link) || '1P8AFBFU2hkvBz1fpavHPll1EAcqK4idI';
        const code = googleDriveService.getAppsScriptCode(folderId);
        navigator.clipboard.writeText(code).then(() => {
          showToast('Copied Google Apps Script code to clipboard! Paste at script.google.com', 'success');
        }).catch(() => {
          showToast('Could not copy automatically. See script in settings.', 'info');
        });
      });
    }

    // Save Webhook URL Button
    if (this.btnSaveWebhook && this.inputWebhookUrl) {
      this.btnSaveWebhook.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = this.inputWebhookUrl.value.trim();
        const folderLink = this.inputFolderLink ? this.inputFolderLink.value.trim() : null;
        try {
          googleDriveService.connectWithWebhook(url, folderLink);
          this.selectedProvider = 'gdrive';
          this.highlightSelectedOption('gdrive');
          if (this.labelLinkStatus) {
            this.labelLinkStatus.style.display = 'block';
            this.labelLinkStatus.textContent = `✓ Real Cloud Upload Active via Google Apps Script`;
          }
          this.app.navbar.updateStorageIndicator();
        } catch (err) {
          showToast(err.message, 'danger');
        }
      });
    }

    // Save Folder Link Button
    if (this.btnSaveFolderLink && this.inputFolderLink) {
      this.btnSaveFolderLink.addEventListener('click', (e) => {
        e.stopPropagation();
        const link = this.inputFolderLink.value.trim();
        if (!link) {
          showToast('Please paste a valid Google Drive or Cloud folder link.', 'warning');
          return;
        }
        try {
          const res = googleDriveService.connectWithFolderLink(link);
          this.selectedProvider = 'gdrive';
          this.highlightSelectedOption('gdrive');
          if (this.labelLinkStatus) {
            this.labelLinkStatus.style.display = 'block';
            this.labelLinkStatus.textContent = `✓ Active Cloud Link (Folder ID: ${res.folderId || 'Root'})`;
          }
          this.app.navbar.updateStorageIndicator();
        } catch (err) {
          showToast(err.message, 'danger');
        }
      });
    }

    // Instant Cloud Sync Button (Zero Setup)
    if (this.btnInstantCloudSync) {
      this.btnInstantCloudSync.addEventListener('click', async (e) => {
        e.stopPropagation();
        await googleDriveService.authenticate(null);
        this.selectedProvider = 'gdrive';
        this.highlightSelectedOption('gdrive');
        if (this.labelLinkStatus) {
          this.labelLinkStatus.style.display = 'block';
          this.labelLinkStatus.textContent = `✓ Instant Cloud Mapped Active (Auto Folder Hierarchy: Location/YYYY-MM)`;
        }
        this.app.navbar.updateStorageIndicator();
      });
    }

    // Toggle Advanced OAuth Box
    if (this.btnToggleOAuth && this.oauthBox) {
      this.btnToggleOAuth.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = this.oauthBox.style.display === 'none';
        this.oauthBox.style.display = isHidden ? 'block' : 'none';
      });
    }

    // Connect Google Drive OAuth
    if (this.btnConnectGDrive) {
      this.btnConnectGDrive.addEventListener('click', async (e) => {
        e.stopPropagation();
        const clientId = this.inputClientId ? this.inputClientId.value.trim() : null;
        if (!clientId) {
          showToast('Please enter your Google Cloud OAuth Client ID, or use Instant Cloud Sync above!', 'warning');
          return;
        }
        localStorage.setItem(CONFIG.STORAGE_KEYS.GDRIVE_CLIENT_ID, clientId);
        try {
          await googleDriveService.authenticate(clientId);
          this.selectedProvider = 'gdrive';
          this.highlightSelectedOption('gdrive');
          this.app.navbar.updateStorageIndicator();
        } catch (err) {
          console.warn('OAuth Note:', err);
          showToast(err.message || 'Google OAuth failed. Using Cloud Sync mode instead.', 'warning');
          this.selectedProvider = 'gdrive';
          this.highlightSelectedOption('gdrive');
          this.app.navbar.updateStorageIndicator();
        }
      });
    }

    // Select Local Folder via Web File System Access API
    if (this.btnSelectLocalDir) {
      this.btnSelectLocalDir.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const dirName = await storageService.pickLocalDirectory();
          if (this.labelLocalDir) {
            this.labelLocalDir.textContent = `Target: ${dirName}`;
          }
          showToast(`Target local folder set to: ${dirName}`, 'success');
          this.selectedProvider = 'local';
          this.highlightSelectedOption('local');
        } catch (err) {
          console.warn(err);
          showToast(err.message || 'Folder selection cancelled', 'warning');
        }
      });
    }

    // Save & Apply Settings
    if (this.btnSave) {
      this.btnSave.addEventListener('click', async () => {
        // If user typed a link but forgot to press "Set Link", auto-save it
        if (this.inputFolderLink && this.inputFolderLink.value.trim() && this.selectedProvider === 'gdrive') {
          googleDriveService.connectWithFolderLink(this.inputFolderLink.value.trim());
        }

        localStorage.setItem(CONFIG.STORAGE_KEYS.PROVIDER, this.selectedProvider);
        localStorage.setItem(CONFIG.STORAGE_KEYS.FIRST_RUN_DONE, 'true');

        if (this.selectedProvider === 'demo') {
          await storageService.seedSampleMemories();
        }

        this.app.navbar.updateStorageIndicator();
        await this.app.refreshAllViews();
        showToast('Storage preferences saved & applied!', 'success');
        this.close();
      });
    }

    if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());
    if (this.btnCancel) this.btnCancel.addEventListener('click', () => this.close());
  }

  highlightSelectedOption(provider) {
    this.optionCards.forEach((c) => {
      if (c.dataset.provider === provider) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  open() {
    this.highlightSelectedOption(this.selectedProvider);
    if (this.modalEl) this.modalEl.style.display = 'flex';
  }

  close() {
    if (this.modalEl) this.modalEl.style.display = 'none';
  }
}
