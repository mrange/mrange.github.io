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
  constructor(mass, x, y, px, py) {
    this.imass= 1/mass;
    this.x    = x;
    this.y    = y;
    this.px   = px;
    this.py   = py;
  }

  verlet() {
    if (this.imass > 0) {
      const x  = this.x;
      const y  = this.y;
      const nx = 2*x - this.px;
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

    const lx    = l.x;
    const ly    = l.y;
    const rx    = r.x;
    const ry    = r.y;

    const dx    = lx - rx;
    const dy    = ly - ry;

    const l2    = dx*dx + dy*dy;
    const l1    = Math.sqrt(l2);

    const ndx   = dx / l1;
    const ndy   = dy / l1;

    const diff  = l1 - this.d;

    if (!this.rope || diff > 0) {
      const dl    = diff*l.imass/(l.imass + r.imass);
      const dr    = diff*r.imass/(l.imass + r.imass);

      l.x         = lx - dl*ndx;
      l.y         = ly - dl*ndy;

      r.x         = rx + dr*ndx;
      r.y         = ry + dr*ndy;
    }
  }

}

class TireConstraint {
  constructor(l, r) {
    this.l    = l;
    this.r    = r;
  }

  relax() {
    const l     = this.l;
    const r     = this.r;

    const lx    = l.x;
    const ly    = l.y;
    const rx    = r.x;
    const ry    = r.y;

    const lpx   = l.px;
    const lpy   = l.py;
    const rpx   = r.px;
    const rpy   = r.py;

    const dx    = lx - rx;
    const dy    = ly - ry;

    const l2    = dx*dx + dy*dy;
    const l1    = Math.sqrt(l2);

    const ndx   = dx / l1;
    const ndy   = dy / l1;

    const lvx   = lx - lpx;
    const lvy   = ly - lpy;

    const rvx   = rx - rpx;
    const rvy   = ry - rpy;

    const lv    = lvx*ndx + lvy*ndy;
    const rv    = rvx*ndx + rvy*ndy;

    l.x         = lv*ndx + lpx;
    l.y         = lv*ndy + lpy;

    r.x         = rv*ndx + rpx;
    r.y         = rv*ndy + rpy;
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


    for (let i = 0; i < lps; ++i) {
      const p = ps[i];
      const im= p.imass;
      if (im > 0) {
        context.fillStyle = "green"
      } else {
        context.fillStyle = "red"
      }
      const x = p.x;
      const y = p.y;
      context.fillRect(x - 5, y - 5, 10, 10);
    }
  }

  drawConstraints() {
    const cs  = this.cs;
    const lcs = cs.length;

    context.beginPath();

    context.strokeStyle = "yellow"
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
    const cx = canvas.width/2;
    const cy = canvas.height/2;
    context.clearRect(-cx, -cy, 2*cx, 2*cy);
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
    this.t  = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.ps = [];
    this.cs = [];
  }

  identity() {
    this.t  = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }

  transform(t) {
    const ct = this.t;
    const nt = [];

    for (let y = 0; y < 3; ++y) {
      for (let x = 0; x < 3; ++x) {
        let r = 0;
        for (let i = 0; i < 3; ++i) {
          // This is inefficient looping for large matrix but a 3x3 fits into l1 cache
          r += t[y*3 + i]*ct[i*3 + x];
        }
        nt.push(r);
      }
    }

    this.t = nt;
  }

  rotate(a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    this.transform([c, s, 0, -s, c, 0, 0, 0, 1]);
  }

  translate(x, y) {
    this.transform([1, 0, x, 0, 1, y, 0, 0, 1]);
  }

  apply(x, y) {
    const ct = this.t;
    return [ct[0]*x + ct[1]*y + ct[2], ct[3]*x + ct[4]*y + ct[5]];
  }

  particle(m, x, y, vx = 0, vy = 0, applyTransform = true) {
    const px  = x - vx*td;
    const py  = y - vy*td;
    if (applyTransform) {
      const pos = this.apply(x, y);
      const ppos= this.apply(px, py);
      const p   = new Particle(m, pos[0], pos[1], ppos[0], ppos[1]);
      this.ps.push(p);
      return p;
    } else {
      const p   = new Particle(m, x, y, px, py);
      this.ps.push(p);
      return p;
    }
  }

  fixPoint(x, y, applyTransform = true) {
    return this.particle(1/0, x, y, 0, 0, applyTransform);
  }

  constraint(l, r, rope = false, slack = 1) {
    const c = new Constraint(rope, slack, l, r);
    this.cs.push(c);
    return c;
  }

  stick(l, r) {
    return this.constraint(l, r);
  }

  rope(l, r, slack = 1) {
    return this.constraint(l, r, true, slack);
  }

  chain(l, r, m, chains, slack = 1, rope = true, vx = 0, vy = 0) {
    const cs = chains < 1 ? 1 : chains;
    const cm = m / (cs - 1);
    const l1 = Particle.l1(l, r);
    const s   = l1 / cs;
    const sx  = (r.x - l.x)*s/l1;
    const sy  = (r.y - l.y)*s/l1;

    let c     = l;

    for (let i = 1; i < chains; ++i) {
      const nx  = c.x + sx;
      const ny  = c.y + sy;
      const n   = this.particle(cm, nx, ny, vx, vy, false);
      this.constraint(c, n, rope, slack);
      c = n;
    }

    this.constraint(c, r, rope, slack);
  }

  box(m, cx, cy, w, h, vx = 0, vy = 0) {
    const cm  = m / 4;
    const p00 = this.particle(cm, cx - w/2, cy - h/2, vx, vy);
    const p01 = this.particle(cm, cx - w/2, cy + h/2, vx, vy);
    const p10 = this.particle(cm, cx + w/2, cy - h/2, vx, vy);
    const p11 = this.particle(cm, cx + w/2, cy + h/2, vx, vy);
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
  context.translate(width/2, height/2);
  const b = new ParticleSystemBuilder();

  b.rotate(3.1415/6);
  b.translate(0, -height/2 + 5);

  const fp   = b.fixPoint(0, 0);
  const box0 = b.box(40, 0, 150, 100, 100);
  const box1 = b.box(20, 200, 150, 75, 75);
  const box2 = b.box(10, 400, 150, 50, 50);
  const box3 = b.box(5 , 500, 150, 25, 25);
  b.chain(fp, box0[0], 1, 5, 1);
  b.chain(box0[3], box1[0], 1, 4, 1);
  b.chain(box1[3], box2[0], 1, 3, 1);
  b.chain(box2[3], box3[0], 1, 2, 1);

  ps = b.createParticleSystem();

  setInterval(() => ps.update(2), 20);
}
