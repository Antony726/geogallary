/**
 * Memory Galaxy View Component
 * A playful 2D Canvas universe where photos float as glowing celestial stars
 * that organically drift and cluster by Place, Journey, or Time.
 */

import { storageService } from '../services/storageService.js';
import { tripDetectionService } from '../services/tripDetectionService.js';
import { formatDate, resolveMediaUrl, FALLBACK_IMAGE_DATA_URI } from '../config.js';

export class GalaxyView {
  constructor(app) {
    this.app = app;
    this.allMedia = [];
    this.trips = [];
    this.groupBy = 'place'; // 'place' | 'trip' | 'time'

    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;

    this.orbs = [];
    this.clusters = [];
    this.hoveredOrb = null;
    this.selectedCluster = null;

    // Canvas camera transform
    this.camera = { x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1 };

    // Mouse/Touch tracking
    this.pointer = { x: -1000, y: -1000, isDown: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 };

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.container = document.getElementById('view-galaxy');
    this.canvas = document.getElementById('galaxy-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    this.groupPills = document.querySelectorAll('#galaxy-group-switcher .galaxy-pill');
    this.labelTotalOrbs = document.getElementById('galaxy-total-orbs');
    this.labelTotalClusters = document.getElementById('galaxy-total-clusters');
    this.btnResetCamera = document.getElementById('btn-galaxy-reset');
    this.bloomPreviewCard = document.getElementById('galaxy-bloom-card');
  }

  attachEvents() {
    // Window Resize
    window.addEventListener('resize', () => {
      if (this.container && this.container.classList.contains('active')) {
        this.resizeCanvas();
      }
    });

    // Grouping Switcher Pills
    this.groupPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.groupPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.groupBy = pill.dataset.group;
        this.buildClusters();
      });
    });

    if (this.btnResetCamera) {
      this.btnResetCamera.addEventListener('click', () => {
        this.resetCamera();
      });
    }

    // Canvas Pointer Events (Pan & Proximity)
    if (this.canvas) {
      this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
      this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
      this.canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e));
      this.canvas.addEventListener('mouseleave', () => this.handlePointerLeave());
      this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

      // Touch events
      this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
      this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
      this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }
  }

  resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const width = (rect.width && rect.width > 50) ? rect.width : window.innerWidth;
    const height = (rect.height && rect.height > 50) ? rect.height : (window.innerHeight - 128);

    this.canvas.width = width * window.devicePixelRatio;
    this.canvas.height = height * window.devicePixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  async render() {
    this.allMedia = await storageService.getAllMedia();
    this.trips = await tripDetectionService.detectTrips();

    setTimeout(() => {
      this.resizeCanvas();
      this.buildClusters();
      this.resetCamera();
      this.startAnimationLoop();
    }, 60);
  }

  resetCamera() {
    if (!this.canvas) return;
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;
    this.camera.targetX = width / 2;
    this.camera.targetY = height / 2;
    this.camera.x = width / 2;
    this.camera.y = height / 2;
    this.camera.zoom = 1;
    this.camera.targetZoom = 1;
    if (this.bloomPreviewCard) this.bloomPreviewCard.style.display = 'none';
  }

  buildClusters() {
    if (!this.canvas) return;
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    const clusterMap = {};

    // Generate grouping keys
    this.allMedia.forEach(item => {
      let key = 'Unspecified';
      let title = 'Unspecified';

      if (this.groupBy === 'place') {
        key = item.city || item.country || item.locationName || 'Unspecified Location';
        title = key;
      } else if (this.groupBy === 'trip') {
        const trip = this.trips.find(t => (t.photoIds || []).includes(item.id));
        key = trip ? trip.id : (item.locationName || 'Single Memories');
        title = trip ? trip.name : (item.locationName || 'Single Memories');
      } else if (this.groupBy === 'time') {
        key = item.yearMonth || item.year || 'Unspecified Date';
        title = key !== 'Unspecified Date' ? formatDate(key) : 'Unspecified Date';
      }

      if (!clusterMap[key]) {
        clusterMap[key] = {
          id: key,
          title,
          items: [],
          color: this.generateClusterColor(key),
          centerX: 0,
          centerY: 0,
          targetCenterX: 0,
          targetCenterY: 0
        };
      }
      clusterMap[key].items.push(item);
    });

    const clusterList = Object.values(clusterMap);
    const numClusters = clusterList.length;

    // Arrange cluster centers in a soft spiral/ring around canvas center
    clusterList.forEach((cluster, i) => {
      const angle = (i / Math.max(1, numClusters)) * Math.PI * 2 + (Math.random() * 0.4);
      const radius = numClusters > 1 ? (140 + Math.min(i * 35, 280) + (Math.random() * 50)) : 0;
      cluster.targetCenterX = (width / 2) + Math.cos(angle) * radius;
      cluster.targetCenterY = (height / 2) + Math.sin(angle) * radius;
      cluster.centerX = cluster.targetCenterX;
      cluster.centerY = cluster.targetCenterY;
    });

    this.clusters = clusterList;

    // Create orb objects
    const orbs = [];
    clusterList.forEach(cluster => {
      cluster.items.forEach((item) => {
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDist = 25 + Math.random() * (30 + cluster.items.length * 5);

        orbs.push({
          id: item.id,
          item,
          cluster,
          x: cluster.centerX + Math.cos(offsetAngle) * offsetDist,
          y: cluster.centerY + Math.sin(offsetAngle) * offsetDist,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          baseRadius: 10 + (item.mediaType === 'video' ? 4 : 0),
          radius: 10,
          color: cluster.color,
          pulseOffset: Math.random() * Math.PI * 2,
          pulseSpeed: 0.02 + Math.random() * 0.03,
          glowIntensity: 0.6 + Math.random() * 0.4
        });
      });
    });

    this.orbs = orbs;

    if (this.labelTotalOrbs) this.labelTotalOrbs.textContent = `${orbs.length} stars`;
    if (this.labelTotalClusters) this.labelTotalClusters.textContent = `${clusterList.length} clusters`;
  }

  generateClusterColor(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 85%, 65%)`;
  }

  startAnimationLoop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    const loop = () => {
      if (this.container && this.container.classList.contains('active')) {
        this.updatePhysics();
        this.draw();
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  updatePhysics() {
    // Smooth camera interpolation
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.1;

    // Convert mouse screen coords to world coords
    const dpr = window.devicePixelRatio || 1;
    const canvasW = (this.canvas.width / dpr);
    const canvasH = (this.canvas.height / dpr);

    const worldMouseX = (this.pointer.x - canvasW / 2) / this.camera.zoom + this.camera.x;
    const worldMouseY = (this.pointer.y - canvasH / 2) / this.camera.zoom + this.camera.y;

    let closestOrb = null;
    let minMouseDist = 45;

    // Update orb physics
    const time = Date.now() * 0.002;

    this.orbs.forEach(orb => {
      // 1. Organic Idle Float / Drift (sine waves)
      orb.x += Math.sin(time + orb.pulseOffset) * 0.35 + orb.vx;
      orb.y += Math.cos(time * 0.8 + orb.pulseOffset) * 0.35 + orb.vy;

      // Damping
      orb.vx *= 0.95;
      orb.vy *= 0.95;

      // 2. Gravitational pull toward cluster center
      const dx = orb.cluster.centerX - orb.x;
      const dy = orb.cluster.centerY - orb.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        orb.vx += (dx / dist) * 0.08;
        orb.vy += (dy / dist) * 0.08;
      }

      // 3. Repulsion from pointer when close
      const pdx = orb.x - worldMouseX;
      const pdy = orb.y - worldMouseY;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

      if (pdist < 70 && pdist > 0) {
        const force = (70 - pdist) / 70;
        orb.vx += (pdx / pdist) * force * 1.5;
        orb.vy += (pdy / pdist) * force * 1.5;
      }

      if (pdist < minMouseDist) {
        minMouseDist = pdist;
        closestOrb = orb;
      }

      // 4. Subtle pulsing breathing size
      const pulse = Math.sin(time * 2 + orb.pulseOffset) * 1.5;
      const targetRadius = orb === this.hoveredOrb ? orb.baseRadius + 6 : orb.baseRadius + pulse;
      orb.radius += (targetRadius - orb.radius) * 0.2;
    });

    this.hoveredOrb = closestOrb;
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const canvasW = width / dpr;
    const canvasH = height / dpr;

    this.ctx.save();
    this.ctx.scale(dpr, dpr);
    this.ctx.clearRect(0, 0, canvasW, canvasH);

    // Deep Space Radial Background
    const bgGradient = this.ctx.createRadialGradient(
      canvasW / 2, canvasH / 2, 50,
      canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH)
    );
    bgGradient.addColorStop(0, '#0a0b12');
    bgGradient.addColorStop(0.5, '#050508');
    bgGradient.addColorStop(1, '#020203');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, canvasW, canvasH);

    // Camera Transformation Matrix
    this.ctx.save();
    this.ctx.translate(canvasW / 2, canvasH / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Draw Constellation Connecting Threads inside each cluster
    this.clusters.forEach(cluster => {
      const clusterOrbs = this.orbs.filter(o => o.cluster === cluster);
      if (clusterOrbs.length > 1) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = cluster.color.replace('hsl', 'hsla').replace(')', ', 0.12)');
        this.ctx.lineWidth = 1 / this.camera.zoom;

        for (let i = 0; i < clusterOrbs.length; i++) {
          for (let j = i + 1; j < clusterOrbs.length; j++) {
            const o1 = clusterOrbs[i];
            const o2 = clusterOrbs[j];
            const dx = o1.x - o2.x;
            const dy = o1.y - o2.y;
            if (Math.sqrt(dx * dx + dy * dy) < 120) {
              this.ctx.moveTo(o1.x, o1.y);
              this.ctx.lineTo(o2.x, o2.y);
            }
          }
        }
        this.ctx.stroke();
      }

      // 2. Draw Cluster Title Badges
      this.ctx.font = '600 11px system-ui, sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${cluster.title} (${cluster.items.length})`, cluster.centerX, cluster.centerY + 45);
    });

    // 3. Draw Orbs
    this.orbs.forEach(orb => {
      const isHovered = orb === this.hoveredOrb;

      // Outer Radial Glow
      const glowGrad = this.ctx.createRadialGradient(
        orb.x, orb.y, 0,
        orb.x, orb.y, orb.radius * (isHovered ? 3.5 : 2.2)
      );
      glowGrad.addColorStop(0, orb.color);
      glowGrad.addColorStop(0.4, orb.color.replace('hsl', 'hsla').replace(')', `, ${isHovered ? 0.6 : 0.25})`));
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = glowGrad;
      this.ctx.beginPath();
      this.ctx.arc(orb.x, orb.y, orb.radius * (isHovered ? 3.5 : 2.2), 0, Math.PI * 2);
      this.ctx.fill();

      // Core Solid Orb
      this.ctx.fillStyle = isHovered ? '#ffffff' : orb.color;
      this.ctx.beginPath();
      this.ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
    this.ctx.restore();
  }

  handlePointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;

    if (this.pointer.isDown) {
      const dx = (this.pointer.x - this.pointer.startX) / this.camera.zoom;
      const dy = (this.pointer.y - this.pointer.startY) / this.camera.zoom;
      this.camera.targetX = this.pointer.camStartX - dx;
      this.camera.targetY = this.pointer.camStartY - dy;
    }
  }

  handlePointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.isDown = true;
    this.pointer.startX = e.clientX - rect.left;
    this.pointer.startY = e.clientY - rect.top;
    this.pointer.camStartX = this.camera.targetX;
    this.pointer.camStartY = this.camera.targetY;
  }

  handlePointerUp(e) {
    const rect = this.canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const distMoved = Math.hypot(endX - this.pointer.startX, endY - this.pointer.startY);

    this.pointer.isDown = false;

    // If tap/click without dragging -> Dive into cluster or open Lightbox
    if (distMoved < 6) {
      if (this.hoveredOrb) {
        this.diveIntoOrb(this.hoveredOrb);
      }
    }
  }

  handlePointerLeave() {
    this.pointer.isDown = false;
    this.pointer.x = -1000;
    this.pointer.y = -1000;
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    this.camera.targetZoom = Math.max(0.4, Math.min(4.0, this.camera.targetZoom * zoomFactor));
  }

  handleTouchStart(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.isDown = true;
      this.pointer.startX = t.clientX - rect.left;
      this.pointer.startY = t.clientY - rect.top;
      this.pointer.camStartX = this.camera.targetX;
      this.pointer.camStartY = this.camera.targetY;
    }
  }

  handleTouchMove(e) {
    if (e.touches.length === 1 && this.pointer.isDown) {
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = t.clientX - rect.left;
      this.pointer.y = t.clientY - rect.top;
      const dx = (this.pointer.x - this.pointer.startX) / this.camera.zoom;
      const dy = (this.pointer.y - this.pointer.startY) / this.camera.zoom;
      this.camera.targetX = this.pointer.camStartX - dx;
      this.camera.targetY = this.pointer.camStartY - dy;
    }
  }

  handleTouchEnd() {
    this.pointer.isDown = false;
  }

  diveIntoOrb(orb) {
    // Zoom camera smoothly into cluster center
    this.camera.targetX = orb.cluster.centerX;
    this.camera.targetY = orb.cluster.centerY;
    this.camera.targetZoom = 2.2;

    // Bloom Photo Preview Card
    if (this.bloomPreviewCard) {
      const item = orb.item;
      const thumb = resolveMediaUrl(item);
      this.bloomPreviewCard.style.display = 'flex';
      this.bloomPreviewCard.innerHTML = `
        <div class="bloom-card-inner">
          <button class="bloom-close-btn" id="btn-close-bloom">&times;</button>
          <img src="${thumb}" alt="${item.fileName}" class="bloom-img" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE_DATA_URI}';">
          <div class="bloom-info">
            <h4 class="font-serif text-white text-sm truncate">${item.fileName || 'Memory'}</h4>
            <p class="text-xs text-zinc-400 font-mono">${formatDate(item.dateTaken)} • ${item.locationName || 'Unspecified'}</p>
            <button class="btn btn-primary btn-sm mt-2 w-full" id="btn-open-galaxy-lightbox">
              <iconify-icon icon="lucide:maximize-2"></iconify-icon>
              <span>View Fullscreen</span>
            </button>
          </div>
        </div>
      `;

      this.bloomPreviewCard.querySelector('#btn-close-bloom').addEventListener('click', () => {
        this.bloomPreviewCard.style.display = 'none';
      });

      this.bloomPreviewCard.querySelector('#btn-open-galaxy-lightbox').addEventListener('click', () => {
        const indexInGlobal = this.allMedia.indexOf(item);
        this.app.lightbox.open(this.allMedia, indexInGlobal >= 0 ? indexInGlobal : 0);
      });
    }
  }
}
