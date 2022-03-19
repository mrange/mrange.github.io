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

class DemoSystemV2 {
  now() {
    return (new Date).getTime();
  }

  sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  constructor(analyze_audio = false) {
    this.frament_shader_type      = "x-shader/x-fragment"  ;
    this.vertex_shader_type       = "x-shader/x-vertex"    ;

    this.analyze_audio            = analyze_audio          ;
    this.fft_size                 = 512                    ;
    this.initialized              = false                  ;
    this.playing                  = false                  ;
    this.never_played             = true                   ;
    this.start_time               = this.now()             ;
    this.on_requestAnimationFrame = () => this.draw_scene();

    this.present_scene            =
      {
        passes: [
          {
            vs_inline: `
precision highp float;

in vec4 a_position;
in vec3 a_normal  ;
in vec2 a_texcoord;

out vec4 v_position;
out vec3 v_normal  ;
out vec2 v_texcoord;

void main(void) {
  gl_Position = a_position;
  v_position  = a_position;
  v_normal    = a_normal  ;
  v_texcoord  = a_texcoord;
}
`,
            fs_inline: `
precision highp float;

uniform sampler2D prev_pass ;

in vec4 v_position  ;
in vec3 v_normal    ;
in vec2 v_texcoord  ;

out vec4 frag_color ;

void main(void) {
  frag_color = texture(prev_pass, v_texcoord);
}
`
          }
        ]
      };
}

  create_bins_texture(bytes) {
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, bytes.length, 1, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, bytes);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
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
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    return texture;
  }

  create_blank_texture(width, height) {
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    // TODO: use this.gl.FLOAT instead
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
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

    this.canvas   = document.getElementById("screen_canvas");

    const width   = window.innerWidth;
    const height  = window.innerHeight;

    // TODO:  Make configurable
    this.Height = Math.round(height < 1080 ? height : 1080);
    this.Width = Math.round((width/height)*this.Height);
    this.canvas.width  = this.Width;
    this.canvas.height = this.Height;

    this.init_webGL(this.canvas);

    // Only continue if WebGL is available and working
    if (this.gl) {
      this.frame_buffer   = this.gl.createFramebuffer();

      this.prev_frame_texture   = this.create_blank_texture(this.Width, this.Height);
      this.ping_texture         = this.create_blank_texture(this.Width, this.Height);
      this.pong_texture         = this.create_blank_texture(this.Width, this.Height);

      if (this.analyze_audio) {
        this.texture_frequency_data   = this.create_bins_texture(this.time_domain_data);
        this.texture_time_domain_data = this.create_bins_texture(this.frequency_data);
      }

      this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
      this.gl.clearDepth(1.0);
      // TODO: We just paint a single quad, depth stuff not needed?
      // this.gl.enable(this.gl.DEPTH_TEST);           // Enable depth testing
      // this.gl.depthFunc(this.gl.LEQUAL);            // Near things obscure far things

      this.init_buffers();
      this.init_textures();
      await this.init_scenes();

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
      if (this.analyze_audio) {
        this.audio_context.resume();
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
      if (this.analyze_audio) {
        this.audio_context.suspend();
      }
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

    if (!this.gl) {
      alert("Unable to initialize WebGL. Your browser may not support it.");
    }
  }

  init_buffers() {
    // Quad vertices
    this.verticesBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesBuffer);
    const vertices = [
      -1.0, -1.0,  1.0,
       1.0, -1.0,  1.0,
       1.0,  1.0,  1.0,
      -1.0,  1.0,  1.0,
    ];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);

    // Quad normals
    this.verticesNormalBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesNormalBuffer);
    const verticesNormal = [
       0.0,  0.0, -1.0,
       0.0,  0.0, -1.0,
       0.0,  0.0, -1.0,
       0.0,  0.0, -1.0,
    ];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(verticesNormal), this.gl.STATIC_DRAW);

    // Quad texture coords
    this.verticesTextureCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesTextureCoordBuffer);
    const textureCoordinates = [
      0.0,  0.0,
      1.0,  0.0,
      1.0,  1.0,
      0.0,  1.0,
    ];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), this.gl.STATIC_DRAW);

    // Quad index buffer
    this.verticesIndexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.verticesIndexBuffer);
    const vertexIndices = [
      0,  1,  2,
      0,  2,  3,
    ]

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

    const passes = scene.passes;
    if (passes.length > 0) {
      const bcr    = this.canvas.getBoundingClientRect();
      const width  = bcr.width;
      const height = bcr.height;

      this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, this.frame_buffer);

      let prev_texture    = null;
      let render_texture  = null;

      let flip            = undefined;

      for (const passKey in passes) {
        const pass = passes[passKey];
        if (flip === true) {
          prev_texture    = this.ping_texture;
          render_texture  = this.pong_texture;
        } else if (flip === false) {
          prev_texture    = this.pong_texture;
          render_texture  = this.ping_texture;
        } else {
          prev_texture    = null;
          render_texture  = this.ping_texture;
        }
        flip = !flip;

        this.gl.framebufferTexture2D(this.gl.DRAW_FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, render_texture, 0);
        this.render_pass(time, width, height, prev_texture, scene, pass);
      }

      this.gl.framebufferTexture2D(this.gl.DRAW_FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, null, 0);
      this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, null);

      // Copies the render texture to the screen
      this.render_pass(time, width, height, render_texture, this.present_scene, this.present_scene.passes[0]);

      // Since passes.length > 0 flip should never be undefined
      if (flip)
      {
        this.ping_texture = this.prev_frame_texture;
      }
      else
      {
        this.pong_texture = this.prev_frame_texture;
      }
      this.prev_frame_texture = render_texture;
    }

    requestAnimationFrame(this.on_requestAnimationFrame);
  }

  render_pass(time, width, height, prev_pass, scene, pass) {
    this.gl.useProgram(pass.shaderProgram);

    if (pass.requires_clear) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    if (pass.uniformLocations.resolution)
      this.gl.uniform2f(pass.uniformLocations.resolution, width, height);
    if (pass.uniformLocations.time)
      this.gl.uniform1f(pass.uniformLocations.time, time);

    if (pass.uniformLocations.prev_pass) {
      this.gl.activeTexture(this.gl.TEXTURE2);
      this.gl.bindTexture(this.gl.TEXTURE_2D, prev_pass);
      this.gl.uniform1i(pass.uniformLocations.prev_pass, 2);
    }

    if (pass.uniformLocations.prev_frame) {
      this.gl.activeTexture(this.gl.TEXTURE3);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.prev_frame_texture);
      this.gl.uniform1i(pass.uniformLocations.prev_frame, 2);
    }

    if (scene.set_uniforms) {
      scene.set_uniforms(this.gl, time, scene, pass);
    }

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.verticesIndexBuffer);
    this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
  }

  init_textures() {
    for (const textureKey in all_textures) {
      const texture = all_textures[textureKey];
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

  async init_scenes() {
    const scenes = all_scenes;
    scenes.dsv2__present_scene = this.present_scene;
    for (const sceneKey in scenes) {
      on_loading_scene(sceneKey);

      // To let the UI refresh
      await this.sleep(20);

      const scene = scenes[sceneKey];
      if (!scene) continue;

      const uniforms = ["time", "resolution", "prev_frame", "prev_pass", "frequency_data", "time_domain_data"]
        .concat(global_uniforms)
        .concat(scene.uniforms ? scene.uniforms : [])
        ;

      const defines = scene.defines
        ? (scene.defines.map(d => "#define " + d).join("\n"))
        : ""
        ;
      const prelude = "#version 300 es\n" + defines;

      const passes = scene.passes;
      for (const passKey in passes) {
        const pass = passes[passKey];
        this.init_pass(uniforms, prelude, pass)
      }
    }
  }

  init_pass(uniforms, prelude, pass) {
    const vertexShader    = pass.vs_inline
      ? this.compile_shader(prelude, this.vertex_shader_type, pass.vs_inline)
      : this.get_shader(prelude, pass.vs)
      ;
    const fragmentShader  = pass.fs_inline
      ? this.compile_shader(prelude, this.frament_shader_type, pass.fs_inline)
      : this.get_shader(prelude, pass.fs)
      ;

    if (pass.shaderProgram) {
      // Already been initialized, can happen with shared passes
      return;
    }

    pass.shaderProgram = this.gl.createProgram();
    this.gl.attachShader(pass.shaderProgram, vertexShader);
    this.gl.attachShader(pass.shaderProgram, fragmentShader);
    this.gl.linkProgram(pass.shaderProgram);

    if (!this.gl.getProgramParameter(pass.shaderProgram, this.gl.LINK_STATUS)) {
      alert("Unable to initialize the shader program: " + sceneKey);
    }

    this.gl.useProgram(pass.shaderProgram);
    pass.vertexPositionAttribute = this.gl.getAttribLocation(pass.shaderProgram, "a_position");
    this.gl.enableVertexAttribArray(pass.vertexPositionAttribute);

    pass.vertexNormalAttribute = this.gl.getAttribLocation(pass.shaderProgram, "a_normal");
    this.gl.enableVertexAttribArray(pass.vertexNormalAttribute);

    pass.textureCoordAttribute = this.gl.getAttribLocation(pass.shaderProgram, "a_texcoord");
    this.gl.enableVertexAttribArray(pass.textureCoordAttribute);

    const uniformLocations = {};
    for (const uniformKey in uniforms) {
      const uniform = uniforms[uniformKey];
      if (uniform) {
        uniformLocations[uniform] = this.gl.getUniformLocation(pass.shaderProgram, uniform);
      }
    }
    pass.uniformLocations = uniformLocations;

    // Setup static bindings
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesBuffer);
    this.gl.vertexAttribPointer(pass.vertexPositionAttribute, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesNormalBuffer);
    this.gl.vertexAttribPointer(pass.vertexNormalAttribute, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesTextureCoordBuffer);
    this.gl.vertexAttribPointer(pass.textureCoordAttribute, 2, this.gl.FLOAT, false, 0, 0);

    if (this.analyze_audio && pass.uniformLocations.frequency_data) {
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture_frequency_data);
      this.gl.uniform1i(pass.uniformLocations.frequency_data, 0);
    }

    if (this.analyze_audio && pass.uniformLocations.time_domain_data) {
      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture_time_domain_data);
      this.gl.uniform1i(pass.uniformLocations.time_domain_data, 1);
    }
  }

  compile_shader(prelude, type, source) {
    let shader = null;
    if (type === this.frament_shader_type) {
      shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    } else if (type === this.vertex_shader_type) {
      shader = this.gl.createShader(this.gl.VERTEX_SHADER);
    } else {
      return null;
    }

    this.gl.shaderSource(shader, prelude + source);

    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      alert("An error occurred compiling the shaders: " + this.gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  }

  get_shader(prelude, id) {
    const shaderScript = document.getElementById(id);

    if (!shaderScript) {
      return null;
    }

    var theSource    = "";
    var currentChild = shaderScript.firstChild;

    while(currentChild) {
      if (currentChild.nodeType === 3) {
        theSource += currentChild.textContent;
      }

      currentChild = currentChild.nextSibling;
    }

    return this.compile_shader(prelude, shaderScript.type, theSource);
  }

}

