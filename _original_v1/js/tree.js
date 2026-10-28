/**
 * CHRONO TRANSCENDENCE — Celestial Lattice Canvas Engine
 * Path of Exile inspired interactive skill tree with Pan, Zoom, Hover, Allocation, and Search.
 */

class CelestialLattice {
  constructor(canvasId, gameEngine) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.engine = gameEngine;

    // Viewport transform
    this.zoom = 1.0;
    this.minZoom = 0.45;
    this.maxZoom = 2.4;
    this.offsetX = 0;
    this.offsetY = 0;

    // Interaction states
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.hoveredNode = null;
    this.selectedNode = null;
    this.searchQuery = '';

    // Starfield background points
    this.stars = [];
    this.generateStarfield();

    this.initEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Center tree initially
    this.recenterView();
  }

  generateStarfield() {
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1200,
        radius: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.2,
        speed: Math.random() * 0.02 + 0.005
      });
    }
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  recenterView() {
    this.zoom = 1.0;
    this.offsetX = this.canvas.width / 2 - 400;
    this.offsetY = this.canvas.height / 2 - 270;
  }

  initEvents() {
    // Mouse Dragging (Pan)
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // left click
        this.isDragging = true;
        this.dragStartX = e.clientX - this.offsetX;
        this.dragStartY = e.clientY - this.offsetY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        this.offsetX = e.clientX - this.dragStartX;
        this.offsetY = e.clientY - this.dragStartY;
      }

      // Check hover
      const worldPos = this.screenToWorld(mouseX, mouseY);
      this.hoveredNode = this.getNodeAt(worldPos.x, worldPos.y);
      this.canvas.style.cursor = this.hoveredNode ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
    });

    // Mouse Zoom (Wheel)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * zoomFactor));

      // Zoom towards mouse
      this.offsetX = mouseX - (mouseX - this.offsetX) * (newZoom / this.zoom);
      this.offsetY = mouseY - (mouseY - this.offsetY) * (newZoom / this.zoom);
      this.zoom = newZoom;
    }, { passive: false });

    // Node Click / Select
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldPos = this.screenToWorld(mouseX, mouseY);
      const clicked = this.getNodeAt(worldPos.x, worldPos.y);

      if (clicked) {
        this.selectNode(clicked);
        window.Sound.playClick();
      }
    });

    // UI Buttons
    document.getElementById('btn-tree-zoom-in')?.addEventListener('click', () => {
      this.zoom = Math.min(this.maxZoom, this.zoom * 1.25);
    });

    document.getElementById('btn-tree-zoom-out')?.addEventListener('click', () => {
      this.zoom = Math.max(this.minZoom, this.zoom / 1.25);
    });

    document.getElementById('btn-tree-recenter')?.addEventListener('click', () => {
      this.recenterView();
    });

    document.getElementById('btn-tree-respec')?.addEventListener('click', () => {
      this.respecTree();
    });

    // Search Bar
    const searchInput = document.getElementById('tree-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
    });

    // Node Allocate Button in side-panel
    document.getElementById('btn-allocate-node')?.addEventListener('click', () => {
      if (this.selectedNode) {
        this.allocateNode(this.selectedNode);
      }
    });
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.zoom,
      y: (sy - this.offsetY) / this.zoom
    };
  }

  getNodeAt(wx, wy) {
    for (const node of LATTICE_NODES) {
      const radius = this.getNodeRadius(node) + 6;
      const dist = Math.hypot(node.x - wx, node.y - wy);
      if (dist <= radius) {
        return node;
      }
    }
    return null;
  }

  getNodeRadius(node) {
    if (node.type === 'keystone') return 24;
    if (node.type === 'notable') return 18;
    return 13; // minor
  }

  isNodeAllocated(nodeId) {
    return this.engine.state.celestialTree.allocatedNodes.includes(nodeId);
  }

  canAllocateNode(node) {
    if (this.isNodeAllocated(node.id)) return false;
    if (this.engine.state.player.karma < node.cost) return false;

    // Must be connected to an already allocated node
    const isConnectedToAllocated = node.connections.some(connId =>
      this.isNodeAllocated(connId)
    );
    return isConnectedToAllocated;
  }

  selectNode(node) {
    this.selectedNode = node;
    this.updateInspectorUI();
  }

  updateInspectorUI() {
    const placeholder = document.getElementById('inspector-placeholder');
    const details = document.getElementById('inspector-details');
    if (!placeholder || !details) return;

    if (!this.selectedNode) {
      placeholder.classList.remove('hidden');
      details.classList.add('hidden');
      return;
    }

    placeholder.classList.add('hidden');
    details.classList.remove('hidden');

    const node = this.selectedNode;
    const isAllocated = this.isNodeAllocated(node.id);
    const canAfford = this.canAllocateNode(node);

    // Badge styling
    const badge = document.getElementById('node-type-badge');
    badge.className = `node-badge ${node.type}`;
    badge.textContent = node.type === 'keystone' ? 'Keystone Primordial' :
      (node.type === 'notable' ? 'Sinergia Notable' : 'Nodo Menor');

    document.getElementById('node-title').textContent = node.title;
    document.getElementById('node-flavor').textContent = `"${node.flavor}"`;
    document.getElementById('node-effect-text').textContent = node.effectText;
    document.getElementById('node-cost-display').textContent = `${node.cost} Karma`;

    // Requisites
    const reqInfo = document.getElementById('node-req-info');
    if (isAllocated) {
      reqInfo.innerHTML = '<span class="gold-text">✓ Nodo Imbuido en el Alma</span>';
    } else if (canAfford) {
      reqInfo.innerHTML = '<span class="cyan-text">✓ Listo para ser Imbuido</span>';
    } else if (this.engine.state.player.karma < node.cost) {
      reqInfo.innerHTML = `<span class="crimson-text">✗ Karma insuficiente (Faltan ${node.cost - this.engine.state.player.karma})</span>`;
    } else {
      reqInfo.innerHTML = '<span class="crimson-text">✗ Requiere conectar a un nodo ya imbuido</span>';
    }

    const btnAllocate = document.getElementById('btn-allocate-node');
    if (isAllocated) {
      btnAllocate.className = 'btn-allocate allocated';
      btnAllocate.textContent = 'Permanentemente Imbuido';
      btnAllocate.disabled = true;
    } else if (canAfford) {
      btnAllocate.className = 'btn-allocate';
      btnAllocate.textContent = `Imbuir por ${node.cost} Karma`;
      btnAllocate.disabled = false;
    } else {
      btnAllocate.className = 'btn-allocate disabled';
      btnAllocate.textContent = `Imbuir por ${node.cost} Karma`;
      btnAllocate.disabled = true;
    }
  }

  allocateNode(node) {
    if (!this.canAllocateNode(node)) return;

    this.engine.state.player.karma -= node.cost;
    this.engine.state.celestialTree.allocatedNodes.push(node.id);

    window.Sound.playLevelUp();
    this.engine.addChronicle(`Has imbuido el nodo [${node.title}] en el Árbol del Destino.`, true);
    this.engine.recalculateAllModifiers();
    this.updateInspectorUI();
    this.engine.updateTopBarUI();
  }

  respecTree() {
    const allocated = this.engine.state.celestialTree.allocatedNodes;
    if (allocated.length <= 1) return; // Only root

    if (!confirm('¿Deseas purificar el Árbol del Destino? Se devolverá el 100% del Karma invertido en todos los nodos (excepto el Despertar inicial).')) {
      return;
    }

    let refund = 0;
    allocated.forEach(id => {
      const node = LATTICE_NODES.find(n => n.id === id);
      if (node && node.id !== 'root_awakening') {
        refund += node.cost;
      }
    });

    this.engine.state.player.karma += refund;
    this.engine.state.celestialTree.allocatedNodes = ['root_awakening'];

    window.Sound.playEureka();
    this.engine.addChronicle(`Árbol purificado. Se han recuperado +${refund} Puntos de Karma.`, true);
    this.engine.recalculateAllModifiers();
    this.updateInspectorUI();
    this.engine.updateTopBarUI();
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.zoom, this.zoom);

    // 1. Draw Starfield background
    this.renderStarfield();

    // 2. Draw Connection Lines
    this.renderConnections();

    // 3. Draw Nodes
    this.renderNodes();

    this.ctx.restore();
  }

  renderStarfield() {
    this.ctx.fillStyle = '#ffffff';
    for (const star of this.stars) {
      this.ctx.globalAlpha = star.alpha;
      this.ctx.beginPath();
      this.ctx.arc(star.x + 400, star.y + 300, star.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;
  }

  renderConnections() {
    const drawnPairs = new Set();

    for (const node of LATTICE_NODES) {
      const isSrcAllocated = this.isNodeAllocated(node.id);

      for (const targetId of node.connections) {
        const pairKey = [node.id, targetId].sort().join('--');
        if (drawnPairs.has(pairKey)) continue;
        drawnPairs.add(pairKey);

        const target = LATTICE_NODES.find(n => n.id === targetId);
        if (!target) continue;

        const isTgtAllocated = this.isNodeAllocated(target.id);
        const bothAllocated = isSrcAllocated && isTgtAllocated;
        const oneAllocated = isSrcAllocated || isTgtAllocated;

        this.ctx.beginPath();
        this.ctx.moveTo(node.x, node.y);
        this.ctx.lineTo(target.x, target.y);

        if (bothAllocated) {
          // Bright glowing celestial connection
          this.ctx.strokeStyle = '#d4af37';
          this.ctx.lineWidth = 3.5;
          this.ctx.shadowColor = '#facc15';
          this.ctx.shadowBlur = 10;
          this.ctx.stroke();
          this.ctx.shadowBlur = 0; // reset
        } else if (oneAllocated) {
          // Available path
          this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          this.ctx.lineWidth = 2.0;
          this.ctx.stroke();
        } else {
          // Dormant path
          this.ctx.strokeStyle = 'rgba(42, 52, 78, 0.5)';
          this.ctx.lineWidth = 1.5;
          this.ctx.setLineDash([4, 4]);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        }
      }
    }
  }

  renderNodes() {
    for (const node of LATTICE_NODES) {
      const isAllocated = this.isNodeAllocated(node.id);
      const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;
      const isSelected = this.selectedNode && this.selectedNode.id === node.id;
      const canAfford = this.canAllocateNode(node);
      const radius = this.getNodeRadius(node);

      // Search match highlight
      const matchesSearch = this.searchQuery && (
        node.title.toLowerCase().includes(this.searchQuery) ||
        node.effectText.toLowerCase().includes(this.searchQuery)
      );

      // Outer glow if selected, hovered, or search hit
      if (isAllocated || isHovered || isSelected || matchesSearch) {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius + (isHovered ? 8 : 5), 0, Math.PI * 2);

        if (node.type === 'keystone') {
          this.ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          this.ctx.shadowColor = '#ef4444';
        } else if (node.type === 'notable') {
          this.ctx.fillStyle = 'rgba(212, 175, 55, 0.3)';
          this.ctx.shadowColor = '#d4af37';
        } else {
          this.ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
          this.ctx.shadowColor = '#38bdf8';
        }

        this.ctx.shadowBlur = isHovered ? 18 : 10;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
      }

      // Main Node Orb
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

      if (isAllocated) {
        // Radiant allocated gradient
        const grad = this.ctx.createRadialGradient(node.x - 3, node.y - 3, 2, node.x, node.y, radius);
        if (node.type === 'keystone') {
          grad.addColorStop(0, '#fca5a5');
          grad.addColorStop(1, '#991b1b');
        } else if (node.type === 'notable') {
          grad.addColorStop(0, '#fef08a');
          grad.addColorStop(1, '#a16207');
        } else {
          grad.addColorStop(0, '#bae6fd');
          grad.addColorStop(1, '#0369a1');
        }
        this.ctx.fillStyle = grad;
      } else if (canAfford) {
        // Pulsing unlockable node
        this.ctx.fillStyle = '#1e293b';
      } else {
        // Dormant node
        this.ctx.fillStyle = '#0f131d';
      }
      this.ctx.fill();

      // Border Ring
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      if (isAllocated) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = node.type === 'keystone' ? 3.5 : 2.5;
      } else if (canAfford) {
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 2.0;
      } else {
        this.ctx.strokeStyle = '#2a344e';
        this.ctx.lineWidth = 1.5;
      }
      this.ctx.stroke();

      // Extra Ornament for Notables and Keystones
      if (node.type === 'notable' || node.type === 'keystone') {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = isAllocated ? (node.type === 'keystone' ? '#ef4444' : '#d4af37') : 'rgba(212, 175, 55, 0.4)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }

      // Title Text under node
      this.ctx.fillStyle = isAllocated ? '#ffffff' : (canAfford ? '#bae6fd' : '#64748b');
      this.ctx.font = `${node.type === 'keystone' ? '600 12px' : (node.type === 'notable' ? '600 11px' : '500 10px')} 'Cinzel', serif`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(node.title, node.x, node.y + radius + 15);
    }
  }
}
