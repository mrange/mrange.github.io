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

function createTextImage(...texts) {
  const image = document.getElementById("offscreen-canvas");
  const ctx   = image.getContext("2d");

  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "white";
  ctx.font = "100px Josefin Slab";
  ctx.textAlign = "center";
  for (const key in texts) {
    const [w, h, text] = texts[key];
    ctx.fillText(text, w*ctx.canvas.width, h*ctx.canvas.height);
  }
  ctx.restore();

  return image;
}


class DemoSystemV1 {
  now() {
    return (new Date).getTime();
  }

  sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  constructor(analyze_audio = false) {
    this.analyze_audio            = analyze_audio          ;
    this.fft_size                 = 512                    ;
    this.initialized              = false                  ;
    this.playing                  = false                  ;
    this.never_played             = true                   ;
    this.start_time               = this.now()             ;
    this.on_requestAnimationFrame = () => this.draw_scene();
  }

  create_bins_texture(bytes) {
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, bytes.length, 1, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, bytes);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    return texture;
  }

  create_texture_from_image(image, override) {
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_NEAREST);
    if (override) {
      override(this.gl);
    }
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    return texture;
  }

  async run_demo() {
    this.audio                  = document.getElementById("music");
    this.audio.onplay           = () => this.play();
    this.audio.onplaying        = () => this.update();
    this.audio.onseeked         = () => this.update();
    this.audio.onpause          = () => this.stop();
    this.audio.onended          = () => this.stop();

    if (this.analyze_audio) {
      this.audio_context            = new AudioContext();
      this.audio_source             = this.audio_context.createMediaElementSource(this.audio);
      this.audio_analyzer           = this.audio_context.createAnalyser();
      this.audio_analyzer.fftSize   = this.fft_size;
      this.time_domain_data         = new Uint8Array(this.fft_size);
      this.frequency_data           = new Uint8Array(this.audio_analyzer.frequencyBinCount);

//      this.audio_analyzer.smoothingTimeConstant = 0.0;

      this.audio_source.connect(this.audio_analyzer);
      this.audio_analyzer.connect(this.audio_context.destination);
    }

    this.canvas   = document.getElementById("glcanvas");

    const width   = window.innerWidth;
    const height  = window.innerHeight;

    // TODO:  Make configurable
    // Shader is a bit hungry for FLOPs so limit to 1080 in y res
    const finalHeight = Math.round(height < 1080 ? height : 1080);
    const finalWidth = Math.round((width/height)*finalHeight);
    this.canvas.width  = finalWidth;
    this.canvas.height = finalHeight;

    this.init_webGL(this.canvas);      // Initialize the GL context

    // Only continue if WebGL is available and working
    if (this.gl) {
      if (this.analyze_audio) {
        this.texture_frequency_data   = this.create_bins_texture(this.time_domain_data);
        this.texture_time_domain_data = this.create_bins_texture(this.frequency_data);
      }


      this.gl.clearColor(0.0, 0.0, 0.0, 1.0);       // Clear to black, fully opaque
      this.gl.clearDepth(1.0);                      // Clear everything
      // TODO: We just paint a single quad, depth stuff not needed?
      // this.gl.enable(this.gl.DEPTH_TEST);           // Enable depth testing
      // this.gl.depthFunc(this.gl.LEQUAL);            // Near things obscure far things

      await this.init_shaders();

      this.init_textures();

      this.init_buffers();

      this.initialized = true;

      on_init_complete();

      requestAnimationFrame(this.on_requestAnimationFrame);
    } else {
      alert("Failed to initialize. Maybewebgl 2 is not supported on your browser");
    }
  }

  play() {
    if (this.initialized && !this.playing) {
      if (this.never_played) {
        this.never_played = false;
        on_started();
      }
      this.start_time = this.now() - this.audio.currentTime*1000;
      requestAnimationFrame(this.on_requestAnimationFrame);
      this.playing = true;
    }
  }

  update() {
    if (this.initialized && this.playing) {
      this.start_time = this.now() - this.audio.currentTime*1000;
    }
  }

  stop() {
    if (this.initialized && this.playing) {
      this.playing = false;
    }
  }

  init_webGL() {
    this.gl = null;

    try {
      this.gl = this.canvas.getContext("webgl2");
    }
    catch(e) {
      alert("Unable to initialize WebGL. Your browser may not support it.");
    }

    // If we don't have a GL context, give up now
    if (!this.gl) {
      alert("Unable to initialize WebGL. Your browser may not support it.");
    }
  }

  init_buffers() {
    this.verticesBuffer = this.gl.createBuffer();

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesBuffer);

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
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);

    this.verticesTextureCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesTextureCoordBuffer);

    const textureCoordinates = [
      // Front
      0.0,  0.0,
      1.0,  0.0,
      1.0,  1.0,
      0.0,  1.0,
    ];

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), this.gl.STATIC_DRAW);

    // Build the element array buffer; this specifies the indices
    // into the vertex array for each face's vertices.
    this.verticesIndexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.verticesIndexBuffer);

    // This array defines each face as two triangles, using the
    // indices into the vertex array to specify each triangle's
    // position.
    const vertexIndices = [
      0,  1,  2,
      0,  2,  3,   // front
    ]

    // Now send the element array to GL
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), this.gl.STATIC_DRAW);
  }

  render_bins_texture(texture, data) {
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, data.length, 1, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, data);
  }

  draw_scene() {
    if (!this.playing) return;

    if (this.analyze_audio) {
      this.audio_analyzer.getByteFrequencyData(this.frequency_data);
      this.audio_analyzer.getByteTimeDomainData(this.time_domain_data);

      this.render_bins_texture(this.texture_frequency_data  , this.frequency_data);
      this.render_bins_texture(this.texture_time_domain_data, this.time_domain_data);
    }

    const before = this.now();
    const time  = (before - this.start_time) / 1000.0;

    const scene = on_select_scene(this.gl, time);

    const bcr    = this.canvas.getBoundingClientRect();
    const width  = bcr.width;
    const height = bcr.height;

    this.gl.useProgram(scene.shaderProgram);

    // TODO: We always paint the entire screen, not needed then
    // this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesBuffer);
    this.gl.vertexAttribPointer(scene.vertexPositionAttribute, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesTextureCoordBuffer);
    this.gl.vertexAttribPointer(scene.textureCoordAttribute, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.uniform2f(scene.uniformLocations.resolution, width, height);
    this.gl.uniform1f(scene.uniformLocations.time, time);

    if (this.analyze_audio) {
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture_frequency_data);
      this.gl.uniform1i(scene.uniformLocations.frequency_data, 0);

      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture_time_domain_data);
      this.gl.uniform1i(scene.uniformLocations.time_domain_data, 1);
    }

    on_set_uniforms(this.gl, time, scene);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.verticesIndexBuffer);
    this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(this.on_requestAnimationFrame);
  }

  init_textures() {
    for (const key in all_textures) {
      const texture = all_textures[key];
      if(!texture) continue;
      if(!texture.image) continue;
      const result = texture.image();
      if(!result) continue;

      let image     = undefined;
      let override  = undefined;
      if (Array.isArray(result)) {
        image     = result[0];
        override  = result[1];
      } else {
        image = result;
      }

      texture.texture = this.create_texture_from_image(image, override);
    }
  }

  async init_shaders() {
    for (const key in all_scenes) {
      on_loading_scene(key);

      // To let the UI refresh
      await this.sleep(20);

      const scene = all_scenes[key];
      if (!scene) continue;

      const defines = scene.defines
        ? (scene.defines.map(d => "#define " + d).join("\n"))
        : ""
        ;
      const prelude = "#version 300 es\n" + defines;

      const vertexShader    = this.get_shader(prelude, scene.vs);
      const fragmentShader  = this.get_shader(prelude, scene.fs);

      scene.shaderProgram = this.gl.createProgram();
      this.gl.attachShader(scene.shaderProgram, vertexShader);
      this.gl.attachShader(scene.shaderProgram, fragmentShader);
      this.gl.linkProgram(scene.shaderProgram);

      if (!this.gl.getProgramParameter(scene.shaderProgram, this.gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program: " + key);
      }

      this.gl.useProgram(scene.shaderProgram);
      scene.vertexPositionAttribute = this.gl.getAttribLocation(scene.shaderProgram, "a_position");
      this.gl.enableVertexAttribArray(scene.vertexPositionAttribute);

      scene.textureCoordAttribute = this.gl.getAttribLocation(scene.shaderProgram, "a_texcoord");
      this.gl.enableVertexAttribArray(scene.textureCoordAttribute);

      const uniformLocations = {};
      const uniforms = ["time", "resolution", "frequency_data", "time_domain_data"].concat(global_uniforms).concat(scene.uniforms ? scene.uniforms : []);
      for (const idx in uniforms) {
        const uniform = uniforms[idx];
        if (uniform) {
          uniformLocations[uniform] = this.gl.getUniformLocation(scene.shaderProgram, uniform);
        }
      }
      scene.uniformLocations = uniformLocations;
    }
  }

  get_shader(prelude, id) {
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
      shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
      shader = this.gl.createShader(this.gl.VERTEX_SHADER);
    } else {
      return null;  // Unknown shader type
    }

    this.gl.shaderSource(shader, theSource);

    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      alert("An error occurred compiling the shaders: " + this.gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  }

}

