/**
 * Trip Sharing Service (Feature 4)
 * Generates standalone self-contained HTML export files (Option A)
 * and lightweight URL-fragment state links (Option B) with zero database/backend dependency.
 */

import { showToast } from '../config.js';

class ShareService {
  /**
   * Option A: Generate and download a self-contained Standalone HTML viewer file for a trip
   * @param {Object} trip
   * @param {Array} photos
   */
  async exportStandaloneHtml(trip, photos) {
    showToast('Generating standalone trip viewer HTML...', 'info');

    // Prepare photos: convert local blobs to base64 Data URLs if needed
    const processedPhotos = [];
    for (const p of photos) {
      let srcUrl = p.thumbUrl || p.url;
      if (p.fileBlob) {
        try {
          srcUrl = await this.blobToDataUrl(p.fileBlob);
        } catch (e) {
          srcUrl = p.thumbUrl || '';
        }
      }
      processedPhotos.push({
        id: p.id,
        fileName: p.fileName,
        dateTaken: p.dateTaken,
        locationName: p.locationName,
        latitude: p.latitude,
        longitude: p.longitude,
        src: srcUrl,
        mediaType: p.mediaType || 'image'
      });
    }

    const htmlContent = this.buildStandaloneHtmlTemplate(trip, processedPhotos);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    const safeName = (trip.name || 'Trip').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = URL.createObjectURL(blob);
    link.download = `${safeName}_GeoTimeline_Viewer.html`;
    link.click();

    showToast('Standalone HTML viewer downloaded!', 'success');
  }

  /**
   * Option B: Generate URL-Fragment State Link (for web/Drive hosted photos)
   */
  generateUrlFragmentLink(trip, photos) {
    const compactPhotos = photos.map(p => ({
      id: p.id,
      name: p.fileName,
      date: p.dateTaken,
      loc: p.locationName,
      lat: p.latitude,
      lng: p.longitude,
      url: p.url || p.thumbUrl || ''
    }));

    const payload = {
      tripName: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      photos: compactPhotos
    };

    try {
      const jsonStr = JSON.stringify(payload);
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      const shareUrl = `${window.location.origin}${window.location.pathname}#/shared?data=${encodeURIComponent(b64)}`;

      // Copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Shareable trip link copied to clipboard!', 'success');
      }).catch(() => {
        prompt('Copy this shareable trip link:', shareUrl);
      });

      return shareUrl;
    } catch (e) {
      console.error('Error generating share link:', e);
      showToast('Could not generate share link', 'danger');
      return null;
    }
  }

  /**
   * Parse trip data from URL fragment payload
   */
  parseUrlFragmentPayload() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('#/shared?data=')) return null;

    try {
      const b64 = decodeURIComponent(hash.split('#/shared?data=')[1]);
      const jsonStr = decodeURIComponent(escape(atob(b64)));
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Could not parse shared trip payload from URL:', e);
      return null;
    }
  }

  /**
   * Convert Blob to base64 Data URL
   */
  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Build the standalone Single-File HTML Template with embedded Leaflet map & viewer
   */
  buildStandaloneHtmlTemplate(trip, photos) {
    const photosJson = JSON.stringify(photos).replace(/<\/script>/g, '<\\/script>');
    const tripJson = JSON.stringify(trip).replace(/<\/script>/g, '<\\/script>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${trip.name} — GeoTimeline Journey</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
  <style>
    :root {
      --bg: #050505;
      --card: #111111;
      --accent: #FF4500;
      --border: rgba(255, 255, 255, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: #fff;
      font-family: 'Inter', sans-serif;
      line-height: 1.5;
      padding-bottom: 60px;
    }
    .header {
      padding: 40px 24px 24px;
      max-width: 1200px;
      margin: 0 auto;
      text-align: center;
    }
    .title {
      font-family: 'Playfair Display', serif;
      font-size: 2.8rem;
      margin-bottom: 8px;
    }
    .meta-bar {
      display: flex;
      justify-content: center;
      gap: 16px;
      font-size: 0.85rem;
      color: #a1a1aa;
      font-family: 'JetBrains Mono', monospace;
    }
    .badge {
      background: rgba(255, 69, 0, 0.15);
      color: var(--accent);
      padding: 3px 12px;
      border-radius: 9999px;
      border: 1px solid rgba(255, 69, 0, 0.3);
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    #standalone-map {
      width: 100%;
      height: 420px;
      border-radius: 20px;
      border: 1px solid var(--border);
      margin: 24px 0 40px;
      background: #111;
    }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }
    .photo-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.3s ease, border-color 0.3s ease;
    }
    .photo-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
    }
    .photo-card img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      display: block;
    }
    .photo-card-info {
      padding: 12px;
    }
    .photo-loc {
      font-size: 0.82rem;
      font-weight: 500;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .photo-date {
      font-size: 0.72rem;
      color: #71717a;
      font-family: 'JetBrains Mono', monospace;
      margin-top: 2px;
    }
    /* Lightbox */
    #lightbox-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,0.92);
      align-items: center;
      justify-content: center;
    }
    #lightbox-modal.active { display: flex; }
    #lightbox-img {
      max-width: 90vw;
      max-height: 85vh;
      border-radius: 12px;
      object-fit: contain;
    }
    .lightbox-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255,255,255,0.1);
      border: none;
      color: #fff;
      font-size: 1.5rem;
      padding: 8px 14px;
      border-radius: 50%;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">GeoTimeline Journey Archive</span>
    <h1 class="title">${trip.name}</h1>
    <div class="meta-bar">
      <span>${photos.length} Captured Memories</span>
      <span>•</span>
      <span>${new Date(trip.startDate).toLocaleDateString()} – ${new Date(trip.endDate).toLocaleDateString()}</span>
    </div>
  </div>

  <div class="container">
    <div id="standalone-map"></div>

    <h2 style="font-family: 'Playfair Display', serif; font-size: 1.6rem; margin-bottom: 16px;">Trip Photos & Sequence</h2>
    <div class="gallery-grid" id="standalone-gallery"></div>
  </div>

  <div id="lightbox-modal">
    <button class="lightbox-close" id="btn-close-lb">&times;</button>
    <img id="lightbox-img" src="" alt="Memory">
  </div>

  <script>
    const trip = ${tripJson};
    const photos = ${photosJson};

    // Render Gallery
    const gallery = document.getElementById('standalone-gallery');
    const lbModal = document.getElementById('lightbox-modal');
    const lbImg = document.getElementById('lightbox-img');
    document.getElementById('btn-close-lb').onclick = () => lbModal.classList.remove('active');
    lbModal.onclick = (e) => { if(e.target === lbModal) lbModal.classList.remove('active'); };

    photos.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      card.innerHTML = \`
        <img src="\${p.src}" alt="\${p.fileName || 'Memory'}">
        <div class="photo-card-info">
          <div class="photo-loc">
            <span style="color:#FF4500;">[\${idx+1}]</span> \${p.locationName || 'Place'}
          </div>
          <div class="photo-date">\${new Date(p.dateTaken).toLocaleDateString()}</div>
        </div>
      \`;
      card.onclick = () => {
        lbImg.src = p.src;
        lbModal.classList.add('active');
      };
      gallery.appendChild(card);
    });

    // Render Map & Journey Polyline
    if (typeof L !== 'undefined') {
      const map = L.map('standalone-map').setView([trip.centroid.lat || 10.85, trip.centroid.lng || 78.68], 9);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

      const latlngs = [];
      photos.forEach((p, idx) => {
        if (p.latitude != null && p.longitude != null) {
          latlngs.push([p.latitude, p.longitude]);

          const numIcon = L.divIcon({
            className: 'seq-marker',
            html: \`<div style="width:28px;height:28px;background:#FF4500;color:#000;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;box-shadow:0 0 10px rgba(255,69,0,0.8);">\${idx+1}</div>\`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          L.marker([p.latitude, p.longitude], { icon: numIcon })
            .bindPopup(\`<strong>[\${idx+1}] \${p.locationName || 'Location'}</strong><br>\${new Date(p.dateTaken).toLocaleString()}\`)
            .addTo(map);
        }
      });

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: '#FF4500', weight: 3.5, dashArray: '6, 8', opacity: 0.9 }).addTo(map);
        map.fitBounds(latlngs, { padding: [40, 40] });
      } else if (latlngs.length === 1) {
        map.setView(latlngs[0], 12);
      }
    }
  </script>
</body>
</html>`;
  }
}

export const shareService = new ShareService();
