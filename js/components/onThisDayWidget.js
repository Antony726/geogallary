/**
 * On This Day Widget Component
 * Resurfaces memories captured on today's date in past years with horizontal swipeable cards.
 */

import { memoryResurfaceService } from '../services/memoryResurfaceService.js';
import { formatDate } from '../config.js';

export class OnThisDayWidget {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('on-this-day-section');
    this.carousel = document.getElementById('on-this-day-carousel');
    this.titleEl = document.getElementById('on-this-day-title');
    this.badgeEl = document.getElementById('on-this-day-badge');
    this.btnPrev = document.getElementById('btn-otd-prev');
    this.btnNext = document.getElementById('btn-otd-next');
    this.currentMatches = [];

    this.attachEvents();
  }

  attachEvents() {
    if (this.btnPrev && this.carousel) {
      this.btnPrev.addEventListener('click', () => {
        this.carousel.scrollBy({ left: -260, behavior: 'smooth' });
      });
    }

    if (this.btnNext && this.carousel) {
      this.btnNext.addEventListener('click', () => {
        this.carousel.scrollBy({ left: 260, behavior: 'smooth' });
      });
    }
  }

  /**
   * Render widget using all library media
   * @param {Array} allMedia
   * @param {Date} [testDate] Optional date override for testing
   */
  render(allMedia = [], testDate = new Date()) {
    if (!this.container || !this.carousel) return;

    const { matches, isFallback, targetDateStr } = memoryResurfaceService.getOnThisDayMemories(allMedia, testDate);
    this.currentMatches = matches;

    if (this.titleEl) {
      this.titleEl.textContent = `On This Day — ${targetDateStr}`;
    }

    if (this.badgeEl) {
      if (matches.length === 0) {
        this.badgeEl.style.display = 'none';
      } else if (isFallback) {
        this.badgeEl.textContent = 'Nearby Dates (±3 Days)';
        this.badgeEl.className = 'badge badge-subtle';
        this.badgeEl.style.display = 'inline-block';
      } else {
        this.badgeEl.textContent = `${matches.length} Historical Memories`;
        this.badgeEl.className = 'badge badge-accent';
        this.badgeEl.style.display = 'inline-block';
      }
    }

    this.carousel.innerHTML = '';

    if (matches.length === 0) {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';

    matches.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'otd-card';

      const thumb = item.thumbUrl || item.url || (item.fileBlob ? URL.createObjectURL(item.fileBlob) : '');
      const isVideo = item.mediaType === 'video';

      card.innerHTML = `
        <div class="otd-media-wrap">
          ${isVideo ? `<video src="${thumb}" muted preload="metadata"></video>` : `<img src="${thumb}" alt="${item.fileName}" loading="lazy">`}
          <span class="otd-years-pill ${item.isExact ? 'exact' : 'fallback'}">
            <iconify-icon icon="lucide:history"></iconify-icon>
            <span>${item.badgeLabel}</span>
          </span>
        </div>
        <div class="otd-info">
          <span class="otd-loc">
            <iconify-icon icon="lucide:map-pin" class="text-[#FF4500]"></iconify-icon>
            <span>${item.locationName || 'Unspecified Location'}</span>
          </span>
          <span class="otd-date font-mono">${formatDate(item.dateTaken)}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        // Open in lightbox
        const globalIdx = allMedia.findIndex(m => m.id === item.id);
        if (globalIdx !== -1) {
          this.app.lightbox.open(allMedia, globalIdx);
        } else {
          this.app.lightbox.open(matches, index);
        }
      });

      this.carousel.appendChild(card);
    });
  }
}
