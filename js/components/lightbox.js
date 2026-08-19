/**
 * Lightbox & EXIF Metadata Inspector Component
 * Fullscreen media viewer with complete EXIF drawer and mini location map
 */

import { formatBytes, formatDate, resolveMediaUrl, FALLBACK_IMAGE_DATA_URI } from '../config.js';

export class Lightbox {
  constructor(app) {
    this.app = app;
    this.mediaList = [];
    this.currentIndex = 0;
    this.isExifOpen = window.innerWidth > 768;
    this.lightboxMiniMap = null;
    this.lightboxMarker = null;

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.modalEl = document.getElementById('modal-lightbox');
    this.wrapper = document.getElementById('lightbox-media-wrapper');
    this.filenameEl = document.getElementById('lightbox-filename');
    this.counterEl = document.getElementById('lightbox-counter');
    this.exifDrawer = document.getElementById('lightbox-exif-drawer');
    this.exifContent = document.getElementById('lightbox-exif-content');
    
    this.btnPrev = document.getElementById('btn-lightbox-prev');
    this.btnNext = document.getElementById('btn-lightbox-next');
    this.btnClose = document.getElementById('btn-lightbox-close');
    this.btnDownload = document.getElementById('btn-lightbox-download');
    this.btnInfoToggle = document.getElementById('btn-lightbox-info-toggle');
    this.btnCloseExifDrawer = document.getElementById('btn-close-exif-drawer');
  }

  attachEvents() {
    if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());
    if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.prev());
    if (this.btnNext) this.btnNext.addEventListener('click', () => this.next());

    if (this.btnInfoToggle && this.exifDrawer) {
      this.btnInfoToggle.addEventListener('click', () => {
        this.isExifOpen = !this.isExifOpen;
        this.exifDrawer.classList.toggle('open', this.isExifOpen);
      });
    }

    if (this.btnCloseExifDrawer && this.exifDrawer) {
      this.btnCloseExifDrawer.addEventListener('click', () => {
        this.isExifOpen = false;
        this.exifDrawer.classList.remove('open');
      });
    }

    if (this.btnDownload) {
      this.btnDownload.addEventListener('click', () => {
        const item = this.mediaList[this.currentIndex];
        if (!item) return;

        const src = resolveMediaUrl(item);
        const a = document.createElement('a');
        a.href = src;
        a.download = item.fileName || 'download';
        a.click();
      });
    }

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });
  }

  isOpen() {
    return this.modalEl && this.modalEl.style.display === 'flex';
  }

  open(mediaList, startIndex = 0) {
    this.mediaList = mediaList || [];
    this.currentIndex = startIndex;
    this.isExifOpen = window.innerWidth > 768;
    if (this.modalEl) this.modalEl.style.display = 'flex';
    if (this.exifDrawer) this.exifDrawer.classList.toggle('open', this.isExifOpen);
    this.renderCurrent();
  }

  close() {
    if (this.modalEl) this.modalEl.style.display = 'none';
    if (this.wrapper) this.wrapper.innerHTML = '';
  }

  prev() {
    if (this.mediaList.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.mediaList.length) % this.mediaList.length;
    this.renderCurrent();
  }

  next() {
    if (this.mediaList.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.mediaList.length;
    this.renderCurrent();
  }

  renderCurrent() {
    const item = this.mediaList[this.currentIndex];
    if (!item || !this.wrapper) return;

    // Update Counter & Title
    if (this.filenameEl) this.filenameEl.textContent = item.fileName;
    if (this.counterEl) this.counterEl.textContent = `${this.currentIndex + 1} / ${this.mediaList.length}`;

    // Render Media in Stage
    const src = resolveMediaUrl(item);
    const isVideo = item.mediaType === 'video';

    this.wrapper.innerHTML = '';
    if (isVideo) {
      const vid = document.createElement('video');
      vid.src = src;
      vid.controls = true;
      vid.autoplay = true;
      this.wrapper.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = src;
      img.alt = item.fileName || 'Photo';
      img.onerror = () => {
        img.onerror = null;
        img.src = FALLBACK_IMAGE_DATA_URI;
      };
      this.wrapper.appendChild(img);
    }

    // Render EXIF Drawer
    this.renderExif(item);
  }

  renderExif(item) {
    if (!this.exifContent) return;

    const exif = item.exif || {};
    const d = new Date(item.dateTaken);

    let html = `
      <!-- File Metadata -->
      <div class="exif-group">
        <span class="exif-group-title">File Details</span>
        <div class="exif-row"><span class="exif-key">File Name</span><span class="exif-val">${item.fileName}</span></div>
        <div class="exif-row"><span class="exif-key">File Size</span><span class="exif-val">${formatBytes(item.fileSize)}</span></div>
        <div class="exif-row"><span class="exif-key">Format</span><span class="exif-val">${item.mimeType || 'image/jpeg'}</span></div>
        <div class="exif-row"><span class="exif-key">Resolution</span><span class="exif-val">${exif.dimensions || 'N/A'}</span></div>
        <div class="exif-row"><span class="exif-key">Storage Path</span><span class="exif-val" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent);">${item.storagePath || item.fileName}</span></div>
      </div>

      <!-- Timeline Details -->
      <div class="exif-group">
        <span class="exif-group-title">Timeline & Capture Date</span>
        <div class="exif-row"><span class="exif-key">Date Taken</span><span class="exif-val">${formatDate(item.dateTaken)}</span></div>
        <div class="exif-row"><span class="exif-key">Time</span><span class="exif-val">${!isNaN(d.getTime()) ? d.toLocaleTimeString() : 'N/A'}</span></div>
        <div class="exif-row"><span class="exif-key">Folder Group</span><span class="exif-val">${item.yearMonth || 'Unknown'}</span></div>
      </div>

      <!-- Location Details -->
      <div class="exif-group">
        <span class="exif-group-title">Location & Geocoding</span>
        <div class="exif-row"><span class="exif-key">Location Name</span><span class="exif-val" style="color: var(--accent); font-weight:600;">${item.locationName || 'Unspecified'}</span></div>
        <div class="exif-row"><span class="exif-key">City / Country</span><span class="exif-val">${item.city || 'Unknown'}, ${item.country || 'Unknown'}</span></div>
        <div class="exif-row"><span class="exif-key">GPS Coordinates</span><span class="exif-val">${item.latitude != null ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}` : 'No GPS Tag'}</span></div>
        <div id="lightbox-mini-map" class="exif-mini-map"></div>
      </div>

      <!-- Camera Hardware -->
      <div class="exif-group">
        <span class="exif-group-title">Camera & Optics</span>
        <div class="exif-row"><span class="exif-key">Camera</span><span class="exif-val">${exif.make || ''} ${exif.model || 'Unknown'}</span></div>
        <div class="exif-row"><span class="exif-key">Lens</span><span class="exif-val">${exif.lens || 'N/A'}</span></div>
        <div class="exif-row"><span class="exif-key">Focal Length</span><span class="exif-val">${exif.focalLength || 'N/A'}</span></div>
        <div class="exif-row"><span class="exif-key">Aperture</span><span class="exif-val">${exif.fNumber || 'N/A'}</span></div>
        <div class="exif-row"><span class="exif-key">Exposure</span><span class="exif-val">${exif.exposureTime || 'N/A'}</span></div>
        <div class="exif-row"><span class="exif-key">ISO</span><span class="exif-val">${exif.iso || 'N/A'}</span></div>
      </div>
    `;

    this.exifContent.innerHTML = html;

    // Initialize/Update Mini Map in Drawer
    if (item.latitude != null && item.longitude != null && typeof window.L !== 'undefined') {
      setTimeout(() => {
        const miniMapEl = document.getElementById('lightbox-mini-map');
        if (!miniMapEl) return;

        if (this.lightboxMiniMap) {
          this.lightboxMiniMap.remove();
          this.lightboxMiniMap = null;
        }

        this.lightboxMiniMap = window.L.map('lightbox-mini-map', {
          zoomControl: false,
          attributionControl: false
        }).setView([item.latitude, item.longitude], 13);

        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 18
        }).addTo(this.lightboxMiniMap);

        this.lightboxMarker = window.L.marker([item.latitude, item.longitude]).addTo(this.lightboxMiniMap);
      }, 100);
    }
  }
}
