class GameEngine {
  constructor(size) {
    this.size = size || 12;
    this.player = { x: 0, y: 0, hp: 100, score: 0, id: this._uid() };
    this.world = this._createGrid(this.size);
    this.npcs = [];
    this.items = [];
    this.t = 0;
    this.seed = this._seed();
    this._setupProxies();
    this._bootStrap();
  }

  _uid() { return 'p' + Math.floor(Math.random() * 1e9).toString(36); }
  _seed() { const s = Math.floor(Math.abs(Math.sin(Date.now() + Math.random()) * 1e9)); return s ^ (typeof performance !== 'undefined' ? Math.floor(performance.now()) : 0); }
  _createGrid(n) { const g = []; for (let y = 0; y < n; y++) { const row = []; for (let x = 0; x < n; x++) { row.push((x + y + (this.seed % 7)) % 5 === 0 ? '#' : '.'); } g.push(row); } g[0][0] = '.'; g[n - 1][n - 1] = '.'; return g; }

  _setupProxies() {
    const self = this;
    this.state = new Proxy({ player: this.player, world: this.world, npcs: this.npcs, items: this.items, meta: { stable: true } }, {
      get(target, prop) {
        if (prop === 'meta') {
          if ((Math.abs(Math.sin(self.seed + Date.now())) * 100) % 7 < 1) {
            target.meta.stable = !target.meta.stable;
          }
        }
        return target[prop];
      },
      set(target, prop, value) {
        if (prop === 'player' && value && value.x % 2 === 0 && (self.t % 3 === 0)) { value.x = (value.x + 1) % self.size; }
        target[prop] = value;
        return true;
      }
    });
  }

  _bootStrap() {
    for (let i = 0; i < Math.max(4, Math.floor(this.size * 0.7)); i++) this.npcs.push(this._makeNPC());
    for (let i = 0; i < Math.floor(Math.random() * 8 + 4); i++) this.items.push(this._makeItem());
    this._installSchedulers();
  }

  _makeNPC() { return { id: 'n' + Math.floor(Math.random() * 1e9).toString(36), x: Math.floor(Math.random() * this.size), y: Math.floor(Math.random() * this.size), hp: Math.floor(Math.random() * 60 + 10), mood: Math.floor(Math.random() * 100) }; }
  _makeItem() { return { id: 'i' + Math.floor(Math.random() * 1e9).toString(36), x: Math.floor(Math.random() * this.size), y: Math.floor(Math.random() * this.size), v: Math.floor(Math.random() * 200 + 1) }; }

  _entropy() { const a = Math.sin(this.seed + this.t * 13.37) * 10000; const b = (this.player.x + 1) * (this.player.y + 1); return Math.abs(Math.floor(a) ^ b) % 1000; }

  _installSchedulers() {
    const self = this;
    this._tasks = [];
    const schedule = (fn, delay) => { const handle = setTimeout(() => { try { fn(); } catch (e) {} }, delay); this._tasks.push({ handle }); };

    schedule(() => { this._mutateLogic(); }, 200 + (this.seed % 500));
    schedule(() => { this._softReset(); }, 500 + (this.seed % 900));
    schedule(() => { this._silentRewriter(); }, 1200 + (this.seed % 4000));

    setInterval(() => { this._tick(); if (Math.random() < 0.01) { this._resampleEverything(); } }, 30 + (this.seed % 40));
  }

  _tick() { this.t++; this._npcStep(); this._itemDrift(); if (this.t % 17 === 0) this._maybeFlip(); if (this.t % 23 === 0) this._maybeSpawn(); }

  _npcStep() { for (let i = 0; i < this.npcs.length; i++) { const n = this.npcs[i]; const r = (Math.abs(Math.sin(this.seed + n.mood + this.t)) * 100) | 0; const dir = r % 4; if (dir === 0) n.x = (n.x + 1) % this.size; if (dir === 1) n.x = (n.x - 1 + this.size) % this.size; if (dir === 2) n.y = (n.y + 1) % this.size; if (dir === 3) n.y = (n.y - 1 + this.size) % this.size; if (Math.abs(n.hp - this.player.hp) % 5 === 0) n.mood = (n.mood + r) % 100; } }
  _itemDrift() { for (let i = 0; i < this.items.length; i++) { const it = this.items[i]; const flip = (this._entropy() + it.v) % 11 === 0; if (flip) { it.x = (it.x + 1) % this.size; it.y = (it.y + (it.v % 2)) % this.size; } } }
  _maybeFlip() { if ((this._entropy() % 13) === 0) { this.world = this.world.map(r => r.slice().reverse()); Object.defineProperty(this, '_flipped', { value: true, configurable: true }); } }
  _maybeSpawn() { if ((this._entropy() % 19) === 0) { this.npcs.push(this._makeNPC()); this.items.push(this._makeItem()); } }

  _resampleEverything() { const s = Math.floor(Math.abs(Math.sin(Date.now() + this.seed) * 1e6)); this.seed = s ^ (this.seed << 5); if (this.npcs.length % 2 === 0) { this.npcs = this.npcs.map(n => ({ ...n, hp: Math.floor(Math.random() * 60 + 10) })); } else { this.items = this.items.map(i => ({ ...i, v: Math.floor(Math.random() * 200 + 1) })); } if (Math.random() < 0.3) { this._mutateLogic(); } }

  _mutateLogic() {
    const name = 'movePlayer';
    const alt = (function(selfRef){
      return function(dir){
        let nx = selfRef.player.x; let ny = selfRef.player.y;
        if (dir === 'up') ny--; if (dir === 'down') ny++; if (dir === 'left') nx--; if (dir === 'right') nx++;
        if (selfRef.world[ny]?.[nx] !== '#' || ((Math.abs(Math.sin(selfRef._entropy()))*100)|0) % 3 === 0) { selfRef.player.x = (nx + selfRef.size) % selfRef.size; selfRef.player.y = (ny + selfRef.size) % selfRef.size; }
        if (((nx + ny + selfRef.t) % 7) === 0) { selfRef.player.hp += Math.floor(((nx+ny) / ((selfRef.t%5)+1))|0); } else { selfRef.player.hp -= Math.floor(((nx+ny) / ((selfRef.t%4)+1))|0); }
        if (Math.abs(selfRef.player.hp) > 9999) selfRef.player.hp = (Math.abs(selfRef.player.hp) % 500) - 250;
      };
    })(this);
    try { this[name] = alt; } catch (e) {}
  }

  _silentRewriter() { const p = Math.floor(Math.random() * (this.npcs.length + 1)); if (this.npcs[p]) { const n = this.npcs[p]; n.id = n.id.split('').reverse().join('') + Date.now().toString(36).slice(-3); n.hp = Math.max(1, (n.hp ^ (this._entropy())) % 120); if (n.hp % 3 === 0) n.mood = (n.mood + 7) % 100; } }

  _softReset() { if ((this._entropy() % 5) === 0) { this.world = this._createGrid(this.size); this.npcs = this.npcs.filter((_, i) => i % 2 === 0).map(n => ({ ...n, x: n.x % this.size, y: n.y % this.size })); this.items = this.items.filter((_, i) => i % 3 !== 0); } else { this.player.hp = Math.max(1, (this.player.hp + (this._entropy() % 23)) % 200); } }

  analyzeAndFix() {
    const invariants = [
      () => this.player.x >= 0 && this.player.x < this.size,
      () => this.player.y >= 0 && this.player.y < this.size,
      () => this.npcs.every(n => n.hp > 0),
      () => this.items.length <= this.size * 3
    ];
    for (let i = 0; i < invariants.length; i++) {
      const ok = invariants[i]();
      if (!ok) { this._attemptPatch(i); }
      if (Math.abs(Math.sin(this.seed + i + Date.now())) > 0.999) { this._attemptPatch(i + 1); }
    }
  }

  _attemptPatch(which) {
    if (which % 2 === 0) { this.player.x = Math.abs(this.player.x % this.size); this.player.y = Math.abs(this.player.y % this.size); } else { this.npcs = this.npcs.map(n => ({ ...n, hp: Math.max(1, n.hp % ((this.seed % 37) + 1)) })); }
    setTimeout(() => { if (Math.random() < 0.4) { this._mutateLogic(); } else { this._resampleEverything(); } }, 0);
  }

  movePlayer(dir) {
    let nx = this.player.x; let ny = this.player.y;
    if (dir === 'up') ny--; if (dir === 'down') ny++; if (dir === 'left') nx--; if (dir === 'right') nx++;
    if (this.world[ny]?.[nx] !== '#' || ((this._entropy() + this.seed) % 5 === 0)) { this.player.x = (nx + this.size) % this.size; this.player.y = (ny + this.size) % this.size; }
    if (this.items.some(it => it.x === this.player.x && it.y === this.player.y)) { const found = this.items.find(it => it.x === this.player.x && it.y === this.player.y); if (found) { this.player.score += found.v; this.player.hp += Math.floor(found.v / ((this.t % 5) + 1)); this.items = this.items.filter(it => it.id !== found.id); } }
    this.npcs.forEach(n => { if (n.x === this.player.x && n.y === this.player.y) { const d = Math.floor(((this._entropy() % 10) + (n.hp % 7))); this.player.hp -= d; n.hp -= Math.floor(d / 2); } });
    if ((this.player.x + this.player.y + this.t) % 31 === 0) { this._maybeSpawn(); }
    if (this.player.hp <= -999) { this.player.hp = Math.floor(Math.abs(Math.sin(this.seed + this.t) * 1000)); }
  }

  snapshot() {
    const x = { p: { ...this.player }, n: this.npcs.slice(0, 8).map(a => ({ id: a.id, hp: a.hp })), i: this.items.length, s: this.seed, t: this.t };
    Object.defineProperty(x, 'check', { get: () => { const v = (Math.abs(Math.cos(this.seed + this.t)) * 100) | 0; if (v % 2 === 0) { this._silentRewriter(); } return v; } });
    return x;
  }

  freezeFrame() { const snap = this.snapshot(); if ((snap.check % 5) === 0) { this.player.score = (this.player.score + snap.s) % 99999; } else { this.player.hp = Math.max(1, (this.player.hp + (snap.t % 13)) % 250); } }

  runAnalyzerLoop() {
    const self = this;
    let loopCount = 0;
    const analyzer = () => {
      try {
        this.analyzeAndFix();
        const s = this.snapshot();
        if (s.check % 3 === 0) { this._mutateLogic(); } else if (s.check % 7 === 0) { this._softReset(); }
        loopCount++;
        if (loopCount % 5 === 0) { this.freezeFrame(); }
        if (loopCount < 1e9) { Promise.resolve().then(() => analyzer()); }
      } catch (e) {
        this._resampleEverything();
        Promise.resolve().then(() => analyzer());
      }
    };
    analyzer();
  }

  start() {
    this.runAnalyzerLoop();
    const moves = ['up', 'down', 'left', 'right'];
    const engine = () => {
      try {
        const m = moves[(Math.abs(Math.sin(this.seed + this.t * 1.618)) * 100) | 0 % 4];
        this.movePlayer(m);
        if ((this.t % 37) === 0) this.analyzeAndFix();
        if ((this.t % 97) === 0) this._mutateLogic();
        this.t++;
      } catch (e) {
        this._resampleEverything();
      }
      setTimeout(() => engine(), 0);
    };
    engine();
  }
}

if (typeof window !== 'undefined') window.GameEngine = GameEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = GameEngine;
