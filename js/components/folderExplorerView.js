import { storageService } from '../services/storageService.js';
import { googleDriveService } from '../services/googleDriveService.js';
import { formatBytes, showToast, CONFIG, resolveMediaUrl, FALLBACK_IMAGE_DATA_URI } from '../config.js';

export class FolderExplorerView {
  constructor(app) {
    this.app = app;
    this.treeData = {};
    this.selectedLocation = null;
    this.selectedMonth = null;

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.treeList = document.getElementById('folder-tree-list');
    this.locationCountBadge = document.getElementById('tree-location-count');
    this.breadcrumb = document.getElementById('folder-breadcrumb');
    this.currentFolderTitle = document.getElementById('current-folder-title');
    this.currentFolderStats = document.getElementById('current-folder-stats');
    this.folderItemsGrid = document.getElementById('folder-items-grid');
    this.btnSync = document.getElementById('btn-sync-storage-explorer');
    this.btnDownloadAllZip = document.getElementById('btn-download-all-folders-zip');
    this.btnOpenDrive = document.getElementById('btn-open-google-drive-link');
    this.hierarchyBadge = document.getElementById('storage-hierarchy-rule');

    // Google Drive Banner Elements
    this.inputExplorerDriveLink = document.getElementById('input-explorer-gdrive-link');
    this.btnSaveExplorerDriveLink = document.getElementById('btn-save-explorer-gdrive-link');
    this.btnBannerOpenDrive = document.getElementById('btn-banner-open-drive');
    this.bannerStatusBadge = document.getElementById('gdrive-banner-status-badge');
    this.bannerDesc = document.getElementById('gdrive-banner-desc');
  }

  attachEvents() {
    if (this.btnSync) {
      this.btnSync.addEventListener('click', () => {
        showToast('Refreshing folder structure...', 'info');
        this.render();
      });
    }

    // Direct Google Drive Link in Explorer
    if (this.btnSaveExplorerDriveLink && this.inputExplorerDriveLink) {
      this.btnSaveExplorerDriveLink.addEventListener('click', () => {
        const link = this.inputExplorerDriveLink.value.trim();
        if (!link) {
          showToast('Please paste a Google Drive folder URL or ID', 'warning');
          return;
        }
        try {
          const res = googleDriveService.connectWithFolderLink(link);
          this.app.navbar.updateStorageIndicator();
          showToast(`Linked to Google Drive folder! (ID: ${res.folderId})`, 'success');
          this.render();
        } catch (e) {
          showToast(e.message, 'danger');
        }
      });
    }

    if (this.btnDownloadAllZip) {
      this.btnDownloadAllZip.addEventListener('click', async () => {
        try {
          showToast('Generating entire organized folder tree ZIP...', 'info');
          const zipBlob = await storageService.exportAsZip();
          const link = document.createElement('a');
          link.href = URL.createObjectURL(zipBlob);
          link.download = `GeoTimeline_FullHierarchy_${Date.now()}.zip`;
          link.click();
          showToast('Full archive download started!', 'success');
        } catch (e) {
          console.error(e);
          showToast('ZIP export failed', 'danger');
        }
      });
    }

    if (this.breadcrumb) {
      this.breadcrumb.addEventListener('click', (e) => {
        const item = e.target.closest('.breadcrumb-item');
        if (!item) return;
        if (item.classList.contains('root')) {
          this.selectedLocation = null;
          this.selectedMonth = null;
          this.render();
        }
      });
    }
  }

  async render() {
    const provider = localStorage.getItem(CONFIG.STORAGE_KEYS.PROVIDER) || 'local';
    const isDrive = provider === 'gdrive' || googleDriveService.isConnected();
    const driveUrl = googleDriveService.getDriveWebUrl();
    const savedLink = localStorage.getItem(CONFIG.STORAGE_KEYS.GDRIVE_FOLDER_LINK) || '';

    // Update Banner state
    if (this.inputExplorerDriveLink && !this.inputExplorerDriveLink.value && savedLink) {
      this.inputExplorerDriveLink.value = savedLink;
    }

    if (this.btnBannerOpenDrive) {
      this.btnBannerOpenDrive.href = driveUrl;
    }

    if (this.bannerStatusBadge) {
      if (savedLink || googleDriveService.isConnected()) {
        this.bannerStatusBadge.textContent = 'Drive Linked';
        this.bannerStatusBadge.className = 'badge badge-accent';
      } else {
        this.bannerStatusBadge.textContent = 'Ready to Link';
        this.bannerStatusBadge.className = 'badge badge-indigo';
      }
    }

    if (this.bannerDesc) {
      if (savedLink) {
        this.bannerDesc.innerHTML = `Target Drive: <code>${savedLink.substring(0, 45)}...</code> • Auto-organizes into <code>[Location] / [YYYY-MM]</code>`;
      } else {
        this.bannerDesc.innerHTML = `Paste your Google Drive link or ID above to organize uploads into cloud folders.`;
      }
    }

    // Update Google Drive button & hierarchy badge
    if (this.btnOpenDrive) {
      if (isDrive) {
        this.btnOpenDrive.style.display = 'inline-flex';
        this.btnOpenDrive.href = driveUrl;
      } else {
        this.btnOpenDrive.style.display = 'none';
      }
    }

    if (this.hierarchyBadge) {
      const rootName = isDrive ? 'Google Drive' : 'Local Storage';
      this.hierarchyBadge.innerHTML = `<i class="fa-solid fa-sitemap"></i> Structure: <code>[${rootName}] / [Location] / [YYYY-MM] / [Files]</code>`;
    }

    this.treeData = await storageService.getFolderHierarchy();
    const locations = Object.keys(this.treeData);
    
    if (this.locationCountBadge) {
      this.locationCountBadge.textContent = locations.length;
    }

    this.renderTreeSidebar();

    // Auto select first folder if none selected
    if (!this.selectedLocation && locations.length > 0) {
      this.selectedLocation = locations[0];
      const months = Object.keys(this.treeData[this.selectedLocation].months);
      if (months.length > 0) {
        this.selectedMonth = months[0];
      }
    }

    this.renderFolderContent();
  }

  renderTreeSidebar() {
    if (!this.treeList) return;
    this.treeList.innerHTML = '';

    const locations = Object.keys(this.treeData);

    if (locations.length === 0) {
      this.treeList.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 0.8rem;">No folders created yet</div>';
      return;
    }

    locations.forEach((locName) => {
      const locData = this.treeData[locName];
      const nodeEl = document.createElement('div');
      nodeEl.className = `tree-node ${this.selectedLocation === locName && !this.selectedMonth ? 'active' : ''}`;
      nodeEl.innerHTML = `
        <div class="tree-node-label">
          <i class="fa-solid fa-folder text-cyan"></i>
          <span>${locName}</span>
        </div>
        <span class="badge badge-accent">${locData.totalFiles}</span>
      `;

      nodeEl.addEventListener('click', () => {
        this.selectedLocation = locName;
        this.selectedMonth = null;
        this.renderTreeSidebar();
        this.renderFolderContent();
      });

      this.treeList.appendChild(nodeEl);

      // Sub-folders for months
      const months = Object.keys(locData.months);
      if (months.length > 0) {
        const subList = document.createElement('div');
        subList.className = 'tree-sub-list';

        months.forEach((ym) => {
          const monthData = locData.months[ym];
          const subNode = document.createElement('div');
          subNode.className = `tree-node ${this.selectedLocation === locName && this.selectedMonth === ym ? 'active' : ''}`;
          subNode.innerHTML = `
            <div class="tree-node-label">
              <i class="fa-solid fa-folder-open text-indigo"></i>
              <span>${ym}</span>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${monthData.files.length}</span>
          `;

          subNode.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectedLocation = locName;
            this.selectedMonth = ym;
            this.renderTreeSidebar();
            this.renderFolderContent();
          });

          subList.appendChild(subNode);
        });

        this.treeList.appendChild(subList);
      }
    });
  }

  renderFolderContent() {
    if (!this.folderItemsGrid || !this.currentFolderTitle) return;
    this.folderItemsGrid.innerHTML = '';

    if (!this.selectedLocation || !this.treeData[this.selectedLocation]) {
      this.currentFolderTitle.textContent = 'Root Storage';
      this.currentFolderStats.textContent = 'Select a location or date folder to view files';
      this.updateBreadcrumb();
      return;
    }

    const locData = this.treeData[this.selectedLocation];
    let filesToShow = [];

    if (this.selectedMonth && locData.months[this.selectedMonth]) {
      filesToShow = locData.months[this.selectedMonth].files;
      this.currentFolderTitle.textContent = `${this.selectedLocation} / ${this.selectedMonth}`;
      this.currentFolderStats.textContent = `${filesToShow.length} files • ${formatBytes(locData.months[this.selectedMonth].size)}`;
    } else {
      // Show all files in this location
      Object.values(locData.months).forEach((m) => {
        filesToShow.push(...m.files);
      });
      this.currentFolderTitle.textContent = this.selectedLocation;
      this.currentFolderStats.textContent = `${filesToShow.length} files across ${Object.keys(locData.months).length} months • ${formatBytes(locData.totalSize)}`;
    }

    this.updateBreadcrumb();

    if (filesToShow.length === 0) {
      this.folderItemsGrid.innerHTML = '<div style="padding: 24px; color: var(--text-muted); grid-column: 1 / -1;">No files in this folder</div>';
      return;
    }

    filesToShow.forEach((fileItem) => {
      const card = document.createElement('div');
      card.className = 'folder-file-card';
      
      const thumb = resolveMediaUrl(fileItem);
      const isVideo = fileItem.mediaType === 'video';

      card.innerHTML = `
        ${isVideo ? `<video src="${thumb}" class="folder-file-thumb" muted></video>` : `<img src="${thumb}" class="folder-file-thumb" alt="${fileItem.fileName || 'File'}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE_DATA_URI}';">`}
        <div class="folder-file-info">
          <span class="folder-file-name" title="${fileItem.fileName}">${fileItem.fileName}</span>
          <span class="folder-file-size">${formatBytes(fileItem.fileSize)} • ${(fileItem.exif && fileItem.exif.dimensions) || 'Media'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        const all = Object.values(this.treeData).flatMap(l => Object.values(l.months).flatMap(m => m.files));
        const idx = all.findIndex(f => f.id === fileItem.id);
        this.app.lightbox.open(all, idx >= 0 ? idx : 0);
      });

      this.folderItemsGrid.appendChild(card);
    });
  }

  updateBreadcrumb() {
    if (!this.breadcrumb) return;
    let html = '<span class="breadcrumb-item root" data-path="/"><i class="fa-solid fa-server"></i> Root Storage</span>';

    if (this.selectedLocation) {
      html += ` <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem; color: var(--text-muted);"></i> <span class="breadcrumb-item">${this.selectedLocation}</span>`;
    }
    if (this.selectedMonth) {
      html += ` <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem; color: var(--text-muted);"></i> <span class="breadcrumb-item active" style="color: var(--accent); font-weight:600;">${this.selectedMonth}</span>`;
    }

    this.breadcrumb.innerHTML = html;
  }
}
