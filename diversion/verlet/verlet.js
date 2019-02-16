/*
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const td    = 0.02;
const gy    = 0.10;

class Particle {
  constructor(mass, x, y, vx, vy) {
    this.imass= 1.0/mass  ;
    this.x    = x         ;
    this.y    = y         ;
    this.px   = x - vx*td ;
    this.py   = y - vy*td ;
  }

  verlet() {
    if (this.imass > 0) {
      const x  = this.x;
      const y  = this.y;
      const nx = 2*x - this.px     ;
      const ny = 2*y - this.py + gy;
      this.x  = nx;
      this.y  = ny;
      this.px = x;
      this.py = y;
    }
  }

  static l2(l, r) {
    const dx = l.x - r.x;
    const dy = l.y - r.y;
    return dx*dx + dy*dy;
  }

  static l1(l, r) {
    return Math.sqrt(Particle.l2(l, r));
  }
};

class Constraint {
  constructor(rope, slack, l, r) {
    this.rope = rope;
    this.d    = slack*Particle.l1(l, r);
    this.l    = l;
    this.r    = r;
  }

  relax() {
    const l     = this.l;
    const r     = this.r;

    const dx    = l.x - r.x;
    const dy    = l.y - r.y;
    const l2    = dx*dx + dy*dy;
    const l1    = Math.sqrt(l2);
    const ndx   = dx / l1;
    const ndy   = dy / l1;
    const diff  = l1 - this.d;

    if (!this.rope || diff > 0) {
      const dl    = diff*l.imass/(l.imass + r.imass);
      const dr    = diff*r.imass/(l.imass + r.imass);

      l.x         -= dl*ndx;
      l.y         -= dl*ndy;

      r.x         += dr*ndx;
      r.y         += dr*ndy;
    }
  }

}

class ParticleSystem {
  constructor(ps, cs) {
    this.ps = ps;
    this.cs = cs;
  }

  timeStep(relaxations) {
    const ps  = this.ps;
    const lps = ps.length;

    const cs  = this.cs;
    const lcs = cs.length;

    for (let i = 0; i < lps; ++i) {
      const p = ps[i];
      p.verlet();
    }

    for (let r = 0; r < relaxations; ++r) {
      for (let i = 0; i < lcs; ++i) {
        const c = cs[i];
        c.relax();
      }
    }
  }

  drawParticles() {
    const ps  = this.ps;
    const lps = ps.length;

    context.fillStyle = "green"

    for (let i = 0; i < lps; ++i) {
      const p = ps[i];
      const x = p.x;
      const y = p.y;
      context.fillRect(x - 5, y - 5, 10, 10);
    }
  }

  drawConstraints() {
    const cs  = this.cs;
    const lcs = cs.length;

    context.strokeStyle = "yellow"
    context.beginPath();

    for (let i = 0; i < lcs; ++i) {
      const c = cs[i];
      const l = c.l;
      const r = c.r;
      context.moveTo(l.x, l.y);
      context.lineTo(r.x, r.y);
    }
    context.stroke();
  }

  clear() {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  update(relaxations) {
    this.timeStep(relaxations);
    this.clear();
    this.drawConstraints();
    this.drawParticles();
  }
}

class ParticleSystemBuilder {
  constructor() {
    this.ps = []
    this.cs = []
  }

  particle(m, x, y, vx = 0, vy = 0) {
    const p = new Particle(m, x, y, vx, vy);
    this.ps.push(p);
    return p;
  }

  fixPoint(x, y) {
    return this.particle(1.0/0.0, x, y);
  }

  constraint(l, r, rope = false, slack = 1.0) {
    const c = new Constraint(rope, slack, l, r);
    this.cs.push(c);
    return c;
  }

  stick(l, r) {
    return this.constraint(l, r);
  }

  rope(l, r, slack = 1.0) {
    return this.constraint(l, r, true, slack);
  }

  chain(l, r, m, chains, slack = 1.0, rope = true, vx = 0, vy = 0) {
    const cs = chains < 1.0 ? 1.0 : chains;
    const cm = m / (cs - 1.0);
    const l1 = Particle.l1(l, r);
    const s   = l1 / cs;
    const sx  = (r.x - l.x)*s/l1;
    const sy  = (r.y - l.y)*s/l1;

    let c     = l;

    for (let i = 1; i < chains; ++i) {
      const nx  = c.x + sx;
      const ny  = c.y + sy;
      const n   = this.particle(cm, nx, ny, vx, vy);
      this.constraint(c, n, rope, slack);
      c = n;
    }

    this.constraint(c, r, rope, slack);
  }

  box(m, cx, cy, w, h, vx = 0, vy = 0) {
    const cm  = m / 4.0;
    const p00 = this.particle(cm, cx - w/2.0, cy - h/2.0, vx, vy);
    const p01 = this.particle(cm, cx - w/2.0, cy + h/2.0, vx, vy);
    const p10 = this.particle(cm, cx + w/2.0, cy - h/2.0, vx, vy);
    const p11 = this.particle(cm, cx + w/2.0, cy + h/2.0, vx, vy);
    this.stick(p00, p01);
    this.stick(p00, p10);
    this.stick(p01, p11);
    this.stick(p10, p11);
    this.stick(p00, p11);
    return [p00, p01, p10, p11];
  }

  createParticleSystem() {
    return new ParticleSystem(this.ps, this.cs);
  }
}

var canvas  ;
var context ;
var width   ;
var height  ;

var ps      ;

function start() {
  canvas  = document.getElementById("canvas");
  width   = canvas.width;
  height  = canvas.height;
  context = canvas.getContext("2d");

  const b = new ParticleSystemBuilder();

  const cx   = width/2.0;

  const fp   = b.fixPoint(cx, 0);
  const box0 = b.box(40, cx, 150, 100, 100);
  const box1 = b.box(20, cx + 200, 150, 75, 75);
  const box2 = b.box(10, cx + 400, 150, 50, 50);
  b.chain(fp, box0[0], 1.0, 4.0, 1.5);
  b.chain(box0[3], box1[0], 1.0, 4.0);
  b.chain(box1[3], box2[0], 1.0, 4.0);

  ps = b.createParticleSystem();

  setInterval(() => ps.update(3), 20);
}
