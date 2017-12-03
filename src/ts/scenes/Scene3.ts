import Scene from "../../tsx/scene";
import { Entity } from 'app/ts/entity';
import { degToRad, radToDeg, isPowerOf2 } from 'app/ts/math';
import { mat4, vec4, vec3 } from 'gl-matrix';
import { Mesh, MeshType, VertexLength } from 'app/ts/mesh';

let window = require('window');
window.mat4 = mat4;

let document = window.document;

export default class Scene3 extends Scene {
  gl;

  lastFrame: number = new Date().getTime();
  delta: number;
  vertShader: string = require('app/glsl/vertex/scene_3.glsl');
  fragShader: string = require('app/glsl/fragment/scene_3.glsl');
  shaderProgram;

  programData: any;
  projectionMatrix: mat4;
  modelViewMatrix: mat4;

  assets = {
    wall: require('static/images/wall.jpg')
  };

  appState = {
    fieldOfView: 45 * Math.PI / 180,
    aspect: 1.77,
    zNear: 0.1,
    zFar: 100.0,
    camX: 0,
    camY: 0,
    camZ: 0
  };

  paneConfig = {
    fieldOfView: {
      min: 0,
      max: 3
    },
    aspect: {
      min: 0,
      max: 2
    },
    zNear: {
      min: 0,
      max: 10,
      step: .01
    },
    zFar: {
      min: 0,
      max: 10,
      step: .01
    }
  };

  constructor () {
    super ();
  }

  /**
   * Sets up the scene data | Self executing.
   */
  setup ( canvasID: string ) {
    this.gl = document.getElementById( canvasID ).getContext('webgl');
    let gl = this.gl;

    this.shaderProgram = this.compileShaders();
    this.programData = {
      position: {
        location: gl.getAttribLocation(this.shaderProgram, 'aVertexPosition'),
        buffer: gl.createBuffer()
      },
      color: {
        location: gl.getAttribLocation(this.shaderProgram, 'aVertexColor'),
        buffer: gl.createBuffer()
      },
      projectionMatrix: {
        location: gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix')
      },
      modelViewMatrix: {
        location: gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix')
      },
      indices: {
        // Used to pass index information to gl when using draw elements
        buffer: gl.createBuffer()
      }
    };

    const faceColors = [
      [1.0,  1.0,  1.0,  1.0],    // Front face: white
      [1.0,  0.0,  0.0,  1.0],    // Back face: red
      [0.0,  1.0,  0.0,  1.0],    // Top face: green
      [0.0,  0.0,  1.0,  1.0],    // Bottom face: blue
      [1.0,  1.0,  0.0,  1.0],    // Right face: yellow
      [1.0,  0.0,  1.0,  1.0],    // Left face: purple
    ];

    //  Build the colors for each vertex on the cube
    let colors = [];
    for (let j = 0; j < faceColors.length; j++) {
      const c = faceColors[j];
      // Repeat each color four times for the four vertices of the face
      colors = colors.concat(c, c, c, c);
    }

    const positions = [
      // Front face
      -1.0, -1.0,  1.0,
      1.0, -1.0,  1.0,
      1.0,  1.0,  1.0,
      -1.0,  1.0,  1.0,

      // Back face
      -1.0, -1.0, -1.0,
      -1.0,  1.0, -1.0,
      1.0,  1.0, -1.0,
      1.0, -1.0, -1.0,

      // Top face
      -1.0,  1.0, -1.0,
      -1.0,  1.0,  1.0,
      1.0,  1.0,  1.0,
      1.0,  1.0, -1.0,

      // Bottom face
      -1.0, -1.0, -1.0,
      1.0, -1.0, -1.0,
      1.0, -1.0,  1.0,
      -1.0, -1.0,  1.0,

      // Right face
      1.0, -1.0, -1.0,
      1.0,  1.0, -1.0,
      1.0,  1.0,  1.0,
      1.0, -1.0,  1.0,

      // Left face
      -1.0, -1.0, -1.0,
      -1.0, -1.0,  1.0,
      -1.0,  1.0,  1.0,
      -1.0,  1.0, -1.0,
    ];

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.programData.position.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.programData.color.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);

    const indices = [
      0,  1,  2,      0,  2,  3,    // front
      4,  5,  6,      4,  6,  7,    // back
      8,  9,  10,     8,  10, 11,   // top
      12, 13, 14,     12, 14, 15,   // bottom
      16, 17, 18,     16, 18, 19,   // right
      20, 21, 22,     20, 22, 23,   // left
    ];

    // Now send the element array to GL

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.programData.indices.buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices), gl.STATIC_DRAW);

    this.projectionMatrix = mat4.create();
    this.modelViewMatrix = mat4.create();
    this.render( this.gl );
  }

  render ( gl ) {
    let now = new Date().getTime();
    this.delta = (now - this.lastFrame) / 1000;

    this.updateScene( this.delta );

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // mat4.identity(this.projectionMatrix);


    mat4.perspective(
      this.projectionMatrix,
      this.appState.fieldOfView,
      this.appState.aspect,
      this.appState.zNear,
      this.appState.zFar);

    mat4.translate(
      this.projectionMatrix,     // destination matrix
      this.projectionMatrix,     // matrix to translate
      [
        -this.appState.camX,
        -this.appState.camY,
        this.appState.camZ
      ]
    );  // amount to translate

    {
      // Indicates the number of values in each element in the buffer
      // 3D positions will have 3 components each.
      const numComponents = 3;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.programData.position.buffer);
      gl.vertexAttribPointer(
        this.programData.position.location,
        numComponents,
        type,
        normalize,
        stride,
        offset);
      gl.enableVertexAttribArray(this.programData.position.location);
    }

    {
      const numComponents = 4;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.programData.color.buffer);
      gl.vertexAttribPointer(
        this.programData.color.location,
        numComponents,
        type,
        normalize,
        stride,
        offset);
      gl.enableVertexAttribArray(this.programData.color.location);
    }

    {
      const vertexCount = 36;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }

    gl.useProgram(this.shaderProgram);
    gl.uniformMatrix4fv(
      this.programData.projectionMatrix.location,
      false,
      this.projectionMatrix);

    gl.uniformMatrix4fv(
      this.programData.modelViewMatrix.location,
      false,
      this.modelViewMatrix);

    // Tell WebGL which indices to use to index the vertices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.programData.indices.buffer);

    this.lastFrame = now;
    window.requestAnimationFrame(() => this.render( gl ) );
  }

  updateScene( delta ) {
    mat4.rotate(
      this.modelViewMatrix,
      this.modelViewMatrix,
      Math.PI / 8 * delta,
      [0, 1, 0]
    );

    mat4.rotate(
      this.modelViewMatrix,
      this.modelViewMatrix,
      Math.PI / 8 * delta,
      [1, 0, 0]
    )
  }

  /**
   * Uses the vertex and fragment shaders to create a shader program.
   */
  compileShaders() {
    let vShader = this.createShader(this.gl.VERTEX_SHADER, this.vertShader);
    let fShader = this.createShader(this.gl.FRAGMENT_SHADER, this.fragShader);
    let program = this.gl.createProgram();
    this.gl.attachShader(program, vShader);
    this.gl.attachShader(program, fShader);
    this.gl.linkProgram(program);
    let success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
    if (success) {
      return program;
    }

    console.log(this.gl.getProgramInfoLog(program));
    this.gl.deleteProgram(program);
  }


  /**
   * Returns a webGL shader for the provided source and parameters.
   *
   * @param type the type of the shader (this.gl.X_SHADER)
   * @param source GLSL shader source
   * @returns {*}
   */
  createShader(type: string, source: string) {
    let shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    let success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
    if (success) {
      return shader;
    }

    // Used to hold error states.
    console.log(this.gl.getShaderInfoLog(shader));
    this.gl.deleteShader(shader);
  }
}