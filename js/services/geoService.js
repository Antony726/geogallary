/**
 * GeoLocation & Reverse Geocoding Service
 * Uses OpenStreetMap Nominatim API with rate limiting and local cache
 */

import { CONFIG } from '../config.js';

class GeoService {
  constructor() {
    this.cacheKey = 'geotimeline_geocache_v1';
    this.cache = this.loadCache();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.lastRequestTime = 0;
    this.MIN_REQUEST_INTERVAL = 1100; // 1.1s for Nominatim fair usage
  }

  loadCache() {
    try {
      const stored = localStorage.getItem(this.cacheKey);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.warn('Could not load geo cache from localStorage', e);
      return {};
    }
  }

  saveCache() {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
    } catch (e) {
      console.warn('Could not save geo cache to localStorage', e);
    }
  }

  getCacheKey(lat, lng) {
    // Round to 3 decimal places (~110 meters accuracy) for efficient cache hits
    return `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;
  }

  /**
   * Reverse geocode GPS coordinates to human-readable Location Name, City, Country
   */
  async reverseGeocode(latitude, longitude) {
    if (latitude == null || longitude == null || isNaN(latitude) || isNaN(longitude)) {
      return { ...CONFIG.DEFAULT_LOCATION };
    }

    const key = this.getCacheKey(latitude, longitude);
    if (this.cache[key]) {
      return this.cache[key];
    }

    // Queue request to avoid API throttling
    return new Promise((resolve) => {
      this.requestQueue.push({
        lat: latitude,
        lng: longitude,
        key,
        resolve
      });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const item = this.requestQueue.shift();
      
      // Double check cache
      if (this.cache[item.key]) {
        item.resolve(this.cache[item.key]);
        continue;
      }

      // Enforce rate limit interval
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.MIN_REQUEST_INTERVAL) {
        await new Promise((r) => setTimeout(r, this.MIN_REQUEST_INTERVAL - elapsed));
      }

      try {
        const url = `${CONFIG.NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${item.lat}&lon=${item.lng}&zoom=14&addressdetails=1`;
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!res.ok) throw new Error(`Geocoding HTTP error ${res.status}`);
        const data = await res.json();
        this.lastRequestTime = Date.now();

        const address = data.address || {};
        
        // Detailed locality resolution for district, city, landmark, state, and country
        const landmark = address.tourism || address.historic || address.amenity || address.leisure || address.building || address.suburb || address.neighbourhood || '';
        const rawDistrict = address.state_district || address.county || address.district || address.city_district || address.city || address.town || address.village || '';
        const district = rawDistrict.replace(/ District$/i, '').trim();
        const city = address.city || address.town || address.village || address.municipality || address.suburb || district || '';
        const state = address.state || '';
        const country = address.country || 'India';
        
        const primaryPlace = city || district || landmark || state || country;
        let locationName = '';

        if (landmark && primaryPlace && landmark !== primaryPlace) {
          locationName = `${landmark}, ${primaryPlace}${state ? `, ${state}` : ''}`;
        } else if (primaryPlace && state && primaryPlace !== state) {
          locationName = `${primaryPlace}, ${state}`;
        } else if (primaryPlace) {
          locationName = country ? `${primaryPlace}, ${country}` : primaryPlace;
        } else {
          locationName = country || 'Unknown Location';
        }

        const result = {
          name: locationName,
          district: district || city || primaryPlace || 'Unknown District',
          city: city || district || 'Unknown City',
          state: state,
          country: country,
          lat: Number(item.lat),
          lng: Number(item.lng),
          formatted: data.display_name || locationName
        };

        this.cache[item.key] = result;
        this.saveCache();
        item.resolve(result);

      } catch (err) {
        console.warn('Reverse geocoding failed, falling back to coordinates:', err);
        const fallback = {
          name: `Location (${item.lat.toFixed(2)}, ${item.lng.toFixed(2)})`,
          district: 'Coordinates',
          city: 'Coordinates',
          state: '',
          country: 'India',
          lat: Number(item.lat),
          lng: Number(item.lng)
        };
        this.cache[item.key] = fallback;
        item.resolve(fallback);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Search location by place query (Forward Geocoding)
   */
  async searchLocation(query) {
    if (!query || query.trim().length === 0) return [];
    try {
      // First attempt searching with India preference
      let url = `${CONFIG.NOMINATIM_BASE_URL}/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=in&limit=6&addressdetails=1`;
      let res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      let data = res.ok ? await res.json() : [];

      // If no Indian results found or query mentions other places, search globally
      if (!data || data.length === 0) {
        url = `${CONFIG.NOMINATIM_BASE_URL}/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`;
        res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        data = res.ok ? await res.json() : [];
      }
      
      return data.map((item) => {
        const addr = item.address || {};
        const landmark = addr.tourism || addr.historic || addr.amenity || addr.suburb || '';
        const rawDistrict = addr.state_district || addr.county || addr.district || addr.city_district || addr.city || addr.town || addr.village || item.name || '';
        const district = rawDistrict.replace(/ District$/i, '').trim();
        const city = addr.city || addr.town || addr.village || addr.municipality || district || item.name;
        const state = addr.state || '';
        const country = addr.country || 'India';
        
        let name = city;
        if (landmark && city && landmark !== city) {
          name = `${landmark}, ${city}${state ? `, ${state}` : ''}`;
        } else if (city && state && city !== state) {
          name = `${city}, ${state}`;
        } else if (city && country) {
          name = `${city}, ${country}`;
        }

        return {
          name: name,
          district: district || city,
          city: city,
          state: state,
          country: country,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          displayName: item.display_name
        };
      });
    } catch (e) {
      console.warn('Location search error:', e);
      return [];
    }
  }
}

export const geoService = new GeoService();
