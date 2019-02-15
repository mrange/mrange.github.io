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
const gy    = 0.03;

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
  constructor(rope, ratio, l, r) {
    this.rope = rope;
    this.d    = ratio*Particle.l1(l, r);
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

const particles = [
  new Particle(1.0/0.0, 150, 50, 0 ,0),

  new Particle(10, 100, 100, 0 ,0),
  new Particle(10, 100, 200, 0 ,0),
  new Particle(10, 200, 200, 0 ,0),
  new Particle(10, 200, 100, 0 ,0),

  new Particle(10, 100, 400, 0 ,0),
  new Particle(10, 100, 500, 0 ,0),
  new Particle(10, 200, 500, 0 ,0),
  new Particle(10, 200, 400, 0 ,0),
];

const constraints = [
  new Constraint(true , 2.0, particles[0], particles[1]),

  new Constraint(false, 1.0, particles[1], particles[2]),
  new Constraint(false, 1.0, particles[2], particles[3]),
  new Constraint(false, 1.0, particles[3], particles[4]),
  new Constraint(false, 1.0, particles[4], particles[1]),
  new Constraint(false, 1.0, particles[1], particles[3]),

  new Constraint(true , 1.0, particles[5], particles[3]),

  new Constraint(false, 1.0, particles[5], particles[6]),
  new Constraint(false, 1.0, particles[6], particles[7]),
  new Constraint(false, 1.0, particles[7], particles[8]),
  new Constraint(false, 1.0, particles[8], particles[5]),
  new Constraint(false, 1.0, particles[5], particles[7]),
]

var canvas  ;
var context ;
var width   ;
var height  ;

function timeStep() {
  for (let i = 0; i < particles.length; ++i) {
    const particle = particles[i];
    particle.verlet();
  }

  for (let r = 0; r < 5; ++r) {
    for (let i = 0; i < constraints.length; ++i) {
      const constraint = constraints[i];
      const l = constraint.relax();
    }
  }
}

function drawParticles() {
  context.fillStyle = "green"
  for (let i = 0; i < particles.length; ++i) {
    const particle = particles[i];
    const x = particle.x;
    const y = particle.y;
    context.fillRect(x - 5, y - 5, 10, 10);
  }
}

function drawConstraints() {
  context.strokeStyle = "yellow"
  context.beginPath();
  for (let i = 0; i < constraints.length; ++i) {
    const constraint = constraints[i];
    const l = constraint.l;
    const r = constraint.r;
    context.moveTo(l.x, l.y);
    context.lineTo(r.x, r.y);
  }
  context.stroke();
}

function clear() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function update() {
  timeStep();
  clear();
  drawConstraints();
  drawParticles();
}

function start() {
  canvas  = document.getElementById("canvas");
  width   = canvas.width;
  height  = canvas.height;
  context = canvas.getContext("2d");
  setInterval(update, 20);
}
