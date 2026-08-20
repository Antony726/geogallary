/**
 * Upload & EXIF Processing Modal Component
 * Handles drag-and-drop, folder uploads, live EXIF extraction, manual location tagging,
 * and automated backup into Google Drive or Local Storage.
 */

import { exifService } from '../services/exifService.js';
import { geoService } from '../services/geoService.js';
import { storageService } from '../services/storageService.js';
import { googleDriveService } from '../services/googleDriveService.js';
import { tripDetectionService } from '../services/tripDetectionService.js';
import { formatBytes, formatDate, showToast, CONFIG } from '../config.js';

export class UploadModal {
  constructor(app) {
    this.app = app;
    this.modalEl = document.getElementById('modal-upload');
    this.queue = []; // Array of processed queue items
    this.isUploading = false;
    this.pickerTargetItem = null;
    this.pickerMap = null;
    this.pickerMarker = null;
    this.selectedPickerLocation = null;

    this.initElements();
    this.attachEvents();
    this.initManualLocationPicker();
  }

  initElements() {
    this.dropzone = document.getElementById('upload-dropzone');
    this.fileInputFiles = document.getElementById('file-input-files');
    this.fileInputCamera = document.getElementById('file-input-camera');
    this.fileInputFolder = document.getElementById('file-input-folder');
    this.queueSection = document.getElementById('upload-queue-section');
    this.queueItemsList = document.getElementById('queue-items-list');
    this.queueCount = document.getElementById('queue-count');
    this.btnClearQueue = document.getElementById('btn-clear-queue');
    this.btnStartOrganize = document.getElementById('btn-start-organize');
    this.btnCloseModal = document.getElementById('btn-close-upload-modal');
    this.btnCancelUpload = document.getElementById('btn-cancel-upload');

    // Progress Bar
    this.progressBox = document.getElementById('upload-progress-box');
    this.progressFill = document.getElementById('progress-bar-fill');
    this.progressPercent = document.getElementById('progress-percentage');
    this.progressStatus = document.getElementById('progress-status-text');

    // Location Picker Modal elements
    this.locationPickerModal = document.getElementById('modal-manual-location');
    this.btnCloseLocationPicker = document.getElementById('btn-close-location-picker');
    this.btnCancelLocationPicker = document.getElementById('btn-cancel-location-picker');
    this.btnConfirmLocationPicker = document.getElementById('btn-confirm-location-picker');
    this.inputSearchLocation = document.getElementById('input-search-location');
    this.btnSearchLocation = document.getElementById('btn-search-location-geocode');
    this.labelSelectedLocation = document.getElementById('label-selected-location-text');

    // Upload Destination Bar
    this.uploadDestLabel = document.getElementById('upload-dest-label');
    this.btnUploadSwitchDest = document.getElementById('btn-upload-switch-dest');
  }

  attachEvents() {
    // Open/Close
    if (this.btnCloseModal) this.btnCloseModal.addEventListener('click', () => this.close());
    if (this.btnCancelUpload) this.btnCancelUpload.addEventListener('click', () => this.close());

    // Switch Destination
    if (this.btnUploadSwitchDest) {
      this.btnUploadSwitchDest.addEventListener('click', () => {
        this.close();
        this.app.storageSettingsModal.open();
      });
    }

    // Drag & Drop
    if (this.dropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        this.dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          this.dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        this.dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          this.dropzone.classList.remove('dragover');
        });
      });

      this.dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) this.handleFilesSelected(files);
      });
    }

    // Camera Capture changes
    if (this.fileInputCamera) {
      this.fileInputCamera.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) this.handleFilesSelected(files);
        this.fileInputCamera.value = '';
      });
    }

    // File input changes
    if (this.fileInputFiles) {
      this.fileInputFiles.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) this.handleFilesSelected(files);
        this.fileInputFiles.value = '';
      });
    }

    if (this.fileInputFolder) {
      this.fileInputFolder.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) this.handleFilesSelected(files);
        this.fileInputFolder.value = '';
      });
    }

    // Clear Queue
    if (this.btnClearQueue) {
      this.btnClearQueue.addEventListener('click', () => {
        this.queue = [];
        this.renderQueue();
      });
    }

    // Start Organize
    if (this.btnStartOrganize) {
      this.btnStartOrganize.addEventListener('click', () => this.executeOrganizeAndSave());
    }
  }

  open() {
    this.updateDestinationLabel();
    if (this.modalEl) this.modalEl.style.display = 'flex';
  }

  updateDestinationLabel() {
    if (!this.uploadDestLabel) return;
    const provider = localStorage.getItem(CONFIG.STORAGE_KEYS.PROVIDER) || 'local';
    const driveLink = localStorage.getItem(CONFIG.STORAGE_KEYS.GDRIVE_FOLDER_LINK);
    const localDir = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_ROOT_NAME);

    if (provider === 'gdrive' || googleDriveService.isConnected()) {
      this.uploadDestLabel.textContent = driveLink ? `Google Drive Linked Folder ([Location] / [YYYY-MM])` : `Google Drive Cloud ([Location] / [YYYY-MM])`;
    } else if (localDir) {
      this.uploadDestLabel.textContent = `Local Folder (${localDir}) & IndexedDB`;
    } else {
      this.uploadDestLabel.textContent = `Local Device & IndexedDB Storage`;
    }
  }

  close() {
    if (this.isUploading) return;
    if (this.modalEl) this.modalEl.style.display = 'none';
  }

  async handleFilesSelected(fileList) {
    // Filter only images and videos
    const mediaFiles = fileList.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    
    if (mediaFiles.length === 0) {
      showToast('No valid image or video files found.', 'warning');
      return;
    }

    showToast(`Processing EXIF metadata for ${mediaFiles.length} files...`, 'info');
    if (this.queueSection) this.queueSection.style.display = 'flex';

    for (const file of mediaFiles) {
      const meta = await exifService.extractMetadata(file);
      
      const queueItem = {
        id: 'upload-' + Math.random().toString(36).substr(2, 9),
        file: file,
        fileBlob: file,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
        dateTaken: meta.dateTaken,
        latitude: meta.latitude,
        longitude: meta.longitude,
        locationName: meta.locationName,
        district: meta.district,
        city: meta.city,
        state: meta.state,
        country: meta.country,
        hasGps: meta.hasGps,
        hasExifDate: meta.hasExifDate,
        exif: meta.exif,
        thumbUrl: URL.createObjectURL(file)
      };

      this.queue.push(queueItem);
      this.renderQueue();
    }
  }

  renderQueue() {
    if (!this.queueItemsList || !this.queueCount) return;
    this.queueCount.textContent = this.queue.length;

    if (this.queue.length === 0) {
      if (this.queueSection) this.queueSection.style.display = 'none';
      if (this.btnStartOrganize) this.btnStartOrganize.disabled = true;
      return;
    }

    if (this.queueSection) this.queueSection.style.display = 'flex';
    if (this.btnStartOrganize) this.btnStartOrganize.disabled = false;

    this.queueItemsList.innerHTML = '';

    this.queue.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'queue-item-card';

      const d = new Date(item.dateTaken);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const destPath = `${item.locationName} / ${ym} / ${item.fileName}`;

      card.innerHTML = `
        <img src="${item.thumbUrl}" class="queue-thumb" alt="${item.fileName}">
        <div class="queue-meta">
          <span class="queue-filename">${item.fileName} (${formatBytes(item.fileSize)})</span>
          <div class="queue-tags">
            <span class="meta-pill ${item.hasExifDate ? 'resolved' : 'missing'}" id="pill-date-${item.id}" title="Click to edit date">
              <i class="fa-solid fa-calendar"></i> ${formatDate(item.dateTaken)}
            </span>
            <span class="meta-pill ${item.hasGps ? 'resolved' : 'missing'}" id="pill-loc-${item.id}" title="Click to edit or pin location">
              <i class="fa-solid fa-location-dot"></i> ${item.locationName}
            </span>
          </div>
          <span class="meta-dest-path"><i class="fa-solid fa-folder-tree"></i> Destination: <code>${destPath}</code></span>
        </div>
        <button class="btn-icon btn-sm text-danger" id="btn-remove-queue-${item.id}" title="Remove file"><i class="fa-solid fa-xmark"></i></button>
      `;

      // Date edit event (prompt)
      const datePill = card.querySelector(`#pill-date-${item.id}`);
      if (datePill) {
        datePill.addEventListener('click', () => {
          const userDate = prompt('Enter capture date (YYYY-MM-DD):', item.dateTaken.split('T')[0]);
          if (userDate) {
            const parsed = new Date(userDate);
            if (!isNaN(parsed.getTime())) {
              item.dateTaken = parsed.toISOString();
              item.hasExifDate = true;
              this.renderQueue();
            }
          }
        });
      }

      // Location edit event (open map modal)
      const locPill = card.querySelector(`#pill-loc-${item.id}`);
      if (locPill) {
        locPill.addEventListener('click', () => {
          this.openLocationPicker(item);
        });
      }

      // Remove item event
      const removeBtn = card.querySelector(`#btn-remove-queue-${item.id}`);
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.queue.splice(index, 1);
          this.renderQueue();
        });
      }

      this.queueItemsList.appendChild(card);
    });
  }

  /**
   * Execute auto-organization and save to Storage (Google Drive or Local)
   */
  async executeOrganizeAndSave() {
    if (this.queue.length === 0 || this.isUploading) return;
    this.isUploading = true;

    if (this.progressBox) this.progressBox.style.display = 'block';
    if (this.btnStartOrganize) this.btnStartOrganize.disabled = true;

    const provider = localStorage.getItem(CONFIG.STORAGE_KEYS.PROVIDER) || 'local';
    const isDrive = provider === 'gdrive' && googleDriveService.isConnected();

    const total = this.queue.length;
    let completed = 0;

    for (const item of this.queue) {
      const d = new Date(item.dateTaken);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      this.updateProgress(completed, total, `Saving ${item.fileName} into [${item.locationName}] / [${ym}]...`);

      if (isDrive) {
        // Upload to Google Drive
        try {
          await googleDriveService.uploadMedia(item.locationName, ym, item.fileName, item.fileBlob, {
            dateTaken: item.dateTaken,
            latitude: item.latitude,
            longitude: item.longitude
          });
        } catch (e) {
          console.warn('Google Drive save warning:', e);
        }
      }

      // Always save to unified IndexedDB & Local file system handle
      await storageService.saveMedia(item);

      completed++;
      this.updateProgress(completed, total, `Saved ${completed} of ${total} files`);
    }

    showToast(`Successfully organized & backed up ${total} memories!`, 'success');
    this.queue = [];
    this.isUploading = false;
    
    if (this.progressBox) this.progressBox.style.display = 'none';
    this.close();

    // Auto-detect trips for newly uploaded media
    try {
      await tripDetectionService.detectTrips();
    } catch (e) {
      console.warn('Trip detection on upload error:', e);
    }

    // Refresh all views
    await this.app.refreshAllViews();
  }

  updateProgress(current, total, statusText) {
    const percent = Math.round((current / total) * 100);
    if (this.progressFill) this.progressFill.style.width = `${percent}%`;
    if (this.progressPercent) this.progressPercent.textContent = `${percent}%`;
    if (this.progressStatus) this.progressStatus.textContent = statusText;
  }

  // ================= Manual Location Picker Map ================= //

  initManualLocationPicker() {
    if (!this.btnCloseLocationPicker || !this.locationPickerModal) return;

    this.btnCloseLocationPicker.addEventListener('click', () => {
      this.locationPickerModal.style.display = 'none';
    });

    if (this.btnCancelLocationPicker) {
      this.btnCancelLocationPicker.addEventListener('click', () => {
        this.locationPickerModal.style.display = 'none';
      });
    }

    if (this.btnSearchLocation && this.inputSearchLocation) {
      this.btnSearchLocation.addEventListener('click', async () => {
        const query = this.inputSearchLocation.value.trim();
        if (!query) return;
        showToast('Searching place...', 'info');
        const results = await geoService.searchLocation(query);
        if (results.length > 0) {
          const first = results[0];
          this.setPickerLocation(first.lat, first.lng, first.name, first.city, first.country);
          if (this.pickerMap) this.pickerMap.flyTo([first.lat, first.lng], 13);
        } else {
          showToast('No matching location found', 'warning');
        }
      });
    }

    // Bind quick 1-tap Tamil Nadu & India chips
    const quickChips = document.querySelectorAll('.quick-chip');
    quickChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        quickChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const name = chip.dataset.name;
        const lat = parseFloat(chip.dataset.lat);
        const lng = parseFloat(chip.dataset.lng);
        const parts = name.split(',');
        const city = parts[0].trim();
        const country = parts.length > 2 ? parts[2].trim() : 'India';
        this.setPickerLocation(lat, lng, name, city, country);
        if (this.pickerMap) {
          this.pickerMap.flyTo([lat, lng], 13, { duration: 1.2 });
        }
      });
    });

    if (this.btnConfirmLocationPicker) {
      this.btnConfirmLocationPicker.addEventListener('click', () => {
        if (this.pickerTargetItem && this.selectedPickerLocation) {
          this.pickerTargetItem.latitude = this.selectedPickerLocation.lat;
          this.pickerTargetItem.longitude = this.selectedPickerLocation.lng;
          this.pickerTargetItem.locationName = this.selectedPickerLocation.name;
          this.pickerTargetItem.city = this.selectedPickerLocation.city;
          this.pickerTargetItem.country = this.selectedPickerLocation.country;
          this.pickerTargetItem.hasGps = true;
          this.renderQueue();
        }
        this.locationPickerModal.style.display = 'none';
      });
    }
  }

  openLocationPicker(item) {
    this.pickerTargetItem = item;
    if (this.locationPickerModal) this.locationPickerModal.style.display = 'flex';

    setTimeout(() => {
      if (!this.pickerMap && typeof window.L !== 'undefined') {
        // Centered on Tamil Nadu, India
        this.pickerMap = window.L.map('picker-map').setView([10.8505, 78.6856], 7.5);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 18
        }).addTo(this.pickerMap);

        this.pickerMap.on('click', async (e) => {
          const { lat, lng } = e.latlng;
          showToast('Resolving location...', 'info');
          const geo = await geoService.reverseGeocode(lat, lng);
          this.setPickerLocation(lat, lng, geo.name, geo.city, geo.country);
        });
      }

      if (this.pickerMap) {
        this.pickerMap.invalidateSize();
        if (item.latitude && item.longitude) {
          this.setPickerLocation(item.latitude, item.longitude, item.locationName, item.city, item.country);
          this.pickerMap.setView([item.latitude, item.longitude], 12);
        } else {
          this.pickerMap.setView([10.8505, 78.6856], 7.5);
        }
      }
    }, 150);
  }

  setPickerLocation(lat, lng, name, city, country) {
    this.selectedPickerLocation = { lat, lng, name, city, country };
    if (this.labelSelectedLocation) {
      this.labelSelectedLocation.textContent = name;
    }

    if (this.pickerMap) {
      if (this.pickerMarker) this.pickerMarker.remove();
      this.pickerMarker = window.L.marker([lat, lng]).addTo(this.pickerMap);
    }
  }
}
