/**
 * Trips View Component (Feature 2 Enhanced)
 * Supports Auto-Detected Trips + Full Manual Trip Creation + Direct Photo/Video Upload to Trips +
 * Map Journey Route + Sharing + Renaming + Deletion.
 */

import { storageService } from '../services/storageService.js';
import { tripDetectionService } from '../services/tripDetectionService.js';
import { shareService } from '../services/shareService.js';
import { exifService } from '../services/exifService.js';
import { formatDate, formatBytes, showToast, resolveMediaUrl, FALLBACK_IMAGE_DATA_URI } from '../config.js';

export class TripsView {
  constructor(app) {
    this.app = app;
    this.trips = [];
    this.allMedia = [];

    // Staged files for creating/appending to trips
    this.createTripStagedFiles = [];
    this.appendTripStagedFiles = [];
    this.activeAppendTrip = null;
    this.selectedPresetCoords = null;

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.container = document.getElementById('view-trips');
    this.tripsGrid = document.getElementById('trips-grid');
    this.tripsCountBadge = document.getElementById('trips-count-badge');
    this.btnDetectTrips = document.getElementById('btn-detect-trips');
    this.btnOpenCreateTrip = document.getElementById('btn-open-create-trip');
    this.inputTripsSearch = document.getElementById('input-trips-search');

    // Create Custom Trip Modal Elements
    this.modalCreateTrip = document.getElementById('modal-custom-trip');
    this.btnCloseCreateTrip = document.getElementById('btn-close-custom-trip-modal');
    this.btnCancelCreateTrip = document.getElementById('btn-cancel-custom-trip');
    this.btnSaveCustomTrip = document.getElementById('btn-save-custom-trip');
    this.inputTripName = document.getElementById('input-custom-trip-name');
    this.inputTripLoc = document.getElementById('input-custom-trip-loc');
    this.inputTripStart = document.getElementById('input-custom-trip-start');
    this.inputTripEnd = document.getElementById('input-custom-trip-end');
    this.dropzoneCreateTrip = document.getElementById('custom-trip-dropzone');
    this.inputFileCreateTrip = document.getElementById('input-custom-trip-files');
    this.btnBrowseCreateTrip = document.getElementById('btn-browse-custom-trip-files');
    this.queueSectionCreateTrip = document.getElementById('custom-trip-queue-section');
    this.queueListCreateTrip = document.getElementById('custom-trip-queue-list');
    this.queueCountCreateTrip = document.getElementById('custom-trip-queue-count');
    this.btnClearCreateTripQueue = document.getElementById('btn-clear-custom-trip-queue');

    // Append Media Modal Elements
    this.modalAppendMedia = document.getElementById('modal-append-trip-media');
    this.btnCloseAppendMedia = document.getElementById('btn-close-append-trip-modal');
    this.btnCancelAppendMedia = document.getElementById('btn-cancel-append-trip');
    this.btnConfirmAppendMedia = document.getElementById('btn-confirm-append-trip');
    this.appendModalTitle = document.getElementById('append-trip-modal-title');
    this.dropzoneAppendMedia = document.getElementById('append-trip-dropzone');
    this.inputFileAppendMedia = document.getElementById('input-append-trip-files');
    this.btnBrowseAppendMedia = document.getElementById('btn-browse-append-trip-files');
    this.queueSectionAppendMedia = document.getElementById('append-trip-queue-section');
    this.queueListAppendMedia = document.getElementById('append-trip-queue-list');
    this.queueCountAppendMedia = document.getElementById('append-trip-queue-count');
  }

  attachEvents() {
    // 0. Trips Search Input
    if (this.inputTripsSearch) {
      this.inputTripsSearch.addEventListener('input', (e) => {
        this.searchQuery = (e.target.value || '').toLowerCase().trim();
        this.render();
      });
    }

    // 1. Auto-Detect Button
    if (this.btnDetectTrips) {
      this.btnDetectTrips.addEventListener('click', async () => {
        showToast('Analyzing photos and clustering trips...', 'info');
        this.trips = await tripDetectionService.detectTrips(true);
        this.render();
        showToast(`Auto-detected ${this.trips.length} trips!`, 'success');
      });
    }

    // 2. Open Manual Trip Creator Modal
    if (this.btnOpenCreateTrip) {
      this.btnOpenCreateTrip.addEventListener('click', () => {
        this.openCreateTripModal();
      });
    }

    // Modal Close Triggers
    if (this.btnCloseCreateTrip) this.btnCloseCreateTrip.addEventListener('click', () => this.closeCreateTripModal());
    if (this.btnCancelCreateTrip) this.btnCancelCreateTrip.addEventListener('click', () => this.closeCreateTripModal());
    if (this.btnCloseAppendMedia) this.btnCloseAppendMedia.addEventListener('click', () => this.closeAppendMediaModal());
    if (this.btnCancelAppendMedia) this.btnCancelAppendMedia.addEventListener('click', () => this.closeAppendMediaModal());

    // Preset Destination Chips
    document.querySelectorAll('#trip-preset-chips button').forEach((chip) => {
      chip.addEventListener('click', () => {
        const loc = chip.dataset.loc;
        const lat = parseFloat(chip.dataset.lat);
        const lng = parseFloat(chip.dataset.lng);

        if (this.inputTripLoc) this.inputTripLoc.value = loc;
        this.selectedPresetCoords = { lat, lng, name: loc };

        if (this.inputTripName && !this.inputTripName.value) {
          const d = new Date();
          this.inputTripName.value = `${loc.split(',')[0]} Trip ${d.getFullYear()}`;
        }
      });
    });

    // Create Trip File Selection & Dropzone
    if (this.btnBrowseCreateTrip && this.inputFileCreateTrip) {
      this.btnBrowseCreateTrip.addEventListener('click', () => this.inputFileCreateTrip.click());
    }

    if (this.inputFileCreateTrip) {
      this.inputFileCreateTrip.addEventListener('change', (e) => {
        this.handleCreateTripFilesSelected(Array.from(e.target.files));
      });
    }

    if (this.dropzoneCreateTrip) {
      ['dragenter', 'dragover'].forEach(name => {
        this.dropzoneCreateTrip.addEventListener(name, (e) => {
          e.preventDefault();
          this.dropzoneCreateTrip.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        this.dropzoneCreateTrip.addEventListener(name, (e) => {
          e.preventDefault();
          this.dropzoneCreateTrip.classList.remove('dragover');
        });
      });

      this.dropzoneCreateTrip.addEventListener('drop', (e) => {
        this.handleCreateTripFilesSelected(Array.from(e.dataTransfer.files));
      });
    }

    if (this.btnClearCreateTripQueue) {
      this.btnClearCreateTripQueue.addEventListener('click', () => {
        this.createTripStagedFiles = [];
        this.renderCreateTripQueue();
      });
    }

    // Save Custom Trip
    if (this.btnSaveCustomTrip) {
      this.btnSaveCustomTrip.addEventListener('click', () => this.saveCustomTrip());
    }

    // Append Media Dropzone & File Selection
    if (this.btnBrowseAppendMedia && this.inputFileAppendMedia) {
      this.btnBrowseAppendMedia.addEventListener('click', () => this.inputFileAppendMedia.click());
    }

    if (this.inputFileAppendMedia) {
      this.inputFileAppendMedia.addEventListener('change', (e) => {
        this.handleAppendTripFilesSelected(Array.from(e.target.files));
      });
    }

    if (this.dropzoneAppendMedia) {
      ['dragenter', 'dragover'].forEach(name => {
        this.dropzoneAppendMedia.addEventListener(name, (e) => {
          e.preventDefault();
          this.dropzoneAppendMedia.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        this.dropzoneAppendMedia.addEventListener(name, (e) => {
          e.preventDefault();
          this.dropzoneAppendMedia.classList.remove('dragover');
        });
      });

      this.dropzoneAppendMedia.addEventListener('drop', (e) => {
        this.handleAppendTripFilesSelected(Array.from(e.dataTransfer.files));
      });
    }

    if (this.btnConfirmAppendMedia) {
      this.btnConfirmAppendMedia.addEventListener('click', () => this.saveAppendTripMedia());
    }
  }

  openCreateTripModal() {
    this.createTripStagedFiles = [];
    this.selectedPresetCoords = null;
    if (this.inputTripName) this.inputTripName.value = '';
    if (this.inputTripLoc) this.inputTripLoc.value = '';
    
    const today = new Date().toISOString().slice(0, 10);
    if (this.inputTripStart) this.inputTripStart.value = today;
    if (this.inputTripEnd) this.inputTripEnd.value = today;

    this.renderCreateTripQueue();
    if (this.modalCreateTrip) this.modalCreateTrip.style.display = 'flex';
  }

  closeCreateTripModal() {
    if (this.modalCreateTrip) this.modalCreateTrip.style.display = 'none';
  }

  openAppendMediaModal(trip) {
    this.activeAppendTrip = trip;
    this.appendTripStagedFiles = [];
    if (this.appendModalTitle) this.appendModalTitle.textContent = `Add Media to "${trip.name}"`;
    this.renderAppendTripQueue();
    if (this.modalAppendMedia) this.modalAppendMedia.style.display = 'flex';
  }

  closeAppendMediaModal() {
    this.activeAppendTrip = null;
    this.appendTripStagedFiles = [];
    if (this.modalAppendMedia) this.modalAppendMedia.style.display = 'none';
  }

  async handleCreateTripFilesSelected(files) {
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validFiles.length === 0) return;

    showToast(`Processing ${validFiles.length} files...`, 'info');

    for (const file of validFiles) {
      const meta = await exifService.extractMetadata(file);
      this.createTripStagedFiles.push({
        file,
        meta,
        thumbUrl: URL.createObjectURL(file)
      });
    }

    this.renderCreateTripQueue();
  }

  renderCreateTripQueue() {
    if (!this.queueSectionCreateTrip || !this.queueListCreateTrip) return;

    if (this.createTripStagedFiles.length === 0) {
      this.queueSectionCreateTrip.style.display = 'none';
      this.queueListCreateTrip.innerHTML = '';
      return;
    }

    this.queueSectionCreateTrip.style.display = 'block';
    if (this.queueCountCreateTrip) {
      this.queueCountCreateTrip.textContent = `${this.createTripStagedFiles.length} files staged for upload`;
    }

    this.queueListCreateTrip.innerHTML = '';
    this.createTripStagedFiles.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-3 p-2 bg-zinc-900 rounded-lg text-xs';
      row.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden">
          <img src="${item.thumbUrl}" class="w-10 h-10 object-cover rounded" alt="Thumb">
          <div class="overflow-hidden">
            <div class="text-white font-medium truncate">${item.file.name}</div>
            <div class="text-zinc-500 font-mono">${formatBytes(item.file.size)} • ${item.meta.hasGps ? '📍 GPS Found' : 'No GPS (will use trip location)'}</div>
          </div>
        </div>
        <button type="button" class="btn-icon btn-sm text-zinc-500 hover:text-red-400" id="btn-del-staged-${index}">
          <iconify-icon icon="lucide:trash-2"></iconify-icon>
        </button>
      `;

      row.querySelector(`#btn-del-staged-${index}`).addEventListener('click', () => {
        this.createTripStagedFiles.splice(index, 1);
        this.renderCreateTripQueue();
      });

      this.queueListCreateTrip.appendChild(row);
    });
  }

  async handleAppendTripFilesSelected(files) {
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validFiles.length === 0) return;

    showToast(`Processing ${validFiles.length} files...`, 'info');

    for (const file of validFiles) {
      const meta = await exifService.extractMetadata(file);
      this.appendTripStagedFiles.push({
        file,
        meta,
        thumbUrl: URL.createObjectURL(file)
      });
    }

    this.renderAppendTripQueue();
  }

  renderAppendTripQueue() {
    if (!this.queueSectionAppendMedia || !this.queueListAppendMedia) return;

    if (this.appendTripStagedFiles.length === 0) {
      this.queueSectionAppendMedia.style.display = 'none';
      this.queueListAppendMedia.innerHTML = '';
      return;
    }

    this.queueSectionAppendMedia.style.display = 'block';
    if (this.queueCountAppendMedia) {
      this.queueCountAppendMedia.textContent = `${this.appendTripStagedFiles.length} files staged to append`;
    }

    this.queueListAppendMedia.innerHTML = '';
    this.appendTripStagedFiles.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-3 p-2 bg-zinc-900 rounded-lg text-xs';
      row.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden">
          <img src="${item.thumbUrl}" class="w-10 h-10 object-cover rounded" alt="Thumb">
          <div class="overflow-hidden">
            <div class="text-white font-medium truncate">${item.file.name}</div>
            <div class="text-zinc-500 font-mono">${formatBytes(item.file.size)} • ${item.meta.hasGps ? '📍 GPS Found' : 'Uses Trip Coords'}</div>
          </div>
        </div>
        <button type="button" class="btn-icon btn-sm text-zinc-500 hover:text-red-400" id="btn-del-app-staged-${index}">
          <iconify-icon icon="lucide:trash-2"></iconify-icon>
        </button>
      `;

      row.querySelector(`#btn-del-app-staged-${index}`).addEventListener('click', () => {
        this.appendTripStagedFiles.splice(index, 1);
        this.renderAppendTripQueue();
      });

      this.queueListAppendMedia.appendChild(row);
    });
  }

  /**
   * Save a newly created custom trip and persist uploaded media
   */
  async saveCustomTrip() {
    const name = this.inputTripName ? this.inputTripName.value.trim() : '';
    const loc = this.inputTripLoc ? this.inputTripLoc.value.trim() : 'Custom Destination';
    const start = this.inputTripStart ? this.inputTripStart.value : new Date().toISOString().slice(0, 10);
    const end = this.inputTripEnd ? this.inputTripEnd.value : start;

    if (!name) {
      showToast('Please enter a name for the trip', 'warning');
      return;
    }

    showToast('Saving trip and uploading media...', 'info');

    // Default coords for trip if photos lack GPS
    const defaultCoords = this.selectedPresetCoords || { lat: 10.8505, lng: 78.6856, name: loc };

    const photoIds = [];
    let sumLat = 0;
    let sumLng = 0;
    let validGpsCount = 0;
    const distinctLocs = new Set([loc]);

    for (const staged of this.createTripStagedFiles) {
      const lat = staged.meta.latitude != null ? staged.meta.latitude : defaultCoords.lat;
      const lng = staged.meta.longitude != null ? staged.meta.longitude : defaultCoords.lng;
      const itemLoc = staged.meta.locationName || loc;

      sumLat += lat;
      sumLng += lng;
      validGpsCount++;
      distinctLocs.add(itemLoc);

      const mediaRecord = {
        id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        fileName: staged.file.name,
        fileSize: staged.file.size,
        mimeType: staged.file.type,
        mediaType: staged.file.type.startsWith('video/') ? 'video' : 'image',
        dateTaken: staged.meta.dateTaken || new Date(start).toISOString(),
        locationName: itemLoc,
        district: staged.meta.district || staged.meta.city,
        city: staged.meta.city,
        state: staged.meta.state,
        country: staged.meta.country || 'India',
        latitude: lat,
        longitude: lng,
        fileBlob: staged.file,
        exif: staged.meta.exif
      };

      await storageService.saveMedia(mediaRecord);
      photoIds.push(mediaRecord.id);
    }

    const tripRecord = {
      id: `trip_manual_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: name,
      startDate: new Date(start).toISOString(),
      endDate: new Date(end).toISOString(),
      photoIds: photoIds,
      centroid: {
        lat: validGpsCount > 0 ? sumLat / validGpsCount : defaultCoords.lat,
        lng: validGpsCount > 0 ? sumLng / validGpsCount : defaultCoords.lng
      },
      locations: Array.from(distinctLocs),
      coverPhotoId: photoIds[0] || null,
      autoGenerated: false // Marked as custom so auto-detection never clobbers it
    };

    await storageService.saveTrip(tripRecord);
    this.closeCreateTripModal();
    showToast(`Trip "${name}" created successfully with ${photoIds.length} media items!`, 'success');
    await this.app.refreshAllViews();
  }

  /**
   * Append media to an existing trip
   */
  async saveAppendTripMedia() {
    if (!this.activeAppendTrip || this.appendTripStagedFiles.length === 0) {
      this.closeAppendMediaModal();
      return;
    }

    showToast(`Uploading ${this.appendTripStagedFiles.length} items to "${this.activeAppendTrip.name}"...`, 'info');

    const trip = this.activeAppendTrip;
    const defaultCoords = trip.centroid || { lat: 10.8505, lng: 78.6856 };
    const newPhotoIds = [];

    for (const staged of this.appendTripStagedFiles) {
      const lat = staged.meta.latitude != null ? staged.meta.latitude : defaultCoords.lat;
      const lng = staged.meta.longitude != null ? staged.meta.longitude : defaultCoords.lng;
      const itemLoc = staged.meta.locationName || (trip.locations && trip.locations[0]) || 'Trip Destination';

      const mediaRecord = {
        id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        fileName: staged.file.name,
        fileSize: staged.file.size,
        mimeType: staged.file.type,
        mediaType: staged.file.type.startsWith('video/') ? 'video' : 'image',
        dateTaken: staged.meta.dateTaken || trip.startDate || new Date().toISOString(),
        locationName: itemLoc,
        district: staged.meta.district || staged.meta.city,
        city: staged.meta.city,
        state: staged.meta.state,
        country: staged.meta.country || 'India',
        latitude: lat,
        longitude: lng,
        fileBlob: staged.file,
        exif: staged.meta.exif
      };

      await storageService.saveMedia(mediaRecord);
      newPhotoIds.push(mediaRecord.id);
    }

    trip.photoIds = [...(trip.photoIds || []), ...newPhotoIds];
    if (!trip.coverPhotoId && newPhotoIds[0]) {
      trip.coverPhotoId = newPhotoIds[0];
    }
    trip.autoGenerated = false;

    await storageService.saveTrip(trip);
    this.closeAppendMediaModal();
    showToast(`Added ${newPhotoIds.length} items to "${trip.name}"!`, 'success');
    await this.app.refreshAllViews();
    await this.app.refreshAllViews();
  }

  async render() {
    this.allMedia = await storageService.getAllMedia();
    let trips = await tripDetectionService.detectTrips();

    if (this.searchQuery) {
      trips = trips.filter(t => {
        const matchName = (t.name || '').toLowerCase().includes(this.searchQuery);
        const matchLoc = (t.locations || []).join(' ').toLowerCase().includes(this.searchQuery);
        return matchName || matchLoc;
      });
    }

    this.trips = trips;

    if (this.tripsCountBadge) {
      this.tripsCountBadge.textContent = `${this.trips.length} Trips`;
    }

    if (!this.tripsGrid) return;
    this.tripsGrid.innerHTML = '';

    if (this.trips.length === 0) {
      this.tripsGrid.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <iconify-icon icon="lucide:compass" class="text-5xl opacity-40 mb-3 text-[#FF4500]"></iconify-icon>
          <h3 class="font-serif text-xl text-white mb-2">No trips created or detected yet</h3>
          <p class="text-sm max-w-md mx-auto mb-4 text-zinc-400">Create a custom trip with photos & videos or auto-detect journeys from your existing library.</p>
          <div class="flex justify-center gap-3 flex-wrap">
            <button class="btn btn-primary" id="btn-empty-create-trip">
              <iconify-icon icon="lucide:plus"></iconify-icon>
              <span>Create Custom Trip</span>
            </button>
            <button class="btn btn-secondary" id="btn-empty-detect-trips">
              <iconify-icon icon="lucide:sparkles"></iconify-icon>
              <span>Auto-Detect Clusters</span>
            </button>
          </div>
        </div>
      `;

      const btnEmptyCreate = document.getElementById('btn-empty-create-trip');
      if (btnEmptyCreate) btnEmptyCreate.addEventListener('click', () => this.openCreateTripModal());

      const btnEmptyDetect = document.getElementById('btn-empty-detect-trips');
      if (btnEmptyDetect) {
        btnEmptyDetect.addEventListener('click', async () => {
          this.trips = await tripDetectionService.detectTrips(true);
          this.render();
        });
      }
      return;
    }

    this.trips.forEach((trip) => {
      const card = document.createElement('div');
      card.className = 'trip-card';

      // Find cover photo
      const tripPhotos = this.allMedia.filter(m => (trip.photoIds || []).includes(m.id));
      const coverPhoto = tripPhotos.find(m => m.id === trip.coverPhotoId) || tripPhotos[0] || null;
      const coverThumb = coverPhoto ? resolveMediaUrl(coverPhoto) : '';

      const startD = new Date(trip.startDate);
      const endD = new Date(trip.endDate);
      const dateRangeStr = startD.toDateString() === endD.toDateString()
        ? formatDate(trip.startDate)
        : `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`;

      const locationsHtml = (trip.locations || [])
        .slice(0, 3)
        .map(loc => `<span class="trip-loc-badge"><iconify-icon icon="lucide:map-pin"></iconify-icon>${loc}</span>`)
        .join('');

      card.innerHTML = `
        <div class="trip-cover-wrap">
          ${coverThumb ? `<img src="${coverThumb}" alt="${trip.name}" class="trip-cover-img" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE_DATA_URI}';">` : `<div class="trip-cover-placeholder"><iconify-icon icon="lucide:image"></iconify-icon></div>`}
          <div class="trip-cover-overlay">
            <span class="trip-photo-counter"><iconify-icon icon="lucide:images"></iconify-icon> ${tripPhotos.length}</span>
            ${!trip.autoGenerated ? `<span class="trip-custom-tag"><iconify-icon icon="lucide:user-check"></iconify-icon> Custom</span>` : ''}
          </div>
        </div>

        <div class="trip-card-body">
          <div class="trip-header-row">
            <h3 class="trip-name font-serif" id="trip-name-${trip.id}">${trip.name}</h3>
            <div class="flex items-center gap-1">
              <button class="btn-icon btn-sm" id="btn-rename-trip-${trip.id}" title="Rename Trip">
                <iconify-icon icon="lucide:edit-2"></iconify-icon>
              </button>
              <button class="btn-icon btn-sm text-zinc-500 hover:text-red-400" id="btn-delete-trip-${trip.id}" title="Delete Trip">
                <iconify-icon icon="lucide:trash-2"></iconify-icon>
              </button>
            </div>
          </div>

          <div class="trip-date font-mono">${dateRangeStr}</div>

          <div class="trip-locations-list">
            ${locationsHtml}
          </div>

          <div class="trip-actions-row flex-wrap">
            <button class="btn btn-accent btn-sm" id="btn-view-route-${trip.id}" title="Explore journey route on World Map">
              <iconify-icon icon="lucide:route"></iconify-icon>
              <span>Route</span>
            </button>

            <button class="btn btn-secondary btn-sm" id="btn-view-timeline-${trip.id}" title="Filter Timeline to this trip">
              <iconify-icon icon="lucide:clock"></iconify-icon>
              <span>Timeline</span>
            </button>

            <button class="btn btn-secondary btn-sm" id="btn-add-photos-${trip.id}" title="Upload more photos/videos to this trip">
              <iconify-icon icon="lucide:plus"></iconify-icon>
              <span>+ Media</span>
            </button>

            <div class="trip-share-dropdown">
              <button class="btn-icon btn-sm" id="btn-share-trip-${trip.id}" title="Share / Standalone HTML Export">
                <iconify-icon icon="lucide:share-2"></iconify-icon>
              </button>
            </div>
          </div>
        </div>
      `;

      // 1. View Route on Map event (Feature 3)
      const btnRoute = card.querySelector(`#btn-view-route-${trip.id}`);
      if (btnRoute) {
        btnRoute.addEventListener('click', () => {
          this.app.mapView.selectTripRoute(trip, tripPhotos);
          this.app.switchView('map');
        });
      }

      // 2. View Timeline scoped to trip event
      const btnTimeline = card.querySelector(`#btn-view-timeline-${trip.id}`);
      if (btnTimeline) {
        btnTimeline.addEventListener('click', () => {
          this.app.timelineView.filterByTrip(trip, tripPhotos);
          this.app.switchView('timeline');
        });
      }

      // 3. Add Media to this Trip event
      const btnAddMedia = card.querySelector(`#btn-add-photos-${trip.id}`);
      if (btnAddMedia) {
        btnAddMedia.addEventListener('click', () => {
          this.openAppendMediaModal(trip);
        });
      }

      // 4. Share / Standalone Export event (Feature 4)
      const btnShare = card.querySelector(`#btn-share-trip-${trip.id}`);
      if (btnShare) {
        btnShare.addEventListener('click', () => {
          this.openShareDialog(trip, tripPhotos);
        });
      }

      // 5. Rename Trip event
      const btnRename = card.querySelector(`#btn-rename-trip-${trip.id}`);
      if (btnRename) {
        btnRename.addEventListener('click', async () => {
          const newName = prompt('Enter a new name for this trip:', trip.name);
          if (newName && newName.trim() && newName.trim() !== trip.name) {
            trip.name = newName.trim();
            trip.autoGenerated = false;
            await storageService.saveTrip(trip);
            showToast(`Trip renamed to "${trip.name}"`, 'success');
            this.render();
          }
        });
      }

      // 6. Delete Trip event
      const btnDelete = card.querySelector(`#btn-delete-trip-${trip.id}`);
      if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
          if (confirm(`Delete trip "${trip.name}"?\n(Your photos will remain safely preserved in the library).`)) {
            await storageService.deleteTrip(trip.id);
            showToast(`Trip "${trip.name}" deleted.`, 'info');
            this.render();
          }
        });
      }

      this.tripsGrid.appendChild(card);
    });
  }

  /**
   * Open share options modal for a trip
   */
  openShareDialog(trip, tripPhotos) {
    const choice = confirm(
      `Share Journey: "${trip.name}" (${tripPhotos.length} photos)\n\n` +
      `Click [OK] to download Standalone Single-File Offline HTML Viewer.\n` +
      `Click [Cancel] to copy URL-fragment share link.`
    );

    if (choice) {
      shareService.exportStandaloneHtml(trip, tripPhotos);
    } else {
      shareService.generateUrlFragmentLink(trip, tripPhotos);
    }
  }
}
