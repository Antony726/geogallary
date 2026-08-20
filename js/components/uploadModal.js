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
        this.resetFileInputs();
        this.renderQueue();
      });
    }

    // Start Organize
    if (this.btnStartOrganize) {
      this.btnStartOrganize.addEventListener('click', () => this.executeOrganizeAndSave());
    }

    // Batch Actions Toolbar
    const btnBatchLoc = document.getElementById('btn-batch-fill-location');
    const btnBatchDate = document.getElementById('btn-batch-fill-date');
    if (btnBatchLoc) btnBatchLoc.addEventListener('click', () => this.applyBatchLocationToAll());
    if (btnBatchDate) btnBatchDate.addEventListener('click', () => this.applyBatchDateToAll());
  }

  applyBatchLocationToAll() {
    if (this.queue.length === 0) return;

    const validItem = this.queue.find(i => i.hasGps && i.locationName && i.locationName !== 'Unspecified Location');
    if (validItem) {
      const { latitude, longitude, locationName, district, city, state, country } = validItem;
      this.queue.forEach(item => {
        item.latitude = latitude;
        item.longitude = longitude;
        item.locationName = locationName;
        item.district = district;
        item.city = city;
        item.state = state;
        item.country = country;
        item.hasGps = true;
      });
      this.renderQueue();
      showToast(`Applied location "${locationName}" to all ${this.queue.length} items!`, 'success');
    } else {
      showToast('Pick a location to apply to all items...', 'info');
      this.openLocationPicker(this.queue[0]);
    }
  }

  applyBatchDateToAll() {
    if (this.queue.length === 0) return;

    const validItem = this.queue.find(i => i.hasExifDate && i.dateTaken);
    let dateToApply = null;

    if (validItem) {
      dateToApply = validItem.dateTaken;
    } else {
      const userDate = prompt('Enter capture date to apply to all files (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
      if (!userDate) return;
      const parsed = new Date(userDate);
      if (isNaN(parsed.getTime())) {
        showToast('Invalid date format', 'warning');
        return;
      }
      dateToApply = parsed.toISOString();
    }

    this.queue.forEach(item => {
      item.dateTaken = dateToApply;
      item.hasExifDate = true;
    });

    this.renderQueue();
    showToast(`Applied date to all ${this.queue.length} items!`, 'success');
  }

  open() {
    this.queue = [];
    this.renderQueue();
    this.resetFileInputs();
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

  resetFileInputs() {
    if (this.fileInputFiles) this.fileInputFiles.value = '';
    if (this.fileInputCamera) this.fileInputCamera.value = '';
    if (this.fileInputFolder) this.fileInputFolder.value = '';
  }

  close() {
    if (this.isUploading) return;
    this.queue = [];
    this.renderQueue();
    this.resetFileInputs();
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
    if (this.queueSection) this.queueSection.style.display = 'block';

    const batchItems = [];
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

      batchItems.push(queueItem);
    }

    // Auto smart-inherit location & date within the batch
    const sampleLoc = batchItems.find(i => i.hasGps && i.locationName && i.locationName !== 'Unspecified Location');
    const sampleDate = batchItems.find(i => i.hasExifDate && i.dateTaken);

    if (sampleLoc) {
      batchItems.forEach(i => {
        if (!i.hasGps || i.locationName === 'Unspecified Location') {
          i.latitude = sampleLoc.latitude;
          i.longitude = sampleLoc.longitude;
          i.locationName = sampleLoc.locationName;
          i.district = sampleLoc.district;
          i.city = sampleLoc.city;
          i.state = sampleLoc.state;
          i.country = sampleLoc.country;
          i.hasGps = true;
        }
      });
    }

    if (sampleDate) {
      batchItems.forEach(i => {
        if (!i.hasExifDate || !i.dateTaken) {
          i.dateTaken = sampleDate.dateTaken;
          i.hasExifDate = true;
        }
      });
    }

    this.queue.push(...batchItems);
    this.renderQueue();
  }

  renderQueue() {
    if (!this.queueItemsList || !this.queueCount) return;
    this.queueCount.textContent = this.queue.length;

    if (this.queue.length === 0) {
      if (this.queueSection) this.queueSection.style.display = 'none';
      if (this.btnStartOrganize) this.btnStartOrganize.disabled = true;
      if (this.queueItemsList) this.queueItemsList.innerHTML = '';
      return;
    }

    if (this.queueSection) this.queueSection.style.display = 'block';
    if (this.btnStartOrganize) this.btnStartOrganize.disabled = false;

    this.queueItemsList.innerHTML = '';

    this.queue.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'queue-item-card';

      const dateText = item.hasExifDate && item.dateTaken ? formatDate(item.dateTaken) : 'Unspecified Date';
      const shortLoc = item.hasGps ? (item.district || item.city || (item.locationName ? item.locationName.split(',')[0].trim() : 'Unspecified Location')) : 'Unspecified Location';

      card.innerHTML = `
        <img src="${item.thumbUrl}" class="queue-thumb" alt="${item.fileName}">
        <div class="queue-meta">
          <div class="queue-filename" title="${item.fileName}">${item.fileName}</div>
          <div class="queue-tags">
            <span class="meta-pill ${item.hasExifDate ? 'resolved' : 'missing'}" id="pill-date-${item.id}" title="Click to edit date">
              <i class="fa-solid fa-calendar"></i> ${dateText}
            </span>
            <span class="meta-pill ${item.hasGps ? 'resolved' : 'missing'}" id="pill-loc-${item.id}" title="Click to edit or pin location">
              <i class="fa-solid fa-location-dot"></i> ${shortLoc}
            </span>
          </div>
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
    this.renderQueue();
    this.resetFileInputs();
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

  // ================= Manual Location Picker Map ================= //

  initManualLocationPicker() {
    this.locationPickerModal = document.getElementById('modal-manual-location');
    this.btnCloseLocationPicker = document.getElementById('btn-close-location-picker');
    this.btnCancelLocationPicker = document.getElementById('btn-cancel-location-picker');
    this.btnConfirmLocationPicker = document.getElementById('btn-confirm-location-picker');
    this.inputSearchLocation = document.getElementById('input-search-location');
    this.btnSearchLocation = document.getElementById('btn-search-location-geocode');
    this.labelSelectedLocation = document.getElementById('label-selected-location-text');

    if (!this.locationPickerModal) return;

    const closePicker = () => {
      if (this.locationPickerModal) this.locationPickerModal.style.display = 'none';
    };

    if (this.btnCloseLocationPicker) this.btnCloseLocationPicker.addEventListener('click', closePicker);
    if (this.btnCancelLocationPicker) this.btnCancelLocationPicker.addEventListener('click', closePicker);

    // Search input Enter key
    if (this.inputSearchLocation) {
      this.inputSearchLocation.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.performLocationSearch();
        }
      });
    }

    if (this.btnSearchLocation) {
      this.btnSearchLocation.addEventListener('click', () => this.performLocationSearch());
    }

    // Quick location chips (.location-chip)
    const quickChips = document.querySelectorAll('#quick-location-chips-list .location-chip');
    quickChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        quickChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const name = chip.dataset.name || chip.textContent;
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
        const manualQuery = this.inputSearchLocation ? this.inputSearchLocation.value.trim() : '';
        if (manualQuery && (!this.selectedPickerLocation || this.selectedPickerLocation.name === 'Click map or chip')) {
          this.selectedPickerLocation = {
            lat: 13.0827,
            lng: 80.2707,
            name: manualQuery,
            city: manualQuery.split(',')[0].trim(),
            country: 'India'
          };
        }

        if (this.pickerTargetItem && this.selectedPickerLocation) {
          this.pickerTargetItem.latitude = this.selectedPickerLocation.lat;
          this.pickerTargetItem.longitude = this.selectedPickerLocation.lng;
          this.pickerTargetItem.locationName = this.selectedPickerLocation.name;
          this.pickerTargetItem.city = this.selectedPickerLocation.city;
          this.pickerTargetItem.country = this.selectedPickerLocation.country;
          this.pickerTargetItem.hasGps = true;
          this.renderQueue();
          showToast(`Location updated to "${this.selectedPickerLocation.name}"`, 'success');
        }
        closePicker();
      });
    }
  }

  async performLocationSearch() {
    const query = this.inputSearchLocation ? this.inputSearchLocation.value.trim() : '';
    if (!query) return;
    showToast('Searching locations...', 'info');

    const resultsContainer = document.getElementById('location-search-results');
    const results = await geoService.searchLocation(query);

    if (results && results.length > 0) {
      if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'flex';
        results.slice(0, 5).forEach((item) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'text-left px-3 py-2 text-xs bg-zinc-900 hover:bg-zinc-800 rounded-lg text-white truncate border border-zinc-800 w-full';
          btn.innerHTML = `<i class="fa-solid fa-location-dot" style="color: var(--accent); margin-right: 6px;"></i> ${item.name}`;
          btn.onclick = () => {
            this.setPickerLocation(item.lat, item.lng, item.name, item.city, item.country);
            if (this.pickerMap) this.pickerMap.flyTo([item.lat, item.lng], 13);
            resultsContainer.style.display = 'none';
          };
          resultsContainer.appendChild(btn);
        });
      }

      const first = results[0];
      this.setPickerLocation(first.lat, first.lng, first.name, first.city, first.country);
      if (this.pickerMap) this.pickerMap.flyTo([first.lat, first.lng], 13);
    } else {
      showToast('Location name captured. Click Confirm to save.', 'info');
      this.setPickerLocation(13.0827, 80.2707, query, query.split(',')[0].trim(), 'India');
    }
  }

  openLocationPicker(item) {
    this.pickerTargetItem = item;
    if (this.inputSearchLocation) {
      this.inputSearchLocation.value = (item.locationName && item.locationName !== 'Unspecified Location') ? item.locationName : '';
    }

    const resultsContainer = document.getElementById('location-search-results');
    if (resultsContainer) resultsContainer.style.display = 'none';

    if (this.locationPickerModal) this.locationPickerModal.style.display = 'flex';

    setTimeout(() => {
      if (!this.pickerMap && typeof window.L !== 'undefined') {
        const initialLat = (item && item.latitude) ? item.latitude : 13.0827;
        const initialLng = (item && item.longitude) ? item.longitude : 80.2707;

        this.pickerMap = window.L.map('picker-map').setView([initialLat, initialLng], 8);
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
        if (item && item.latitude != null && item.longitude != null) {
          this.setPickerLocation(item.latitude, item.longitude, item.locationName, item.city, item.country);
          this.pickerMap.setView([item.latitude, item.longitude], 13);
        } else {
          this.pickerMap.setView([13.0827, 80.2707], 7);
        }
      }
    }, 200);
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
