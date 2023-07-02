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

function vector3(x, y, z) {
  return new Float32Array([
    x,
    y,
    z,
  ]);
}

function subtract_vector3(a, b) {
  return new Float32Array([
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ]);
}

function add_vector3(a, b) {
  return new Float32Array([
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
  ]);
}

function cross_vector3(a, b) {
  return new Float32Array([
    a[1]*b[2]-a[2]*b[1],
    a[2]*b[0]-a[0]*b[2],
    a[0]*b[1]-a[1]*b[0],
  ]);
}

function dot_vector3(a, b) {
  return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
}

function scale_vector3(a, b) {
  return new Float32Array([
    a*b[0],
    a*b[1],
    a*b[2],
  ]);
}

function normalize_vector3(a) {
  const il = 1.0/Math.sqrt(dot_vector3(a, a));
  return scale_vector3(il, a);
}

function print_matrix4(a) {
  let s = "";
  for(let r = 0; r < 4; ++r) {
    for(let c = 0; c < 4; ++c) {
      s += a[c+4*r];
      s += ","
    }
    s += "\n";
  }
  console.log(s);
}

function translate_matrix4(t) {
  return new Float32Array([
    1, 0, 0,t[0],
    0, 1, 0,t[1],
    0, 0, 1,t[2],
    0, 0, 0, 1  ,
  ]);
}

function transpose_matrix4(t) {
  return new Float32Array([
    t[0],t[4],t[8] ,t[12],
    t[1],t[5],t[9] ,t[13],
    t[2],t[6],t[10],t[14],
    t[3],t[7],t[11],t[15],
  ]);
}

function rotate_x_matrix4(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([
    1, 0,0,0,
    0, c,s,0,
    0,-s,c,0,
    0, 0,0,1,
  ]);
}

function rotate_y_matrix4(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([
     c,0,s,0,
     0,1,0,0,
    -s,0,c,0,
     0,0,0,1,
  ]);
}

function rotate_z_matrix4(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([
     c,s,0,0,
    -s,c,0,0,
     0,0,1,0,
     0,0,0,1,
  ]);
}

function multiply_matrix4(a, b) {
  const m = new Float32Array(16);
  for(let c = 0; c < 4; ++c) {
    for(let r = 0; r < 4; ++r) {
      let sum = 0.0;
      for(let i = 0; i < 4; ++i) {
        sum += a[i+4*r]*b[c+4*i];
      }
      m[c+4*r] = sum;
    }
  }
  return m;
}

function look_at_matrix4(eye, look_at, up) {
  const zz = normalize_vector3(subtract_vector3(look_at, eye));
  const xx = normalize_vector3(cross_vector3(zz, up));
  const yy = cross_vector3(xx, zz);
  const a = new Float32Array([
    xx[0],yy[0],-zz[0], 0,
    xx[1],yy[1],-zz[1], 0,
    xx[2],yy[2],-zz[2], 0,
        0,    0,     0, 1,
    ]);
  const b = translate_matrix4(scale_vector3(-1.0, eye));
  const c = transpose_matrix4(b);
  const d = multiply_matrix4(c, a);
  return d;
}

function projection_matrix4(fov, aspect_ratio, near, far) {
  const h = 1.0/Math.tan(fov*0.5);
  const w = h/aspect_ratio;
  const d = far-near;
  const zf = -(far+near)/d;
  const zn = -2.0*far*near/d;
  return new Float32Array([
      w, 0, 0, 0,
      0, h, 0, 0,
      0, 0,zf,-1,
      0, 0,zn, 0,
    ]);
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

    this.default_present_pass    =
      {
        vs_inline: `
precision highp float;

in vec4 a_position;
in vec2 a_texcoord;

out vec2 v_texcoord;

void main(void) {
  gl_Position = a_position;
  v_texcoord  = a_texcoord;
}
`,
        fs_inline: `
precision highp float;

uniform sampler2D prev_pass ;

in vec2 v_texcoord  ;
out vec4 frag_color ;

void main(void) {
  frag_color = texture(prev_pass, v_texcoord);
}
`
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

  is_power_of_2(a) {
    const b = Math.log(a)/Math.log(2.0);
    const c = Math.floor(b);
    const d = Math.abs(b - c);
    return d < 1E-6;
  }

  create_texture_from_image(image, override) {
    const useMipMap = image.width === image.height && this.is_power_of_2(image.width);
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
//    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, useMipMap ? this.gl.LINEAR_MIPMAP_NEAREST : this.gl.LINEAR);
    if (override) {
      override(this.gl);
    }
    if (useMipMap) {
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    return texture;
  }

  create_blank_texture(width, height) {
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
    // TODO: use this.gl.FLOAT instead?
    //  this.EXT_color_buffer_float = this.gl.getExtension('EXT_color_buffer_float');
    //  this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, width, height, 0, this.gl.RGBA, this.gl.FLOAT, null);
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
    this.Width  = Math.round((width/height)*this.Height);
    this.canvas.width  = this.Width;
    this.canvas.height = this.Height;

    this.init_webGL();

    // Only continue if WebGL is available and working
    if (this.gl) {
      this.frame_buffer         = this.gl.createFramebuffer();

      this.depth_buffer         = this.gl.createRenderbuffer();
      this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.depth_buffer);
      this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, this.Width, this.Height);
      this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);

      this.prev_frame_texture   = this.create_blank_texture(this.Width, this.Height);
      this.ping_texture         = this.create_blank_texture(this.Width, this.Height);
      this.pong_texture         = this.create_blank_texture(this.Width, this.Height);

      if (this.analyze_audio) {
        this.texture_time_domain_data = this.create_bins_texture(this.time_domain_data);
        this.texture_frequency_data   = this.create_bins_texture(this.frequency_data);
      }

      this.init_buffers();
      this.init_textures();
      await this.init_scenes();

      this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
      this.gl.clearDepth(1.0);

      this.initialized = true;
      on_init_complete(this.Width,this.Height);

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
      -1.0, -1.0,  0.0,
       1.0, -1.0,  0.0,
      -1.0,  1.0,  0.0,
       1.0,  1.0,  0.0,
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
      0.0,  1.0,
      1.0,  1.0,
    ];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), this.gl.STATIC_DRAW);

    // Quad index buffer
    this.verticesIndexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.verticesIndexBuffer);
    const vertexIndices = [
      0,  1,  2,
      2,  1,  3,
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
      this.audio_analyzer.getByteTimeDomainData(this.time_domain_data);
      this.audio_analyzer.getByteFrequencyData(this.frequency_data);

      this.render_bins_texture(this.texture_time_domain_data, this.time_domain_data);
      this.render_bins_texture(this.texture_frequency_data  , this.frequency_data);
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
      this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, this.depth_buffer);

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

      this.render_pass(time, width, height, render_texture, scene, scene.present_pass);

      // Since passes.length > 0 flip should never be undefined
      if (flip) {
        this.ping_texture = this.prev_frame_texture;
      } else {
        this.pong_texture = this.prev_frame_texture;
      }
      this.prev_frame_texture = render_texture;
    } else {
      this.render_pass(time, width, height, null, scene, scene.present_pass);
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
      this.gl.uniform1i(pass.uniformLocations.prev_frame, 3);
    }

    if(pre_render) {
      pre_render(this.gl, time, scene, pass);
    }

    if (scene.pre_render) {
      scene.pre_render(this.gl, time, scene, pass);
    }

    if (pass.pre_render) {
      pass.pre_render(this.gl, time, scene, pass);
    }

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.verticesIndexBuffer);
    if (pass.instances) {
      this.gl.drawElementsInstanced(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0, pass.instances);
    } else {
      this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
    }
  }

  init_textures() {
    for (const textureKey in all_textures) {
      const texture = all_textures[textureKey];
      if(!texture) continue;
      if(!texture.image) continue;
      const result = texture.image(this.Width, this.Height);
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

      if (!scene.present_pass) {
        scene.present_pass = this.default_present_pass;
      }

      const passes = scene.passes.concat(scene.present_pass);
      for (const passKey in passes) {
        const pass = passes[passKey];
        this.init_pass(sceneKey, passKey, uniforms, prelude, pass)
      }
    }
  }

  init_pass(sceneKey, passKey, uniforms, prelude, pass) {
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
      alert("Unable to initialize the scene: " + sceneKey + "#" + passKey);
    }

    this.gl.useProgram(pass.shaderProgram);
    pass.vertexPositionAttribute = this.gl.getAttribLocation(pass.shaderProgram, "a_position");
    if (pass.vertexPositionAttribute >= 0)
      this.gl.enableVertexAttribArray(pass.vertexPositionAttribute);

    pass.vertexNormalAttribute = this.gl.getAttribLocation(pass.shaderProgram, "a_normal");
    if (pass.vertexNormalAttribute >= 0)
      this.gl.enableVertexAttribArray(pass.vertexNormalAttribute);

    pass.textureCoordAttribute = this.gl.getAttribLocation(pass.shaderProgram, "a_texcoord");
    if (pass.textureCoordAttribute >= 0)
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
    if (pass.vertexPositionAttribute >= 0) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesBuffer);
      this.gl.vertexAttribPointer(pass.vertexPositionAttribute, 3, this.gl.FLOAT, false, 0, 0);
    }
    if (pass.vertexNormalAttribute >= 0) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesNormalBuffer);
      this.gl.vertexAttribPointer(pass.vertexNormalAttribute, 3, this.gl.FLOAT, false, 0, 0);
    }
    if (pass.textureCoordAttribute >= 0) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.verticesTextureCoordBuffer);
      this.gl.vertexAttribPointer(pass.textureCoordAttribute, 2, this.gl.FLOAT, false, 0, 0);
    }
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

