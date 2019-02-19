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
const gy    = 0.00;

function l1(x, y) {
  return Math.sqrt(x*x + y*y);
}

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

  static l1(l, r) {
    return l1(l.x - r.x, l.y - r.y);
  }


  speedUp(ax, ay) {
    if (this.imass > 0) {
      const vx  = (this.x - this.px) / td;
      const vy  = (this.y - this.py) / td;
      const nvx = vx + ax*td;
      const nvy = vy + ay*td;
      this.px   = this.x - nvx*td;
      this.py   = this.y - nvy*td;
    }
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

    const dl1   = l1(dx, dy);

    const ndx   = dx / dl1;
    const ndy   = dy / dl1;

    const diff  = dl1 - this.d;

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
  constructor(l, r, s) {
    this.l    = l;
    this.r    = r;
    this.s    = s;
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

    const dl1   = l1(dx, dy);

    const ndx   = dx / dl1;
    const ndy   = dy / dl1;

    const lvx   = lx - lpx;
    const lvy   = ly - lpy;

    const rvx   = rx - rpx;
    const rvy   = ry - rpy;

    const lv    = lvx*ndx + lvy*ndy;
    const rv    = rvx*ndx + rvy*ndy;

    const lvtx  = lv*ndx;
    const lvty  = lv*ndy;

    const lvnx  = lvx - lvtx;
    const lvny  = lvy - lvty;

    const rvtx  = rv*ndx;
    const rvty  = rv*ndy;

    const rvnx  = rvx - rvtx;
    const rvny  = rvy - rvty;

    const s     = this.s;

    l.x         = s*lvnx + lvtx + lpx;
    l.y         = s*lvny + lvty + lpy;

    r.x         = s*rvnx + rvtx + rpx;
    r.y         = s*rvny + rvty + rpy;
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

  scale(x, y) {
    this.transform([x, 0, 0, 0, y, 0, 0, 0, 1]);
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

  tire(l, r, s) {
    const c = new TireConstraint(l, r, s);
    this.cs.push(c);
    return c;
  }

  chain(l, r, m, chains, slack = 1, rope = true, vx = 0, vy = 0) {
    const cs  = chains < 1 ? 1 : chains;
    const cm  = m / (cs - 1);
    const dl1 = Particle.l1(l, r);
    const s   = dl1 / cs;
    const sx  = (r.x - l.x)*s/dl1;
    const sy  = (r.y - l.y)*s/dl1;

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

  wheels(wm, cm, ws, vx = 0, vy = 0) {
    const co  = 1.0;
    const wo  = 4.0;
    const ww  = wo - co;
    const wh  = 2*co;
    const wc  = Math.sqrt(ww*ww + wh*wh);
    const luw = this.particle(wm/2, -wo, -co, vx, vy);
    const llw = this.particle(wm/2, -wo, +co, vx, vy);
    const ruw = this.particle(wm/2, +wo, -co, vx, vy);
    const rlw = this.particle(wm/2, +wo, +co, vx, vy);
    const luc = this.particle(cm/4, -co, -co, vx, vy);
    const llc = this.particle(cm/4, -co, +co, vx, vy);
    const ruc = this.particle(cm/4, +co, -co, vx, vy);
    const rlc = this.particle(cm/4, +co, +co, vx, vy);

    this.tire(luw, llw, ws);
    this.tire(ruw, rlw, ws);

    this.stick(luw, llw);
    this.stick(ruw, rlw);

    const lus = this.stick(luw, luc);
    const lls = this.stick(llw, llc);
    const lcs = this.stick(llw, luc);
    const rus = this.stick(ruw, ruc);
    const rls = this.stick(rlw, rlc);
    const rcs = this.stick(ruw, rlc);

    const lud = lus.d;
    const lld = lls.d;
    const lcd = lcs.d;
    const rud = rus.d;
    const rld = rls.d;
    const rcd = rcs.d;

    this.stick(luc, ruc);
    this.stick(llc, rlc);
    this.stick(llc, luc);
    this.stick(rlc, ruc);
    this.stick(llc, ruc);

    const wf = a => {
      const c = Math.cos(a);
      const s = Math.sin(a);

      const utx = co*s + wo;
      const uty = -co*c;

      const ucx = co;
      const ucy = -co;

      const udx = utx - ucx;
      const udy = uty - ucy;

      const ul  = Math.sqrt(udx*udx + udy*udy);

      const ltx = -co*s + wo;
      const lty = co*c;

      const lcx = co;
      const lcy = co;

      const ldx = ltx - lcx;
      const ldy = lty - lcy;

      const ll  = Math.sqrt(ldx*ldx + ldy*ldy);

      const cdx = ltx - ucx;
      const cdy = lty - ucy;

      const cl  = Math.sqrt(cdx*cdx + cdy*cdy);

      lus.d = ul*lud/ww;
      lls.d = ll*lld/ww;
      lcs.d = cl*lcd/wc;

      rus.d = ll*rud/ww;
      rls.d = ul*rld/ww;
      rcs.d = cl*rcd/wc;
    }

    const af = a => {
      const ldx = luw.x - llw.x;
      const ldy = luw.y - llw.y;
      const ll1 = l1(ldx, ldy);
      const lndx= ldx / ll1;
      const lndy= ldy / ll1;
      const lax = a*lndx;
      const lay = a*lndy;

      const rdx = ruw.x - rlw.x;
      const rdy = ruw.y - rlw.y;
      const rl1 = l1(rdx, rdy);
      const rndx= rdx / rl1;
      const rndy= rdy / rl1;
      const rax = a*rndx;
      const ray = a*rndy;

      luw.speedUp(lax, lay);
      llw.speedUp(lax, lay);
      ruw.speedUp(rax, ray);
      rlw.speedUp(rax, ray);
    }

    return [llc, rlc, wf, af];
  }

  createParticleSystem() {
    return new ParticleSystem(this.ps, this.cs);
  }
}

function now() {
  return (new Date).getTime();
}

const startTime = now();

const keys = [];
const key_q = "Q".charCodeAt(0);
const key_w = "W".charCodeAt(0);
const key_p = "P".charCodeAt(0);
const key_o = "O".charCodeAt(0);

keys[key_q] = false;
keys[key_w] = false;
keys[key_p] = false;
keys[key_o] = false;

var canvas  ;
var context ;
var width   ;
var height  ;

var ps      ;

let accel   = 0;
let angle   = 0;

function start() {
  window.addEventListener("keydown" , e => keys[e.keyCode] = true);
  window.addEventListener("keyup"   , e => keys[e.keyCode] = false);
  canvas  = document.getElementById("canvas");
  width   = canvas.width;
  height  = canvas.height;
  context = canvas.getContext("2d");
  context.translate(width/2, height/2);
  const b = new ParticleSystemBuilder();

  const origo = b.fixPoint(0, 0);

  b.identity();
  b.translate(0, -6);
  b.scale(5, 5);
  b.rotate(Math.PI/2);

  const uw = b.wheels(10, 40, 0.9);

  b.rotate(Math.PI);
  const lw = b.wheels(10, 20, 0.97);

  b.stick(uw[0], lw[1]);
  b.stick(uw[1], lw[0]);
  b.stick(uw[0], lw[0]);

  const fwf = uw[2];
  const bwf = lw[2];
  const baf = lw[3];

  ps = b.createParticleSystem();

  setInterval(() => {
    if (keys[key_q] && angle < Math.PI/6) {
      angle += 0.02;
    }
    if (keys[key_w] && angle > -Math.PI/6) {
      angle -= 0.02;
    }
    if (!keys[key_q] && !keys[key_w]) {
      if (angle > 0.02) {
        angle -= 0.02;
      } else if (angle < -0.02) {
        angle += 0.02;
      } else
      {
        angle = 0.0;
      }
    }
    if (keys[key_p]) {
      accel += 10;
    }
    if (keys[key_o]) {
      accel -= 10;
    }
    baf(accel);
    fwf(angle);
    ps.update(5);
  }, 20);
}
