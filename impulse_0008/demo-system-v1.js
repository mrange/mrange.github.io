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

var audio;
var canvas;
var gl;

var verticesBuffer;
var verticesTextureCoordBuffer;
var verticesIndexBuffer;

function mix(x, y, a) {
  return x*(1.0 - a) + y*a;
}

function clamp(x, minVal, maxVal) {
  return Math.min(Math.max(x, minVal), maxVal);
}

function step(edge, x) {
  return x < edge ? 0.0 : 1.0;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

function now() {
  return (new Date).getTime();
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

let initialized = false;
let playing = false;
let neverPlayed = true;

let startTime = now();

async function run_demo() {
  audio = document.getElementById("music");
  audio.onplay = () => play();
  audio.onplaying = () => update();
  audio.onseeked = () => update();
  audio.onpause = () => stop();
  audio.onended = () => stop();

  canvas = document.getElementById("glcanvas");

  const width = window.innerWidth;
  const height = window.innerHeight;

  // TODO:  Make configurable
  // Shader is a bit hungry for FLOPs so limit to 1080 in y res
  const finalHeight = Math.round(height < 1080 ? height : 1080);
  const finalWidth = Math.round((width/height)*finalHeight);
  canvas.width  = finalWidth;
  canvas.height = finalHeight;

  init_webGL(canvas);      // Initialize the GL context

  // Only continue if WebGL is available and working

  if (gl) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    // Initialize the shaders; this is where all the lighting for the
    // vertices and so forth is established.

    await init_shaders();

    // Here's where we call the routine that builds all the objects
    // we'll be drawing.

    init_buffers();

    initialized = true;

    on_init_complete();

    audio.style.visibility = "visible";

    requestAnimationFrame(draw_scene);
  } else {
    alert("Failed to initialize. Maybewebgl 2 is not supported on your browser");
  }
}

function play() {
  if (initialized&&!playing) {
    if (neverPlayed) {
      neverPlayed = false;
      on_started();
    }
    startTime = now() - audio.currentTime*1000;
    requestAnimationFrame(draw_scene);
    playing = true;
  }
}

function update() {
  if (initialized&&playing) {
    startTime = now() - audio.currentTime*1000;
  }
}

function stop() {
  if (initialized&&playing) {
    playing = false;
  }
}

function init_webGL() {
  gl = null;

  try {
    gl = canvas.getContext("webgl2");
  }
  catch(e) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }

  // If we don't have a GL context, give up now

  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
}

//
// initBuffers
//
function init_buffers() {

  verticesBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);

  const vertices = [
    // Front face
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,
  ];

  // Now pass the list of vertices into WebGL to build the shape. We
  // do this by creating a Float32Array from the JavaScript array,
  // then use it to fill the current vertex buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  verticesTextureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, verticesTextureCoordBuffer);

  const textureCoordinates = [
    // Front
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertices.

  verticesIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, verticesIndexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  const vertexIndices = [
    0,  1,  2,      0,  2,  3    // front
  ]

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(vertexIndices), gl.STATIC_DRAW);
}

function draw_scene() {
  if (!playing) return;

  const before = now();
  const time  = (before - startTime) / 1000.0;

  const scene = on_select_scene(gl, time);

  const bcr    = canvas.getBoundingClientRect();
  const width  = bcr.width;
  const height = bcr.height;

  gl.useProgram(scene.shaderProgram);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
  gl.vertexAttribPointer(scene.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, verticesTextureCoordBuffer);
  gl.vertexAttribPointer(scene.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(scene.uniformLocations.resolution, width, height);
  gl.uniform1f(scene.uniformLocations.time, time);

  on_set_uniforms(gl, time, scene);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, verticesIndexBuffer);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  requestAnimationFrame(draw_scene);
}

async function init_shaders() {
  for (const key in allScenes) {
    on_loading_scene(key);

    // To let the UI refresh
    await sleep(20);

    const scene = allScenes[key];
    if (!scene) continue;

    const defines = scene.defines
      ? (scene.defines.map(d => "#define " + d).join("\n"))
      : ""
      ;
    const prelude = "#version 300 es\n" + defines;

    const vertexShader    = get_shader(gl, prelude, scene.vs);
    const fragmentShader  = get_shader(gl, prelude, scene.fs);

    scene.shaderProgram = gl.createProgram();
    gl.attachShader(scene.shaderProgram, vertexShader);
    gl.attachShader(scene.shaderProgram, fragmentShader);
    gl.linkProgram(scene.shaderProgram);

    if (!gl.getProgramParameter(scene.shaderProgram, gl.LINK_STATUS)) {
      alert("Unable to initialize the shader program: " + key);
    }

    gl.useProgram(scene.shaderProgram);
    scene.vertexPositionAttribute = gl.getAttribLocation(scene.shaderProgram, "a_position");
    gl.enableVertexAttribArray(scene.vertexPositionAttribute);

    scene.textureCoordAttribute = gl.getAttribLocation(scene.shaderProgram, "a_texcoord");
    gl.enableVertexAttribArray(scene.textureCoordAttribute);

    const uniformLocations = {};
    const uniforms = ["time", "resolution"].concat(globalUniforms).concat(scene.uniforms ? scene.uniforms : []);
    for (const idx in uniforms) {
      const uniform = uniforms[idx];
      if (uniform) {
        uniformLocations[uniform] = gl.getUniformLocation(scene.shaderProgram, uniform);
      }
    }
    scene.uniformLocations = uniformLocations;
  }
}

function get_shader(gl, prelude, id) {
  const shaderScript = document.getElementById(id);

  if (!shaderScript) {
    return null;
  }

  var theSource    = prelude;
  var currentChild = shaderScript.firstChild;

  while(currentChild) {
    if (currentChild.nodeType == 3) {
      theSource += currentChild.textContent;
    }

    currentChild = currentChild.nextSibling;
  }

  var shader;

  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;  // Unknown shader type
  }

  gl.shaderSource(shader, theSource);

  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}


