/**
 * GeoTimeline Master Application Controller (5-Feature Static / No-DB Build)
 * Coordinates services, views, routing, animations, offline PWA, On-This-Day, Trips & Sharing.
 */

import { CONFIG, showToast } from './config.js';
import { storageService } from './services/storageService.js';
import { Navbar } from './components/navbar.js';
import { DashboardView } from './components/dashboardView.js';
import { TimelineView } from './components/timelineView.js';
import { MapView } from './components/mapView.js';
import { TripsView } from './components/tripsView.js';
import { GalaxyView } from './components/galaxyView.js';
import { FolderExplorerView } from './components/folderExplorerView.js';
import { UploadModal } from './components/uploadModal.js';
import { Lightbox } from './components/lightbox.js';
import { StorageSettingsModal } from './components/storageSettingsModal.js';
import { OnThisDayWidget } from './components/onThisDayWidget.js';
import { tripDetectionService } from './services/tripDetectionService.js';
import { shareService } from './services/shareService.js';

class GeoTimelineApp {
  constructor() {
    this.currentView = 'dashboard';
  }

  async init() {
    console.log('🚀 Initializing GeoTimeline Superdesign Application...');

    // 1. Initialize Storage Database
    await storageService.init();

    // 2. Initialize Components & Widgets
    this.navbar = new Navbar(this);
    this.dashboardView = new DashboardView(this);
    this.timelineView = new TimelineView(this);
    this.mapView = new MapView(this);
    this.tripsView = new TripsView(this);
    this.galaxyView = new GalaxyView(this);
    this.folderExplorerView = new FolderExplorerView(this);
    this.uploadModal = new UploadModal(this);
    this.lightbox = new Lightbox(this);
    this.storageSettingsModal = new StorageSettingsModal(this);
    this.onThisDayWidget = new OnThisDayWidget(this);

    // 3. Initialize Visual Effects (Scroll Reveal, Parallax, Clock, Hero Search)
    this.initSuperdesignEffects();

    // 4. Initialize PWA Service Worker, Network Listeners & Install Banner (Feature 5)
    this.initPwaAndNetwork();

    // 5. Auto-seed sample memories if DB is empty
    const existingMedia = await storageService.getAllMedia();
    if (existingMedia.length === 0) {
      console.log('Seeding initial sample memories...');
      await storageService.seedSampleMemories();
      const allMemories = await storageService.getAllMedia();
      const trips = await tripDetectionService.detectTrips(allMemories);
      for (const t of trips) {
        await storageService.saveTrip(t);
      }
    }

    // 6. Check for Shared Trip Route via URL fragment (Feature 4 - Option B)
    const sharedPayload = shareService.parseUrlFragmentPayload();
    if (sharedPayload) {
      this.handleSharedTripRoute(sharedPayload);
    } else {
      // Render Current View
      await this.refreshAllViews();
    }

    // 7. Mark first run
    localStorage.setItem(CONFIG.STORAGE_KEYS.FIRST_RUN_DONE, 'true');
  }

  /**
   * Superdesign Interactive Effects
   */
  initSuperdesignEffects() {
    // A. Activate all reveal elements immediately for instant visibility
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));

    // Intersection Observer for subsequent dynamic reveal elements
    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      }, {
        threshold: 0.05
      });

      document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    }

    // B. Dynamic Navbar Scroll Transition
    const nav = document.getElementById('main-nav');
    const updateNavScroll = () => {
      if (!nav) return;
      if (window.scrollY > 40) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', updateNavScroll, { passive: true });
    updateNavScroll();

    // C. Parallax Cards & Hero Fade Effect
    const parallaxUpCards = document.querySelectorAll('.parallax-card-up');
    const parallaxDownCards = document.querySelectorAll('.parallax-card-down');

    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;

      parallaxUpCards.forEach(el => {
        el.style.setProperty('--scroll-offset-up', `${scrolled * -0.04}px`);
      });
      parallaxDownCards.forEach(el => {
        el.style.setProperty('--scroll-offset-down', `${scrolled * 0.04}px`);
      });
    }, { passive: true });

    // D. Dynamic Live Clock & User Timezone
    const timeEl = document.getElementById('current-time');
    const locBadge = document.getElementById('hero-location-badge');
    const updateTime = () => {
      const now = new Date();
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (locBadge) {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          locBadge.textContent = tz ? tz.split('/')[1] || tz : 'GLOBAL';
        } catch (e) {
          locBadge.textContent = 'GLOBAL';
        }
      }
    };
    setInterval(updateTime, 10000);
    updateTime();

    // E. "Enter the Void" Pill Click Handler
    const btnVoid = document.getElementById('btn-enter-void');
    if (btnVoid) {
      btnVoid.addEventListener('click', () => {
        const analyticsEl = document.getElementById('dashboard-analytics-section');
        if (analyticsEl) {
          analyticsEl.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    // F. Hero Intelligence Capsules Click Handlers
    const pillTimeline = document.getElementById('hero-pill-timeline');
    if (pillTimeline) {
      pillTimeline.addEventListener('click', () => {
        this.switchView('timeline');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const pillMap = document.getElementById('hero-pill-map');
    if (pillMap) {
      pillMap.addEventListener('click', () => {
        this.switchView('map');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const pillStorage = document.getElementById('hero-pill-storage');
    if (pillStorage) {
      pillStorage.addEventListener('click', () => {
        this.storageSettingsModal.open();
      });
    }

    // G. Hero Search Bar & Enter Key Trigger
    const heroSearchInput = document.getElementById('hero-search-input');
    const heroSearchBtn = document.getElementById('hero-search-btn');

    if (heroSearchInput) {
      heroSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = heroSearchInput.value.trim();
          this.handleGlobalSearch(val);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (heroSearchBtn && heroSearchInput) {
      heroSearchBtn.addEventListener('click', () => {
        const val = heroSearchInput.value.trim();
        this.handleGlobalSearch(val);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // H. Hero Quick Filter Chips
    document.querySelectorAll('.hero-quick-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query;
        if (heroSearchInput) heroSearchInput.value = query;
        this.handleGlobalSearch(query);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // I. Hero Direct Drag & Drop Upload Zone
    const heroDropZone = document.getElementById('hero-instant-drop');
    const btnHeroQuickUpload = document.getElementById('btn-hero-quick-upload');

    if (heroDropZone) {
      ['dragenter', 'dragover'].forEach(name => {
        heroDropZone.addEventListener(name, (e) => {
          e.preventDefault();
          heroDropZone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        heroDropZone.addEventListener(name, (e) => {
          e.preventDefault();
          heroDropZone.classList.remove('dragover');
        });
      });

      heroDropZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          this.uploadModal.open();
          this.uploadModal.handleFilesSelected(files);
        }
      });
    }

    if (btnHeroQuickUpload) {
      btnHeroQuickUpload.addEventListener('click', () => {
        this.uploadModal.open();
      });
    }

    // J. User Feature Guide Modal
    const modalGuide = document.getElementById('modal-user-guide');
    const btnOpenGuide = document.getElementById('btn-open-guide');
    const btnHeroGuide = document.getElementById('btn-hero-guide');
    const btnCloseGuide = document.getElementById('btn-close-user-guide');
    const btnConfirmGuide = document.getElementById('btn-confirm-guide');
    const btnGuideDemo = document.getElementById('btn-guide-load-demo');

    const openGuide = () => {
      if (modalGuide) modalGuide.style.display = 'flex';
    };
    const closeGuide = () => {
      if (modalGuide) modalGuide.style.display = 'none';
    };

    if (btnOpenGuide) btnOpenGuide.addEventListener('click', openGuide);
    if (btnHeroGuide) btnHeroGuide.addEventListener('click', openGuide);
    if (btnCloseGuide) btnCloseGuide.addEventListener('click', closeGuide);
    if (btnConfirmGuide) btnConfirmGuide.addEventListener('click', closeGuide);
    if (modalGuide) {
      modalGuide.addEventListener('click', (e) => {
        if (e.target === modalGuide) closeGuide();
      });
    }

    if (btnGuideDemo) {
      btnGuideDemo.addEventListener('click', async () => {
        closeGuide();
        showToast('Loading sample travel memories...', 'info');
        await storageService.seedSampleMemories();
        await this.refreshAllViews();
        showToast('Sample memories loaded!', 'success');
      });
    }
  }

  /**
   * Feature 5: Offline-First PWA Setup, Service Worker & Install Banner
   */
  initPwaAndNetwork() {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('✅ Service Worker registered with scope:', reg.scope);
      }).catch((err) => {
        console.warn('⚠️ Service Worker registration failed:', err);
      });
    }

    // 2. Network Online/Offline Indicators
    const badge = document.getElementById('network-status-badge');
    const badgeText = document.getElementById('network-status-text');

    const updateNetworkState = () => {
      const isOnline = navigator.onLine;
      if (badge) {
        badge.className = `network-badge ${isOnline ? 'online' : 'offline'} hidden sm:inline-flex`;
        if (badgeText) badgeText.textContent = isOnline ? 'Online' : 'Offline Mode';
      }
      if (!isOnline) {
        showToast('You are offline. Showing cached memories.', 'info');
      }
    };

    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    updateNetworkState();

    // 3. PWA Install Prompt Banner
    let deferredPrompt = null;
    const pwaBanner = document.getElementById('pwa-install-banner');
    const btnInstall = document.getElementById('btn-pwa-install');
    const btnDismiss = document.getElementById('btn-pwa-dismiss');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (pwaBanner && !localStorage.getItem('geotimeline_pwa_dismissed')) {
        pwaBanner.style.display = 'flex';
      }
    });

    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            console.log('User accepted PWA installation');
          }
          deferredPrompt = null;
          if (pwaBanner) pwaBanner.style.display = 'none';
        }
      });
    }

    if (btnDismiss && pwaBanner) {
      btnDismiss.addEventListener('click', () => {
        pwaBanner.style.display = 'none';
        localStorage.setItem('geotimeline_pwa_dismissed', 'true');
      });
    }
  }

  /**
   * Feature 4 (Option B): Render Shared Trip from URL Fragment
   */
  handleSharedTripRoute(payload) {
    showToast(`Opening shared trip: "${payload.tripName}"`, 'info');

    const trip = {
      id: 'shared-trip',
      name: payload.tripName,
      startDate: payload.startDate,
      endDate: payload.endDate,
      photoIds: payload.photos.map(p => p.id),
      autoGenerated: false
    };

    const tripPhotos = payload.photos.map(p => ({
      id: p.id,
      fileName: p.name,
      dateTaken: p.date,
      locationName: p.loc,
      latitude: p.lat,
      longitude: p.lng,
      url: p.url,
      thumbUrl: p.url,
      mediaType: 'image'
    }));

    this.mapView.selectTripRoute(trip, tripPhotos);
    this.switchView('map');
  }

  /**
   * Update Hero Intelligence Capsules with live counts
   */
  async updateHeroIntelligence() {
    try {
      const analytics = await storageService.getAnalytics();
      const heroStatTotal = document.getElementById('hero-stat-total');
      const heroStatLocations = document.getElementById('hero-stat-locations');
      const heroStatStorage = document.getElementById('hero-stat-storage');

      if (heroStatTotal) heroStatTotal.textContent = analytics.totalCount;
      if (heroStatLocations) heroStatLocations.textContent = analytics.locationCount || analytics.cityCount || 0;
      if (heroStatStorage) {
        const provider = localStorage.getItem(CONFIG.STORAGE_KEYS.PROVIDER) || 'local';
        heroStatStorage.textContent = provider === 'gdrive' ? 'Google Drive' : 'Local Disk';
      }
    } catch (e) {
      console.warn('Could not update hero stats:', e);
    }
  }

  /**
   * Switch between main application views:
   * 'dashboard' | 'timeline' | 'trips' | 'map' | 'folders'
   */
  async switchView(viewName) {
    this.currentView = viewName;

    // Update Nav Tab UI
    this.navbar.setActiveTab(viewName);
    document.body.classList.toggle('view-map-active', viewName === 'map');
    document.body.classList.toggle('view-galaxy-active', viewName === 'galaxy');

    // Toggle View Sections
    const views = document.querySelectorAll('.app-view');
    views.forEach((v) => {
      if (v.id === `view-${viewName}`) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });

    // Re-trigger reveal elements in newly active view
    setTimeout(() => {
      document.querySelectorAll('.app-view.active .reveal').forEach(el => {
        el.classList.add('active');
      });
    }, 50);

    // Render active view
    if (viewName === 'dashboard') {
      await this.dashboardView.render();
    } else if (viewName === 'timeline') {
      await this.timelineView.render();
    } else if (viewName === 'trips') {
      await this.tripsView.render();
    } else if (viewName === 'map') {
      await this.mapView.render();
    } else if (viewName === 'galaxy') {
      await this.galaxyView.render();
    } else if (viewName === 'folders') {
      await this.folderExplorerView.render();
    }
  }

  /**
   * Dispatch search query across views
   */
  handleGlobalSearch(query) {
    if (this.currentView !== 'timeline') {
      this.switchView('timeline');
    }
    this.timelineView.setSearchQuery(query);
  }

  /**
   * Refresh all view data after uploads or settings changes
   */
  async refreshAllViews() {
    this.navbar.updateStorageIndicator();
    await this.updateHeroIntelligence();
    if (this.currentView === 'dashboard') await this.dashboardView.render();
    if (this.currentView === 'timeline') await this.timelineView.render();
    if (this.currentView === 'trips') await this.tripsView.render();
    if (this.currentView === 'map') await this.mapView.render();
    if (this.currentView === 'folders') await this.folderExplorerView.render();
  }
}

// Instantiate and initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new GeoTimelineApp();
  app.init();
  window.__geoApp = app; // For debugging & inspection
});
