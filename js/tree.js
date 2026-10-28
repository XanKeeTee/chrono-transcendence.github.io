/**
 * CHRONO TRANSCENDENCE — Celestial Lattice (Canvas).
 *
 * Correcciones respecto a v1:
 *  - HiDPI/Retina: el backing store se dimensiona a CSS × devicePixelRatio y se
 *    re-escala al cambiar de monitor (matchMedia de resolución) o de tamaño (ResizeObserver).
 *  - Render bajo demanda: sólo se repinta cuando algo cambia (antes: 60 fps con
 *    shadowBlur aunque nada se moviera).
 *  - Pointer Events: ratón, táctil y pellizco; un arrastre ya no selecciona el
 *    nodo sobre el que se suelta (umbral de 5 px).
 *  - Lógica de imbuir/purificar con reglas anti-exploit (keystones sellados al nacer).
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});
  const U = CT.U;
  const B = CT.BALANCE;
  const F = CT.F;

  const COLORS = {
    keystone: { glow: 'rgba(239,68,68,0.30)', shadow: '#ef4444', a: '#fca5a5', b: '#991b1b', ring: '#ef4444' },
    notable: { glow: 'rgba(212,175,55,0.30)', shadow: '#d4af37', a: '#fef08a', b: '#a16207', ring: '#d4af37' },
    minor: { glow: 'rgba(56,189,248,0.25)', shadow: '#38bdf8', a: '#bae6fd', b: '#0369a1', ring: '#38bdf8' },
  };

  class CelestialLattice {
    constructor(canvasId, engine) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext('2d');
      this.engine = engine;
      this.zoom = 1;
      this.minZoom = 0.3;
      this.maxZoom = 2.5;
      this.offsetX = 0;
      this.offsetY = 0;
      this.cssW = 0;
      this.cssH = 0;
      this.dpr = 1;
      this.dirty = true;
      this.visible = false;
      this.hovered = null;
      this.selected = null;
      this.search = '';
      this.pointers = new Map();
      this.drag = null;
      this.pinch = null;
      this.stars = [];
      const rng = U.seededRng(7);
      for (let i = 0; i < 160; i++) {
        this.stars.push({ x: (rng() - 0.5) * 1700, y: (rng() - 0.5) * 1400, r: rng() * 1.4 + 0.4, a: rng() * 0.6 + 0.15 });
      }
      this.initEvents();
      this.watchResolution();
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.resize());
        this.ro.observe(this.canvas.parentElement);
      }
      window.addEventListener('resize', () => this.resize());
      this.resize();
      this.recenter();
    }

    get state() { return this.engine.state; }
    requestRender() { this.dirty = true; }

    setVisible(v) {
      this.visible = v;
      if (v) { this.resize(); this.requestRender(); }
    }

    /** Re-dimensiona el backing store al tamaño CSS × DPR. Ignora contenedores ocultos (0×0). */
    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const firstSize = this.cssW === 0;
      this.cssW = rect.width;
      this.cssH = rect.height;
      this.dpr = dpr;
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      if (firstSize) this.recenter();
      this.requestRender();
    }

    /** Detecta cambios de DPR (arrastrar la ventana a otro monitor, zoom del navegador). */
    watchResolution() {
      if (!window.matchMedia) return;
      const listen = () => {
        const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        const onChange = () => { this.resize(); listen(); };
        if (mq.addEventListener) mq.addEventListener('change', onChange, { once: true });
      };
      listen();
    }

    recenter() {
      const w = this.cssW || 800, h = this.cssH || 600;
      this.zoom = U.clamp(Math.min(w, h) / 1180, this.minZoom, 1.2);
      this.offsetX = w / 2;
      this.offsetY = h / 2;
      this.requestRender();
    }

    zoomAt(sx, sy, factor) {
      const nz = U.clamp(this.zoom * factor, this.minZoom, this.maxZoom);
      this.offsetX = sx - (sx - this.offsetX) * (nz / this.zoom);
      this.offsetY = sy - (sy - this.offsetY) * (nz / this.zoom);
      this.zoom = nz;
      this.requestRender();
    }

    toWorld(sx, sy) { return { x: (sx - this.offsetX) / this.zoom, y: (sy - this.offsetY) / this.zoom }; }

    localPos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    nodeAt(sx, sy) {
      const w = this.toWorld(sx, sy);
      for (const n of CT.LATTICE) {
        if (Math.hypot(n.x - w.x, n.y - w.y) <= this.radius(n) + 6) return n;
      }
      return null;
    }

    radius(n) { return n.type === 'keystone' ? 24 : n.type === 'notable' ? 18 : 12; }

    initEvents() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => {
        c.setPointerCapture(e.pointerId);
        const p = this.localPos(e);
        this.pointers.set(e.pointerId, p);
        if (this.pointers.size === 1) {
          this.drag = { sx: p.x, sy: p.y, ox: this.offsetX, oy: this.offsetY, moved: false };
        } else if (this.pointers.size === 2) {
          const [a, b] = [...this.pointers.values()];
          this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
          this.drag = null;
        }
      });
      c.addEventListener('pointermove', (e) => {
        const p = this.localPos(e);
        if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
        if (this.pinch && this.pointers.size === 2) {
          const [a, b] = [...this.pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const target = U.clamp(this.pinch.zoom * (d / this.pinch.dist), this.minZoom, this.maxZoom);
          this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / this.zoom);
          return;
        }
        if (this.drag) {
          const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy;
          if (!this.drag.moved && Math.hypot(dx, dy) > 5) this.drag.moved = true;
          if (this.drag.moved) {
            this.offsetX = this.drag.ox + dx;
            this.offsetY = this.drag.oy + dy;
            this.requestRender();
          }
        }
        if (e.pointerType === 'mouse') {
          const h = this.nodeAt(p.x, p.y);
          if (h !== this.hovered) { this.hovered = h; this.requestRender(); }
          c.style.cursor = h ? 'pointer' : this.drag && this.drag.moved ? 'grabbing' : 'grab';
        }
      });
      const end = (e) => {
        const p = this.localPos(e);
        if (this.drag && !this.drag.moved && this.pointers.size === 1) {
          const n = this.nodeAt(p.x, p.y);
          if (n) { this.select(n); CT.Sound.playClick(); }
        }
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch = null;
        if (this.pointers.size === 0) this.drag = null;
      };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('pointerleave', () => { if (this.hovered) { this.hovered = null; this.requestRender(); } });
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        const p = this.localPos(e);
        this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });

      const $ = (id) => document.getElementById(id);
      $('btn-tree-zoom-in')?.addEventListener('click', () => this.zoomAt(this.cssW / 2, this.cssH / 2, 1.25));
      $('btn-tree-zoom-out')?.addEventListener('click', () => this.zoomAt(this.cssW / 2, this.cssH / 2, 0.8));
      $('btn-tree-recenter')?.addEventListener('click', () => this.recenter());
      $('btn-tree-respec')?.addEventListener('click', () => this.respec());
      $('tree-search-input')?.addEventListener('input', (e) => { this.search = e.target.value.toLowerCase().trim(); this.requestRender(); });
      $('btn-allocate-node')?.addEventListener('click', () => { if (this.selected) this.allocate(this.selected); });
    }

    // ------------------------------------------------------------ LÓGICA
    isAllocated(id) { return this.state.tree.allocated.includes(id); }
    isSealed(id) { return this.state.tree.activeKeystones.includes(id); }
    isConnected(n) { return n.connections.some((c) => this.isAllocated(c)); }
    canAllocate(n) { return !this.isAllocated(n.id) && this.isConnected(n) && this.state.player.karma >= n.cost; }

    allocate(n) {
      if (!this.canAllocate(n)) return;
      this.state.player.karma -= n.cost;
      this.state.tree.allocated.push(n.id);
      CT.Sound.playLevelUp();
      const pending = n.type === 'keystone' && !this.isSealed(n.id);
      this.engine.log(pending
        ? `Keystone [${n.title}] imbuido: se sellará en tu próxima encarnación.`
        : `Has imbuido el nodo [${n.title}].`, 'karma');
      this.engine.onTreeChanged();
      this.updateInspector();
    }

    /** Purificar: gratis el primer año de vida o tras morir; después devuelve el 75%. */
    respecInfo() {
      const age = F.age(this.state);
      const free = !this.state.player.isAlive || age < B.START_AGE + B.FREE_RESPEC_YEARS;
      let spent = 0;
      for (const id of this.state.tree.allocated) spent += CT.LATTICE_BY_ID[id].cost;
      return { free, spent, refund: free ? spent : Math.floor(spent * B.RESPEC_REFUND_LATE) };
    }

    respec() {
      if (this.state.tree.allocated.length <= 1) return;
      const info = this.respecInfo();
      const msg = info.free
        ? `¿Purificar el Árbol? Recuperas el 100% (${info.refund} Karma): estás en el umbral de una vida nueva.`
        : `¿Purificar el Árbol a mitad de vida? Recuperas el ${B.RESPEC_REFUND_LATE * 100}% (${info.refund} de ${info.spent} Karma). Es gratis durante el primer año de cada vida. Los keystones ya sellados siguen activos hasta tu muerte.`;
      if (!confirm(msg)) return;
      this.state.player.karma += info.refund;
      this.state.tree.allocated = [CT.LATTICE_ROOT];
      CT.Sound.playEureka();
      this.engine.log(`Árbol purificado: +${info.refund} Karma.`, 'karma');
      this.engine.onTreeChanged();
      this.updateInspector();
    }

    select(n) { this.selected = n; this.updateInspector(); this.requestRender(); }

    updateInspector() {
      const $ = (id) => document.getElementById(id);
      const empty = $('inspector-placeholder'), card = $('inspector-details');
      if (!empty || !card) return;
      const n = this.selected;
      empty.classList.toggle('hidden', !!n);
      card.classList.toggle('hidden', !n);
      if (!n) return;

      const allocated = this.isAllocated(n.id);
      const can = this.canAllocate(n);
      const karma = this.state.player.karma;
      const badge = $('node-type-badge');
      badge.className = `node-badge ${n.type}`;
      badge.textContent = n.type === 'keystone' ? 'Keystone Primordial' : n.type === 'notable' ? 'Sinergia Notable' : 'Nodo Menor';
      $('node-title').textContent = n.title;
      $('node-flavor').textContent = `"${n.flavor}"`;
      $('node-effect-text').textContent = n.effectText;
      $('node-cost-display').textContent = `${U.fmtInt(n.cost)} Karma`;

      const req = $('node-req-info');
      if (allocated && n.type === 'keystone' && !this.isSealed(n.id)) req.innerHTML = '<span class="purple-text">◈ Latente: se sellará al renacer</span>';
      else if (allocated) req.innerHTML = '<span class="gold-text">✓ Nodo imbuido en el alma</span>';
      else if (!this.isConnected(n)) req.innerHTML = '<span class="crimson-text">✗ Debe conectar con un nodo ya imbuido</span>';
      else if (karma < n.cost) req.innerHTML = `<span class="crimson-text">✗ Karma insuficiente (faltan ${U.fmtInt(n.cost - karma)})</span>`;
      else {
        const before = F.latentKarmaMult(karma), after = F.latentKarmaMult(karma - n.cost);
        req.innerHTML = `<span class="cyan-text">✓ Listo para imbuir</span><br><span class="dim-text">Karma Latente: ${U.pct(before, 1)} → ${U.pct(after, 1)} XP</span>`;
      }
      if (n.type === 'keystone' && !allocated) {
        req.innerHTML += '<br><span class="dim-text">Los keystones se activan al nacer (no a mitad de vida).</span>';
      }

      const btn = $('btn-allocate-node');
      btn.disabled = !can;
      btn.className = allocated ? 'btn-allocate allocated' : can ? 'btn-allocate' : 'btn-allocate disabled';
      btn.textContent = allocated ? 'Imbuido' : `Imbuir por ${U.fmtInt(n.cost)} Karma`;
    }

    // ------------------------------------------------------------ RENDER
    frame() {
      if (!this.visible || !this.dirty || this.cssW === 0) return;
      this.dirty = false;
      this.render();
    }

    render() {
      const ctx = this.ctx;
      const d = this.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(d * this.zoom, 0, 0, d * this.zoom, d * this.offsetX, d * this.offsetY);

      ctx.fillStyle = '#ffffff';
      for (const s of this.stars) {
        ctx.globalAlpha = s.a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r / Math.max(this.zoom, 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Conexiones
      const drawn = new Set();
      for (const n of CT.LATTICE) {
        for (const tid of n.connections) {
          const key = n.id < tid ? n.id + '|' + tid : tid + '|' + n.id;
          if (drawn.has(key)) continue;
          drawn.add(key);
          const t = CT.LATTICE_BY_ID[tid];
          const a1 = this.isAllocated(n.id), a2 = this.isAllocated(tid);
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(t.x, t.y);
          if (a1 && a2) {
            ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3.5;
            ctx.shadowColor = '#facc15'; ctx.shadowBlur = 8 * this.zoom * d;
            ctx.stroke(); ctx.shadowBlur = 0;
          } else if (a1 || a2) {
            ctx.strokeStyle = 'rgba(56,189,248,0.45)'; ctx.lineWidth = 2; ctx.stroke();
          } else {
            ctx.strokeStyle = 'rgba(70,84,120,0.45)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
          }
        }
      }

      // Nodos
      const showMinorLabels = this.zoom >= 0.55;
      for (const n of CT.LATTICE) {
        const r = this.radius(n);
        const col = COLORS[n.type];
        const allocated = this.isAllocated(n.id);
        const latent = allocated && n.type === 'keystone' && !this.isSealed(n.id);
        const can = this.canAllocate(n);
        const hov = this.hovered === n, sel = this.selected === n;
        const match = this.search && (n.title.toLowerCase().includes(this.search) || n.effectText.toLowerCase().includes(this.search));

        if (allocated || hov || sel || match) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + (hov || match ? 9 : 5), 0, Math.PI * 2);
          ctx.fillStyle = match ? 'rgba(250,204,21,0.35)' : col.glow;
          ctx.shadowColor = match ? '#facc15' : col.shadow;
          ctx.shadowBlur = (hov || match ? 16 : 9) * this.zoom * d;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        if (allocated && !latent) {
          const g = ctx.createRadialGradient(n.x - 3, n.y - 3, 2, n.x, n.y, r);
          g.addColorStop(0, col.a); g.addColorStop(1, col.b);
          ctx.fillStyle = g;
        } else ctx.fillStyle = latent ? '#3b1d4a' : can ? '#1e293b' : '#0f131d';
        ctx.fill();

        ctx.lineWidth = allocated ? (n.type === 'keystone' ? 3.5 : 2.5) : can ? 2 : 1.5;
        ctx.strokeStyle = latent ? '#c084fc' : allocated ? '#ffffff' : can ? '#38bdf8' : '#2a344e';
        if (latent) ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (n.type !== 'minor') {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = allocated ? col.ring : 'rgba(212,175,55,0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (sel) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
        }

        if (n.type !== 'minor' || showMinorLabels || hov || sel || match) {
          ctx.fillStyle = allocated ? '#ffffff' : can ? '#bae6fd' : '#7c8aa5';
          ctx.font = `${n.type === 'keystone' ? '700 13px' : n.type === 'notable' ? '600 11.5px' : '500 10px'} Cinzel, serif`;
          ctx.textAlign = 'center';
          ctx.fillText(n.title, n.x, n.y + r + 15);
        }
      }
    }
  }

  CT.CelestialLattice = CelestialLattice;
})(typeof window !== 'undefined' ? window : globalThis);
