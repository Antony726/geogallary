/**
 * Timeline Stream View Component
 * Featuring Mode A: Time-Travel Focus View (Default) & Mode B: Continuous Feed Stream
 */

import { storageService } from '../services/storageService.js';
import { formatDate, showToast, resolveMediaUrl, FALLBACK_IMAGE_DATA_URI } from '../config.js';

export class TimelineView {
  constructor(app) {
    this.app = app;
    this.allMedia = [];
    this.filteredMedia = [];
    this.viewMode = 'focus'; // 'focus' (Time-Travel Focus View) | 'stream' (Continuous Feed)
    this.activeTypeFilter = 'all'; // 'all' | 'image' | 'video'
    this.activeLocationFilter = null;
    this.searchQuery = '';

    this.selectedYear = null;
    this.selectedMonth = null;
    this.selectedDay = null;

    this.availableYears = [];
    this.availableMonths = [];
    this.availableDays = [];

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.streamContainer = document.getElementById('timeline-stream-content');
    this.itemCounter = document.getElementById('timeline-item-count');
    this.filterChips = document.querySelectorAll('.timeline-toolbar .filter-chip');
    this.btnExportZip = document.getElementById('btn-export-timeline-zip');

    // View Mode Toggle Buttons
    this.btnModeFocus = document.getElementById('btn-mode-focus');
    this.btnModeStream = document.getElementById('btn-mode-stream');

    // Navigator Reels
    this.reelYears = document.getElementById('time-reel-years');
    this.reelMonths = document.getElementById('time-reel-months');
    this.reelDays = document.getElementById('time-reel-days');

    // Capsule Banner
    this.capsuleBanner = document.getElementById('memory-capsule-banner');
    this.labelCapsuleTitle = document.getElementById('label-capsule-title');
    this.labelCapsuleSubtitle = document.getElementById('label-capsule-subtitle');
    this.btnCapsulePrev = document.getElementById('btn-capsule-prev');
    this.btnCapsuleNext = document.getElementById('btn-capsule-next');
    this.labelCapsulePrevText = document.getElementById('label-capsule-prev-text');
    this.labelCapsuleNextText = document.getElementById('label-capsule-next-text');
  }

  attachEvents() {
    // Mode Switcher
    if (this.btnModeFocus) {
      this.btnModeFocus.addEventListener('click', () => {
        this.viewMode = 'focus';
        if (this.btnModeFocus) this.btnModeFocus.classList.add('active');
        if (this.btnModeStream) this.btnModeStream.classList.remove('active');
        if (this.capsuleBanner) this.capsuleBanner.style.display = 'flex';
        this.renderStream();
      });
    }

    if (this.btnModeStream) {
      this.btnModeStream.addEventListener('click', () => {
        this.viewMode = 'stream';
        if (this.btnModeStream) this.btnModeStream.classList.add('active');
        if (this.btnModeFocus) this.btnModeFocus.classList.remove('active');
        if (this.capsuleBanner) this.capsuleBanner.style.display = 'none';
        this.renderStream();
      });
    }

    // Filter Chips
    this.filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeTypeFilter = chip.dataset.type;
        this.applyFiltersAndRender();
      });
    });

    // Step Prev/Next on Capsule Banner
    if (this.btnCapsulePrev) {
      this.btnCapsulePrev.addEventListener('click', () => this.stepPeriod(-1));
    }
    if (this.btnCapsuleNext) {
      this.btnCapsuleNext.addEventListener('click', () => this.stepPeriod(1));
    }

    // Export ZIP
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
      if (this.activeTripPhotoIds && !this.activeTripPhotoIds.has(item.id)) return false;
      if (this.activeTypeFilter !== 'all' && item.mediaType !== this.activeTypeFilter) return false;
      if (this.activeLocationFilter && item.locationName !== this.activeLocationFilter) return false;

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

    this.buildTimeIndexTree();
    this.renderTimeTravelNavigator();
    this.renderStream();
  }

  buildTimeIndexTree() {
    const yearMap = {};
    this.filteredMedia.forEach((item) => {
      const y = item.year || 'Unspecified';
      const ym = item.yearMonth || 'Unspecified';
      const d = item.day || (item.dateTaken ? item.dateTaken.split('T')[0] : 'Unspecified Date');

      if (!yearMap[y]) yearMap[y] = { count: 0, months: {} };
      yearMap[y].count++;

      if (!yearMap[y].months[ym]) yearMap[y].months[ym] = { count: 0, days: {} };
      yearMap[y].months[ym].count++;

      if (!yearMap[y].months[ym].days[d]) yearMap[y].months[ym].days[d] = { count: 0, location: item.locationName };
      yearMap[y].months[ym].days[d].count++;
    });

    this.timeTree = yearMap;
    this.availableYears = Object.keys(yearMap).sort().reverse();

    // Default select latest available Year/Month/Day if not explicitly selected
    if (!this.selectedYear || !yearMap[this.selectedYear]) {
      this.selectedYear = this.availableYears[0] || null;
    }

    if (this.selectedYear && yearMap[this.selectedYear]) {
      this.availableMonths = Object.keys(yearMap[this.selectedYear].months).sort().reverse();
      if (!this.selectedMonth || !yearMap[this.selectedYear].months[this.selectedMonth]) {
        this.selectedMonth = this.availableMonths[0] || null;
      }
    } else {
      this.availableMonths = [];
      this.selectedMonth = null;
    }

    if (this.selectedYear && this.selectedMonth && yearMap[this.selectedYear]?.months[this.selectedMonth]) {
      this.availableDays = Object.keys(yearMap[this.selectedYear].months[this.selectedMonth].days).sort().reverse();
      if (!this.selectedDay || !yearMap[this.selectedYear].months[this.selectedMonth].days[this.selectedDay]) {
        this.selectedDay = this.availableDays[0] || null;
      }
    } else {
      this.availableDays = [];
      this.selectedDay = null;
    }
  }

  renderTimeTravelNavigator() {
    if (!this.reelYears || !this.reelMonths || !this.reelDays) return;

    // 1. Render Years Track
    this.reelYears.innerHTML = '';
    const allPill = document.createElement('button');
    allPill.className = `year-pill ${!this.selectedYear ? 'active' : ''}`;
    allPill.innerHTML = `<span>All Time</span> <span class="year-count">${this.filteredMedia.length}</span>`;
    allPill.onclick = () => {
      this.selectedYear = null;
      this.selectedMonth = null;
      this.selectedDay = null;
      this.buildTimeIndexTree();
      this.renderTimeTravelNavigator();
      this.renderStream();
    };
    this.reelYears.appendChild(allPill);

    this.availableYears.forEach(y => {
      const yPill = document.createElement('button');
      yPill.className = `year-pill ${this.selectedYear === y ? 'active' : ''}`;
      yPill.innerHTML = `<span>${y}</span> <span class="year-count">${this.timeTree[y].count}</span>`;
      yPill.onclick = () => {
        this.selectedYear = y;
        this.selectedMonth = null;
        this.selectedDay = null;
        this.buildTimeIndexTree();
        this.renderTimeTravelNavigator();
        this.renderStream();
      };
      this.reelYears.appendChild(yPill);
    });

    // 2. Render Months Track
    this.reelMonths.innerHTML = '';
    if (this.selectedYear && this.availableMonths.length > 0) {
      this.availableMonths.forEach(ym => {
        const mCard = document.createElement('button');
        mCard.className = `month-card ${this.selectedMonth === ym ? 'active' : ''}`;

        const monthNum = ym.includes('-') ? ym.split('-')[1] : ym;
        const monthName = !isNaN(parseInt(monthNum)) ? new Date(`${this.selectedYear}-${monthNum}-01`).toLocaleString('default', { month: 'short' }) : ym;
        const count = this.timeTree[this.selectedYear].months[ym].count;

        mCard.innerHTML = `
          <div class="month-name">${monthName} ${this.selectedYear}</div>
          <div class="month-count">${count} memories</div>
        `;
        mCard.onclick = () => {
          this.selectedMonth = ym;
          this.selectedDay = null;
          this.buildTimeIndexTree();
          this.renderTimeTravelNavigator();
          this.renderStream();
        };
        this.reelMonths.appendChild(mCard);
      });
    }

    // 3. Render Days Track
    this.reelDays.innerHTML = '';
    if (this.selectedMonth && this.availableDays.length > 0) {
      this.availableDays.forEach(d => {
        const dPill = document.createElement('button');
        dPill.className = `day-pill ${this.selectedDay === d ? 'active' : ''}`;
        const dayInfo = this.timeTree[this.selectedYear].months[this.selectedMonth].days[d];
        const dayFormatted = d !== 'Unspecified Date' ? formatDate(d) : 'Unspecified Date';

        dPill.innerHTML = `
          <span>${dayFormatted}</span>
          <span class="day-count">(${dayInfo.count})</span>
        `;
        dPill.onclick = () => {
          this.selectedDay = d;
          this.renderTimeTravelNavigator();
          this.renderStream();
        };
        this.reelDays.appendChild(dPill);
      });
    }
  }

  stepPeriod(direction) {
    if (this.availableDays.length > 0 && this.selectedDay) {
      const idx = this.availableDays.indexOf(this.selectedDay);
      const newIdx = idx - direction; // Reverse order (newest first)
      if (newIdx >= 0 && newIdx < this.availableDays.length) {
        this.selectedDay = this.availableDays[newIdx];
        this.renderTimeTravelNavigator();
        this.renderStream();
      } else {
        showToast('Reached end of available dates in this month', 'info');
      }
    }
  }

  renderStream() {
    if (!this.streamContainer) return;
    this.streamContainer.innerHTML = '';

    let displayMedia = this.filteredMedia;

    // In Focus Mode, filter media to selected period only
    if (this.viewMode === 'focus') {
      if (this.selectedDay) {
        displayMedia = this.filteredMedia.filter(m => (m.day || m.dateTaken?.split('T')[0]) === this.selectedDay);
      } else if (this.selectedMonth) {
        displayMedia = this.filteredMedia.filter(m => m.yearMonth === this.selectedMonth);
      } else if (this.selectedYear) {
        displayMedia = this.filteredMedia.filter(m => m.year === this.selectedYear);
      }

      // Update Memory Capsule Banner Info
      if (this.capsuleBanner) this.capsuleBanner.style.display = 'flex';
      if (this.labelCapsuleTitle) {
        if (this.selectedDay) {
          const loc = displayMedia[0]?.locationName || '';
          this.labelCapsuleTitle.textContent = `${formatDate(this.selectedDay)} ${loc ? '• ' + loc : ''}`;
        } else if (this.selectedMonth) {
          this.labelCapsuleTitle.textContent = `Memory Capsule: ${this.selectedMonth}`;
        } else if (this.selectedYear) {
          this.labelCapsuleTitle.textContent = `Year Capsule: ${this.selectedYear}`;
        } else {
          this.labelCapsuleTitle.textContent = `All Time Memories Archive`;
        }
      }
      if (this.labelCapsuleSubtitle) {
        this.labelCapsuleSubtitle.textContent = `Showing ${displayMedia.length} memories in Time-Travel Focus Mode`;
      }
    } else {
      if (this.capsuleBanner) this.capsuleBanner.style.display = 'none';
    }

    if (displayMedia.length === 0) {
      this.streamContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.4;"></i>
          <h3>No media in this selected timeline period</h3>
          <p style="font-size: 0.85rem; margin-top: 6px;">Pick another date on the top navigator reel or switch to Full Stream.</p>
        </div>
      `;
      return;
    }

    // Group media by Date (YYYY-MM-DD)
    const dayGroups = {};
    displayMedia.forEach((item) => {
      const dayKey = item.day || (item.dateTaken ? item.dateTaken.split('T')[0] : 'Unspecified Date');
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
      dateHeader.className = 'group-date-header';
      dateHeader.innerHTML = `
        <h3 class="group-date-title">${formatDate(group.dateStr)}</h3>
        <span class="group-date-count font-mono">${group.items.length} memories ${group.location ? `• <i class="fa-solid fa-location-dot" style="color: var(--accent);"></i> ${group.location}` : ''}</span>
      `;

      const gridEl = document.createElement('div');
      gridEl.className = 'timeline-media-grid';

      group.items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'timeline-media-card';
        
        const thumb = resolveMediaUrl(item);
        const isVideo = item.mediaType === 'video';

        card.innerHTML = `
          ${isVideo ? `<video src="${thumb}" muted preload="metadata"></video><span class="media-badge-video"><iconify-icon icon="lucide:play"></iconify-icon></span>` : `<img src="${thumb}" alt="${item.fileName || 'Memory'}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE_DATA_URI}';">`}
          <div class="media-tag-loc" title="${item.locationName || 'Unspecified'}">
            <iconify-icon icon="lucide:map-pin"></iconify-icon>
            <span>${item.locationName || 'Unspecified'}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          const indexInGlobal = displayMedia.indexOf(item);
          this.app.lightbox.open(displayMedia, indexInGlobal);
        });

        gridEl.appendChild(card);
      });

      groupEl.appendChild(dateHeader);
      groupEl.appendChild(gridEl);
      this.streamContainer.appendChild(groupEl);
    });
  }
}
