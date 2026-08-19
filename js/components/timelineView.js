/**
 * Timeline Stream View Component
 * Chronological photo stream grouped by Year -> Month -> Day
 */

import { storageService } from '../services/storageService.js';
import { formatDate, showToast } from '../config.js';

export class TimelineView {
  constructor(app) {
    this.app = app;
    this.allMedia = [];
    this.filteredMedia = [];
    this.activeTypeFilter = 'all'; // 'all' | 'image' | 'video'
    this.activeLocationFilter = null;
    this.searchQuery = '';

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.streamContainer = document.getElementById('timeline-stream-content');
    this.scrubberList = document.getElementById('timeline-scrubber-list');
    this.itemCounter = document.getElementById('timeline-item-count');
    this.filterChips = document.querySelectorAll('.timeline-toolbar .filter-chip');
    this.btnExportZip = document.getElementById('btn-export-timeline-zip');
  }

  attachEvents() {
    this.filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeTypeFilter = chip.dataset.type;
        this.applyFiltersAndRender();
      });
    });

    if (this.btnExportZip) {
      this.btnExportZip.addEventListener('click', async () => {
        try {
          showToast('Generating organized ZIP archive...', 'info');
          const zipBlob = await storageService.exportAsZip(this.filteredMedia);
          const link = document.createElement('a');
          link.href = URL.createObjectURL(zipBlob);
          link.download = `GeoTimeline_Archive_${Date.now()}.zip`;
          link.click();
          showToast('Download started!', 'success');
        } catch (err) {
          console.error(err);
          showToast('Failed to export ZIP', 'danger');
        }
      });
    }
  }

  async render() {
    this.allMedia = await storageService.getAllMedia();
    this.applyFiltersAndRender();
  }

  filterByLocation(locationName) {
    this.activeLocationFilter = locationName;
    this.activeTripPhotoIds = null;
    this.applyFiltersAndRender();
  }

  filterByTrip(trip, tripPhotos) {
    this.activeTrip = trip;
    this.activeTripPhotoIds = new Set(trip.photoIds);
    this.activeLocationFilter = null;
    this.applyFiltersAndRender();
  }

  clearTripFilter() {
    this.activeTrip = null;
    this.activeTripPhotoIds = null;
    this.applyFiltersAndRender();
  }

  setSearchQuery(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.applyFiltersAndRender();
  }

  applyFiltersAndRender() {
    this.filteredMedia = this.allMedia.filter((item) => {
      // Scoped trip filter
      if (this.activeTripPhotoIds && !this.activeTripPhotoIds.has(item.id)) {
        return false;
      }
      // Media type filter
      if (this.activeTypeFilter !== 'all' && item.mediaType !== this.activeTypeFilter) {
        return false;
      }

      // Location filter
      if (this.activeLocationFilter && item.locationName !== this.activeLocationFilter) {
        return false;
      }

      // Search Query filter
      if (this.searchQuery) {
        const matchName = (item.fileName || '').toLowerCase().includes(this.searchQuery);
        const matchLoc = (item.locationName || '').toLowerCase().includes(this.searchQuery);
        const matchCity = (item.city || '').toLowerCase().includes(this.searchQuery);
        const matchCountry = (item.country || '').toLowerCase().includes(this.searchQuery);
        const matchYear = (item.year || '').toLowerCase().includes(this.searchQuery);
        const matchMonth = (item.yearMonth || '').toLowerCase().includes(this.searchQuery);

        if (!matchName && !matchLoc && !matchCity && !matchCountry && !matchYear && !matchMonth) {
          return false;
        }
      }

      return true;
    });

    if (this.itemCounter) {
      this.itemCounter.textContent = `${this.filteredMedia.length} memories`;
    }

    this.renderStream();
    this.renderScrubber();
  }

  renderStream() {
    if (!this.streamContainer) return;
    this.streamContainer.innerHTML = '';

    if (this.filteredMedia.length === 0) {
      this.streamContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.4;"></i>
          <h3>No media matches current filter</h3>
          <p style="font-size: 0.85rem; margin-top: 6px;">Try adjusting filters or uploading new photos.</p>
        </div>
      `;
      return;
    }

    // Group media by Date (YYYY-MM-DD)
    const dayGroups = {};
    this.filteredMedia.forEach((item) => {
      const dayKey = item.day || (item.dateTaken ? item.dateTaken.split('T')[0] : 'Unknown Date');
      if (!dayGroups[dayKey]) {
        dayGroups[dayKey] = {
          dateStr: dayKey,
          location: item.locationName,
          items: []
        };
      }
      dayGroups[dayKey].items.push(item);
    });

    // Render each day group
    Object.keys(dayGroups).forEach((dayKey) => {
      const group = dayGroups[dayKey];
      const groupEl = document.createElement('div');
      groupEl.className = 'timeline-group';
      groupEl.id = `timeline-day-${dayKey}`;

      const dateHeader = document.createElement('div');
      dateHeader.className = 'timeline-date-header';
      dateHeader.innerHTML = `
        <i class="fa-solid fa-calendar-day text-indigo"></i>
        <span class="date-header-day">${formatDate(group.dateStr)}</span>
        <span class="date-header-location">
          <i class="fa-solid fa-location-dot"></i>
          <span>${group.location || 'Multiple Locations'}</span>
        </span>
      `;

      const gridEl = document.createElement('div');
      gridEl.className = 'media-grid';

      group.items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        
        const thumb = item.thumbUrl || item.url || (item.fileBlob ? URL.createObjectURL(item.fileBlob) : '');
        const isVideo = item.mediaType === 'video';

        card.innerHTML = `
          ${isVideo ? `<video src="${thumb}" muted preload="metadata"></video><span class="media-badge-video"><i class="fa-solid fa-play"></i></span>` : `<img src="${thumb}" alt="${item.fileName}" loading="lazy">`}
          <div class="media-card-info-bar">
            <span class="media-loc-tag" title="${item.locationName || 'Unspecified'}"><i class="fa-solid fa-map-pin"></i> ${item.locationName || 'Unspecified'}</span>
            <span class="media-time-tag">${item.dateTaken ? new Date(item.dateTaken).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          const indexInGlobal = this.filteredMedia.indexOf(item);
          this.app.lightbox.open(this.filteredMedia, indexInGlobal);
        });

        gridEl.appendChild(card);
      });

      groupEl.appendChild(dateHeader);
      groupEl.appendChild(gridEl);
      this.streamContainer.appendChild(groupEl);
    });
  }

  renderScrubber() {
    if (!this.scrubberList) return;
    this.scrubberList.innerHTML = '';

    const years = {};
    this.filteredMedia.forEach((item) => {
      const y = item.year || 'Unknown';
      const ym = item.yearMonth || 'Unknown';
      if (!years[y]) years[y] = new Set();
      years[y].add(ym);
    });

    Object.keys(years).sort().reverse().forEach((year) => {
      const yearHeader = document.createElement('div');
      yearHeader.className = 'scrubber-year';
      yearHeader.textContent = year;
      this.scrubberList.appendChild(yearHeader);

      Array.from(years[year]).sort().reverse().forEach((ym) => {
        const monthLink = document.createElement('span');
        monthLink.className = 'scrubber-month';
        
        const monthNum = ym.includes('-') ? ym.split('-')[1] : ym;
        const monthName = new Date(`${year}-${monthNum}-01`).toLocaleString('default', { month: 'long' });
        
        monthLink.textContent = monthName || ym;
        monthLink.addEventListener('click', () => {
          // Scroll to the first day of that month
          const targetDay = this.filteredMedia.find(m => m.yearMonth === ym);
          if (targetDay) {
            const el = document.getElementById(`timeline-day-${targetDay.day}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        });

        this.scrubberList.appendChild(monthLink);
      });
    });
  }
}
