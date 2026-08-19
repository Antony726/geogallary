/**
 * Dashboard & Analytics View Component
 * Renders metrics, interactive Chart.js activity graph, mini map, and highlights carousel
 */

import { storageService } from '../services/storageService.js';
import { formatBytes, formatDate } from '../config.js';

export class DashboardView {
  constructor(app) {
    this.app = app;
    this.chart = null;
    this.chartPeriod = 'month'; // 'month' | 'year'
    this.miniMap = null;
    this.miniMapMarkers = [];

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.statTotalCount = document.getElementById('stat-total-count');
    this.statBreakdown = document.getElementById('stat-breakdown-count');
    this.statLocationsCount = document.getElementById('stat-locations-count');
    this.statCountriesCount = document.getElementById('stat-countries-count');
    this.statTimelineSpan = document.getElementById('stat-timeline-span');
    this.statOldestNewest = document.getElementById('stat-oldest-newest');
    this.statStorageSize = document.getElementById('stat-storage-size');
    this.statStorageDest = document.getElementById('stat-storage-dest');
    
    this.topLocationsList = document.getElementById('dashboard-top-locations');
    this.featuredContainer = document.getElementById('featured-memories-container');
    this.chartCanvas = document.getElementById('timelineChart');
    this.chartEmptyState = document.getElementById('chart-empty-state');
    
    this.btnHeroUpload = document.getElementById('btn-hero-upload');
    this.btnHeroDemo = document.getElementById('btn-hero-load-demo');
    this.btnFullMap = document.getElementById('btn-dashboard-view-full-map');
    
    this.btnFeaturedPrev = document.getElementById('btn-featured-prev');
    this.btnFeaturedNext = document.getElementById('btn-featured-next');

    this.periodButtons = document.querySelectorAll('[data-chart-period]');
  }

  attachEvents() {
    if (this.btnHeroUpload) {
      this.btnHeroUpload.addEventListener('click', () => this.app.uploadModal.open());
    }

    if (this.btnHeroDemo) {
      this.btnHeroDemo.addEventListener('click', async () => {
        await storageService.seedSampleMemories();
        await this.app.refreshAllViews();
      });
    }

    if (this.btnFullMap) {
      this.btnFullMap.addEventListener('click', () => this.app.switchView('map'));
    }

    // Chart period switcher
    this.periodButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.periodButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.chartPeriod = btn.dataset.chartPeriod;
        this.renderChart();
      });
    });

    // Featured memories carousel scrolling
    if (this.btnFeaturedPrev && this.featuredContainer) {
      this.btnFeaturedPrev.addEventListener('click', () => {
        this.featuredContainer.scrollBy({ left: -300, behavior: 'smooth' });
      });
    }

    if (this.btnFeaturedNext && this.featuredContainer) {
      this.btnFeaturedNext.addEventListener('click', () => {
        this.featuredContainer.scrollBy({ left: 300, behavior: 'smooth' });
      });
    }
  }

  async render() {
    const analytics = await storageService.getAnalytics();
    const allMedia = await storageService.getAllMedia();

    // 1. Update Metric Cards
    this.statTotalCount.textContent = analytics.totalCount;
    this.statBreakdown.textContent = `${analytics.photoCount} Photos • ${analytics.videoCount} Videos`;
    
    this.statLocationsCount.textContent = analytics.locationCount;
    this.statCountriesCount.textContent = `${analytics.cityCount} Cities across ${analytics.countryCount} Countries`;

    if (analytics.oldestDate && analytics.newestDate) {
      const oldYear = new Date(analytics.oldestDate).getFullYear();
      const newYear = new Date(analytics.newestDate).getFullYear();
      this.statTimelineSpan.textContent = oldYear === newYear ? `${oldYear}` : `${oldYear} – ${newYear}`;
      this.statOldestNewest.textContent = `${formatDate(analytics.oldestDate)} → ${formatDate(analytics.newestDate)}`;
    } else {
      this.statTimelineSpan.textContent = '--';
      this.statOldestNewest.textContent = 'No media recorded';
    }

    this.statStorageSize.textContent = formatBytes(analytics.totalBytes);

    // 2. Render On This Day Memories Widget (Feature 1)
    if (this.app.onThisDayWidget) {
      this.app.onThisDayWidget.render(allMedia);
    }

    // 3. Render Activity Chart
    this.renderChart(analytics);

    // 4. Render Mini Map & Top Locations
    this.renderMiniMap(allMedia);
    this.renderTopLocations(allMedia);

    // 5. Render Featured Memories Carousel
    this.renderFeaturedMemories(allMedia);
  }

  renderChart(analyticsData = null) {
    if (!this.chartCanvas || typeof window.Chart === 'undefined') return;

    storageService.getAnalytics().then((analytics) => {
      const dataMap = this.chartPeriod === 'month' ? analytics.monthlyActivity : analytics.yearlyActivity;
      const sortedKeys = Object.keys(dataMap).sort();

      if (sortedKeys.length === 0) {
        if (this.chartEmptyState) this.chartEmptyState.style.display = 'flex';
        if (this.chart) {
          this.chart.destroy();
          this.chart = null;
        }
        return;
      }

      if (this.chartEmptyState) this.chartEmptyState.style.display = 'none';

      const labels = sortedKeys;
      const counts = sortedKeys.map(k => dataMap[k]);

      if (this.chart) {
        this.chart.destroy();
      }

      const ctx = this.chartCanvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, 'rgba(255, 69, 0, 0.9)');
      gradient.addColorStop(1, 'rgba(255, 140, 0, 0.2)');

      this.chart = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Memories Captured',
            data: counts,
            backgroundColor: gradient,
            borderColor: '#FF4500',
            borderWidth: 1.5,
            borderRadius: 6,
            barThickness: 24,
            maxBarThickness: 32
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#111111',
              titleColor: '#ffffff',
              bodyColor: '#FF4500',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              padding: 10,
              displayColors: false
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#a1a1aa', font: { family: 'Inter', size: 11 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#a1a1aa', stepSize: 1, font: { family: 'Inter', size: 11 } }
            }
          }
        }
      });
    });
  }

  renderMiniMap(allMedia) {
    const mapEl = document.getElementById('mini-map');
    if (!mapEl || typeof window.L === 'undefined') return;

    if (!this.miniMap) {
      this.miniMap = window.L.map('mini-map', {
        zoomControl: false,
        attributionControl: false
      }).setView([10.8505, 78.6856], 6);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18
      }).addTo(this.miniMap);
    }

    // Clear old markers
    this.miniMapMarkers.forEach(m => m.remove());
    this.miniMapMarkers = [];

    const bounds = [];
    const mediaWithGps = allMedia.filter(m => m.latitude != null && m.longitude != null);

    mediaWithGps.forEach((item) => {
      const marker = window.L.circleMarker([item.latitude, item.longitude], {
        radius: 6,
        fillColor: '#FF4500',
        color: '#ffffff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(this.miniMap);

      this.miniMapMarkers.push(marker);
      bounds.push([item.latitude, item.longitude]);
    });

    if (bounds.length > 1) {
      this.miniMap.fitBounds(bounds, { padding: [15, 15], maxZoom: 10 });
    } else if (bounds.length === 1) {
      this.miniMap.setView(bounds[0], 9);
    } else {
      this.miniMap.setView([10.8505, 78.6856], 6);
    }
  }

  renderTopLocations(allMedia) {
    if (!this.topLocationsList) return;
    this.topLocationsList.innerHTML = '';

    const locCounts = {};
    allMedia.forEach(m => {
      const loc = m.locationName || 'Unspecified Location';
      locCounts[loc] = (locCounts[loc] || 0) + 1;
    });

    const sorted = Object.entries(locCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    if (sorted.length === 0) {
      this.topLocationsList.innerHTML = '<span class="text-muted" style="font-size: 0.8rem;">No locations recorded yet</span>';
      return;
    }

    sorted.forEach(([name, count]) => {
      const chip = document.createElement('div');
      chip.className = 'location-chip';
      chip.innerHTML = `
        <i class="fa-solid fa-location-dot"></i>
        <span>${name}</span>
        <span class="chip-count">${count}</span>
      `;
      chip.addEventListener('click', () => {
        this.app.timelineView.filterByLocation(name);
        this.app.switchView('timeline');
      });
      this.topLocationsList.appendChild(chip);
    });
  }

  renderFeaturedMemories(allMedia) {
    if (!this.featuredContainer) return;
    this.featuredContainer.innerHTML = '';

    if (allMedia.length === 0) {
      this.featuredContainer.innerHTML = `
        <div style="padding: 20px; color: var(--text-muted); font-size: 0.9rem;">
          No memories yet. Upload photos or click "Load Sample Memories" above!
        </div>
      `;
      return;
    }

    // Take top 8 items
    const highlights = allMedia.slice(0, 8);

    highlights.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'featured-memory-card';
      
      const thumb = item.thumbUrl || item.url || (item.fileBlob ? URL.createObjectURL(item.fileBlob) : '');
      const isVideo = item.mediaType === 'video';

      card.innerHTML = `
        ${isVideo ? `<video src="${thumb}" muted preload="metadata"></video>` : `<img src="${thumb}" alt="${item.fileName}" loading="lazy">`}
        <div class="featured-overlay">
          <span class="featured-loc"><i class="fa-solid fa-map-pin"></i> ${item.locationName || 'Unspecified'}</span>
          <span class="featured-date">${formatDate(item.dateTaken)}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.app.lightbox.open(allMedia, index);
      });

      this.featuredContainer.appendChild(card);
    });
  }
}
