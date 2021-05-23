import * as THREE from "./three.module.js";
import { TWEEN } from "./tween.module.min.js";
import { TrackballControls } from "./TrackballControls.js";
import { CSS3DRenderer, CSS3DSprite } from "./CSS3DRenderer.js";

let camera, scene, renderer;
let controls;

const spriteFile = "./ball.png";
const ballsNr = 512;
var rotSpeed = 100;
var groupRot = 0;
const shapesNr = 8;
const pauseTime = 6;
const morphTime = 2;

const posArray = [];
const objArray = [];
let current = 0;

export function initVectorMorph() {
  var fov = 70;
  camera = new THREE.PerspectiveCamera(
    fov,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  camera.position.set(1500, 500, 1500);
  camera.lookAt(0, 0, 0);
  scene = new THREE.Scene();

  const image = document.createElement("img");
  image.src = spriteFile;
  image.addEventListener("load", function () {
    for (let i = 0; i < ballsNr; i++) {
      const object = new CSS3DSprite(image.cloneNode());
      (object.position.x = Math.random() * 3500),
        (object.position.y = Math.random() * 3500),
        (object.position.z = Math.random() * 3500);
      scene.add(object);
      objArray.push(object);
    }
    transition();
  });

  insertSphere();
  insertSaddle();
  insertRandom();
  insertSpiral();
  insertBowtie2();
  insertCube();
  insertRandom();
  insertBowtie();
  //insertCone();

  renderer = new CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("container").appendChild(renderer.domElement);
  window.addEventListener("resize", onWindowResize);
  controls = new TrackballControls(camera, renderer.domElement);
}

function transition() {
  const duration = 1000 * morphTime;

  // Morph
  var objOffset = current * ballsNr * 3;
  for (let i = 0; i < ballsNr; i++) {
    var tween = new TWEEN.Tween(objArray[i].position)
      .to(
        {
          x: posArray[objOffset],
          y: posArray[objOffset + 1],
          z: posArray[objOffset + 2],
        },
        (Math.random() * duration) / 2 + 2 * duration
      )
      .easing(TWEEN.Easing.Cubic.InOut);
    tween.start();
    objOffset += 3;
  }

  // Delay between shapes
  new TWEEN.Tween(this)
    .to({}, duration * pauseTime)
    .onComplete(transition)
    .start();

  current = (current + 1) % shapesNr;
}

export function animateVectorMorph() {
  TWEEN.update();
  controls.update();

  const time = performance.now();

  // Auto-rotate
  groupRot += 0.0001 * rotSpeed;
  scene.rotation.x = groupRot;
  scene.rotation.z = groupRot;

  // Auto-scale
  const scale = Math.sin(time * 0.002) * 0.2 + 1.5;
  scene.scale.set(scale, scale, scale);

  renderer.render(scene, camera);
}

function insertSphere() {
  const radius = 600;

  for (let i = 0; i < ballsNr; i++) {
    const phi = Math.acos(-1 + (2 * i) / ballsNr);
    const theta = Math.sqrt(ballsNr * Math.PI) * phi;

    posArray.push(
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.cos(phi)
    );
  }
}

function insertBowtie2() {
  const radius = 600;

  for (let i = 0; i < ballsNr; i++) {
    const phi = Math.acos(-1 + (2 * i) / ballsNr);
    const theta = Math.sqrt(ballsNr * Math.PI) * phi;

    posArray.push(
      radius * Math.cos(theta) * Math.cos(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.cos(phi)
    );
  }
}

function insertBowtie() {
  const radius = 600;

  for (let i = 0; i < ballsNr; i++) {
    const phi = Math.acos(-1 + (2 * i) / ballsNr);
    const theta = Math.sqrt(ballsNr * Math.PI) * phi;

    posArray.push(
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.sin(theta) * Math.cos(phi),
      radius * Math.cos(phi)
    );
  }
}

function insertSaddle() {
  const radius = 600;

  for (let i = 0; i < ballsNr; i++) {
    const phi = Math.acos(-1 + (2 * i) / ballsNr);
    const theta = Math.sqrt(ballsNr * Math.PI) * phi;

    posArray.push(
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.cos(theta) * Math.cos(phi),
      radius * Math.cos(phi)
    );
  }
}

function insertSpiral() {
  const radius = 600;

  for (let i = 0; i < ballsNr; i++) {
    const phi = Math.acos(-1 + (2 * i) / ballsNr);
    const theta = Math.sqrt(ballsNr * Math.PI) * phi;

    posArray.push(
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.tan(phi)
    );
  }
}

function insertCube() {
  const amount = 8;
  const separation = 100;
  const offset = ((amount - 1) * separation) / 2;

  for (let i = 0; i < ballsNr; i++) {
    const x = (i % amount) * separation;
    const y = Math.floor((i / amount) % amount) * separation;
    const z = Math.floor(i / (amount * amount)) * separation;
    posArray.push(x - offset, y - offset, z - offset);
  }
}

function insertRandom() {
  for (let i = 0; i < ballsNr; i++) {
    posArray.push(
      Math.random() * 3500 - 2000,
      Math.random() * 3500 - 2000,
      Math.random() * 3500 - 2000
    );
  }
}

// function insertCone() {
// 	const radius = 600;

// 	for (let i = 0; i < ballsNr; i++) {
// 		const phi = Math.acos(-1 + (2 * i) / ballsNr);
// 		const theta = Math.sqrt(ballsNr * Math.PI) * phi;

// 		posArray.push(
// 			radius * Math.cos(theta) * Math.sin(phi),
// 			radius * Math.sin(theta) * Math.sin(phi),
// 			radius * Math.sin(phi)
// 		);
// 	}
// }

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
