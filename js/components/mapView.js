/**
 * Interactive World Map View Component (Feature 3 Enhanced)
 * Leaflet map visualization with photo pins, trip route polylines, sequence milestones,
 * popups, and places drawer.
 */

import { storageService } from '../services/storageService.js';
import { formatDate } from '../config.js';

export class MapView {
  constructor(app) {
    this.app = app;
    this.map = null;
    this.markers = [];
    this.allMedia = [];
    this.placesDrawer = null;
    this.placesList = null;
    this.filterInput = null;

    // Feature 3: Trip Journey Route state
    this.selectedTrip = null;
    this.tripPhotos = [];
    this.routePolyline = null;
    this.routeMarkers = [];
    this.showRouteLine = true;

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.placesDrawer = document.getElementById('map-drawer');
    this.placesList = document.getElementById('map-places-list');
    this.filterInput = document.getElementById('map-place-filter');
    this.btnToggleDrawer = document.getElementById('btn-toggle-map-drawer');
    this.tripBanner = document.getElementById('map-trip-banner');
    this.tripBannerTitle = document.getElementById('map-trip-title');
    this.tripBannerMeta = document.getElementById('map-trip-meta');
    this.btnExitTripRoute = document.getElementById('btn-exit-trip-route');
    this.btnToggleRouteLine = document.getElementById('btn-toggle-route-line');
  }

  attachEvents() {
    if (this.btnToggleDrawer && this.placesDrawer) {
      this.btnToggleDrawer.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDrawer();
      });

      const drawerHeader = this.placesDrawer.querySelector('.drawer-header, .map-drawer-header');
      if (drawerHeader) {
        drawerHeader.addEventListener('click', () => {
          this.toggleDrawer();
        });
      }
    }

    if (this.filterInput) {
      this.filterInput.addEventListener('input', (e) => {
        this.renderPlacesList(e.target.value.toLowerCase().trim());
      });
    }

    if (this.btnExitTripRoute) {
      this.btnExitTripRoute.addEventListener('click', () => {
        this.clearTripRoute();
      });
    }

    if (this.btnToggleRouteLine) {
      this.btnToggleRouteLine.addEventListener('click', () => {
        this.showRouteLine = !this.showRouteLine;
        if (this.routePolyline) {
          if (this.showRouteLine) {
            this.routePolyline.addTo(this.map);
            this.btnToggleRouteLine.innerHTML = '<iconify-icon icon="lucide:eye-off"></iconify-icon><span>Hide Route</span>';
          } else {
            this.routePolyline.remove();
            this.btnToggleRouteLine.innerHTML = '<iconify-icon icon="lucide:eye"></iconify-icon><span>Show Route</span>';
          }
        }
      });
    }
  }

  toggleDrawer() {
    if (!this.placesDrawer) return;
    this.placesDrawer.classList.toggle('collapsed');
    this.placesDrawer.classList.toggle('expanded-mobile');
    const icon = this.btnToggleDrawer ? this.btnToggleDrawer.querySelector('iconify-icon, i') : null;
    if (icon) {
      icon.setAttribute('icon', (this.placesDrawer.classList.contains('collapsed') || !this.placesDrawer.classList.contains('expanded-mobile'))
        ? 'lucide:chevron-up' 
        : 'lucide:chevron-down');
    }
  }

  initMap() {
    if (this.map || typeof window.L === 'undefined') return;

    // Centered on Tamil Nadu, India (Lat: 10.8505, Lng: 78.6856, Zoom: 7.5)
    this.map = window.L.map('full-leaflet-map', {
      zoomControl: true
    }).setView([10.8505, 78.6856], 7.5);

    // CartoDB Dark Matter tiles
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);
  }

  async render() {
    this.initMap();
    if (!this.map) return;

    // Trigger Leaflet resize calculation
    setTimeout(() => this.map.invalidateSize(), 150);

    this.allMedia = await storageService.getAllMedia();

    if (this.selectedTrip) {
      this.renderTripRouteUI();
    } else {
      this.renderMarkers();
      this.renderPlacesList();
    }
  }

  /**
   * Feature 3: Select a trip and draw journey polyline connecting points in timestamp sequence
   * @param {Object} trip
   * @param {Array} tripPhotos
   */
  selectTripRoute(trip, tripPhotos) {
    this.selectedTrip = trip;
    this.tripPhotos = tripPhotos.sort((a, b) => new Date(a.dateTaken).getTime() - new Date(b.dateTaken).getTime());
    this.showRouteLine = true;

    this.initMap();
    if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
        this.renderTripRouteUI();
      }, 100);
    }
  }

  /**
   * Render journey polyline and sequential milestone badges for selected trip
   */
  renderTripRouteUI() {
    // Clear regular pins
    this.markers.forEach(m => m.remove());
    this.markers = [];

    // Clear existing route elements
    if (this.routePolyline) {
      this.routePolyline.remove();
      this.routePolyline = null;
    }
    this.routeMarkers.forEach(m => m.remove());
    this.routeMarkers = [];

    if (this.tripBanner) {
      this.tripBanner.style.display = 'flex';
      if (this.tripBannerTitle) this.tripBannerTitle.textContent = this.selectedTrip.name;
      if (this.tripBannerMeta) {
        this.tripBannerMeta.textContent = `${this.tripPhotos.length} Milestones • ${formatDate(this.selectedTrip.startDate)} – ${formatDate(this.selectedTrip.endDate)}`;
      }
    }

    const latlngs = [];
    const bounds = [];

    this.tripPhotos.forEach((item, index) => {
      if (item.latitude == null || item.longitude == null) return;

      const pt = [item.latitude, item.longitude];
      
      // Avoid duplicate consecutive identical coordinate artifacts
      const prevPt = latlngs[latlngs.length - 1];
      if (!prevPt || prevPt[0] !== pt[0] || prevPt[1] !== pt[1]) {
        latlngs.push(pt);
      }
      bounds.push(pt);

      const seqNum = index + 1;

      // Sequential numbered milestone pin
      const seqIcon = window.L.divIcon({
        className: 'custom-route-seq-pin',
        html: `
          <div style="
            position: relative;
            background: linear-gradient(135deg, #FF4500, #ff8c00);
            color: #000000;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            border: 2px solid #ffffff;
            box-shadow: 0 0 16px rgba(255, 69, 0, 0.85);
            cursor: pointer;
          ">
            ${seqNum}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = window.L.marker(pt, { icon: seqIcon }).addTo(this.map);

      // Popup
      const thumb = item.thumbUrl || item.url || (item.fileBlob ? URL.createObjectURL(item.fileBlob) : '');
      const popupHtml = `
        <div class="map-popup-card">
          ${thumb ? `<img src="${thumb}" class="map-popup-thumb" alt="${item.fileName}">` : ''}
          <div class="map-popup-title font-serif"><span style="color:#FF4500;">[#${seqNum}]</span> ${item.locationName || 'Waypoint'}</div>
          <div class="map-popup-meta">${formatDate(item.dateTaken)}</div>
          <button class="btn btn-primary btn-sm" id="btn-popup-trip-${item.id}" style="margin-top: 4px; width: 100%;">
            <iconify-icon icon="lucide:expand"></iconify-icon> View in Lightbox
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 220 });
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-popup-trip-${item.id}`);
        if (btn) {
          btn.onclick = () => {
            const idx = this.allMedia.findIndex(m => m.id === item.id);
            this.app.lightbox.open(this.allMedia, idx !== -1 ? idx : 0);
          };
        }
      });

      this.routeMarkers.push(marker);
    });

    // Draw connecting journey polyline in fiery orange
    if (latlngs.length > 1 && this.showRouteLine) {
      this.routePolyline = window.L.polyline(latlngs, {
        color: '#FF4500',
        weight: 3.5,
        dashArray: '6, 8',
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
    }

    if (bounds.length > 1) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    } else if (bounds.length === 1) {
      this.map.setView(bounds[0], 12);
    }
  }

  /**
   * Clear active trip route and return to general map view
   */
  clearTripRoute() {
    this.selectedTrip = null;
    this.tripPhotos = [];

    if (this.tripBanner) {
      this.tripBanner.style.display = 'none';
    }

    if (this.routePolyline) {
      this.routePolyline.remove();
      this.routePolyline = null;
    }

    this.routeMarkers.forEach(m => m.remove());
    this.routeMarkers = [];

    this.renderMarkers();
    this.renderPlacesList();
  }

  renderMarkers() {
    // Clear old markers
    this.markers.forEach(m => m.remove());
    this.markers = [];

    const bounds = [];
    const mediaWithGps = this.allMedia.filter(m => m.latitude != null && m.longitude != null);

    // Group media by identical or close coordinates
    const coordClusters = {};
    mediaWithGps.forEach((item) => {
      const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
      if (!coordClusters[key]) {
        coordClusters[key] = {
          lat: item.latitude,
          lng: item.longitude,
          items: []
        };
      }
      coordClusters[key].items.push(item);
    });

    Object.values(coordClusters).forEach((cluster) => {
      const firstItem = cluster.items[0];
      const count = cluster.items.length;

      // Custom HTML Marker Icon
      const customIcon = window.L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            position: relative;
            background: linear-gradient(135deg, #FF4500, #ff8c00);
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 11px;
            border: 2px solid #ffffff;
            box-shadow: 0 0 16px rgba(255, 69, 0, 0.7);
            cursor: pointer;
          ">
            <i class="fa-solid fa-camera" style="${count > 1 ? 'display:none;' : ''}"></i>
            ${count > 1 ? `<span>${count}</span>` : ''}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = window.L.marker([cluster.lat, cluster.lng], { icon: customIcon }).addTo(this.map);

      // Popup Content
      const thumb = firstItem.thumbUrl || firstItem.url || (firstItem.fileBlob ? URL.createObjectURL(firstItem.fileBlob) : '');
      const popupHtml = `
        <div class="map-popup-card">
          ${thumb ? `<img src="${thumb}" class="map-popup-thumb" alt="${firstItem.fileName}">` : ''}
          <div class="map-popup-title">${firstItem.locationName || 'Unknown Location'}</div>
          <div class="map-popup-meta">${formatDate(firstItem.dateTaken)} • ${count} ${count === 1 ? 'item' : 'items'}</div>
          <button class="btn btn-primary btn-sm" id="btn-popup-view-${firstItem.id}" style="margin-top: 4px; width: 100%;">
            <i class="fa-solid fa-expand"></i> View in Lightbox
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 220 });
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-popup-view-${firstItem.id}`);
        if (btn) {
          btn.onclick = () => {
            const idx = this.allMedia.indexOf(firstItem);
            this.app.lightbox.open(this.allMedia, idx !== -1 ? idx : 0);
          };
        }
      });

      this.markers.push(marker);
      bounds.push([cluster.lat, cluster.lng]);
    });

    if (bounds.length > 1) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    } else if (bounds.length === 1) {
      this.map.setView(bounds[0], 12);
    } else {
      this.map.setView([10.8505, 78.6856], 7.5);
    }
  }

  renderPlacesList(filter = '') {
    if (!this.placesList) return;
    this.placesList.innerHTML = '';

    const placeMap = {};
    this.allMedia.forEach((item) => {
      const loc = item.locationName || 'Unspecified Location';
      if (!placeMap[loc]) {
        placeMap[loc] = {
          name: loc,
          city: item.city,
          country: item.country,
          lat: item.latitude,
          lng: item.longitude,
          count: 0,
          items: []
        };
      }
      placeMap[loc].count++;
      placeMap[loc].items.push(item);
    });

    const places = Object.values(placeMap).filter(p => {
      if (!filter) return true;
      return p.name.toLowerCase().includes(filter) ||
             (p.city && p.city.toLowerCase().includes(filter)) ||
             (p.country && p.country.toLowerCase().includes(filter));
    });

    if (places.length === 0) {
      this.placesList.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 0.82rem; text-align: center;">No locations found</div>';
      return;
    }

    places.forEach((place) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'map-place-item';
      itemEl.innerHTML = `
        <div class="map-place-info">
          <span class="map-place-name">${place.name}</span>
          <span class="map-place-sub">${place.country || 'Global'}</span>
        </div>
        <span class="map-place-count">${place.count}</span>
      `;

      itemEl.addEventListener('click', () => {
        if (place.lat != null && place.lng != null && this.map) {
          this.map.flyTo([place.lat, place.lng], 13, { duration: 1.5 });
        } else {
          // Filter timeline
          this.app.timelineView.filterByLocation(place.name);
          this.app.switchView('timeline');
        }
      });

      this.placesList.appendChild(itemEl);
    });
  }
}
