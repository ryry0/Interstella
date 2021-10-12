
function main() {
    const canvas = document.querySelector("#glCanvas");
    //Initialize the GL context
    const gl = canvas.getContext("webgl");

    //continue if WebGL is available
    if (gl === null) {
        alert("Webgl possibly unsupported");
        return;
    }

    const shader_program = initShaderProgram(gl, vertex_shader_source, sd_fragment_shader);

    //collect all the info needed to use the shader program

    const program_info = {
        program: shader_program,
        attribLocations: {
            vertex_position: gl.getAttribLocation(shader_program, 'a_vertex_position'),
        },
        uniformLocations: {
            projection_matrix: gl.getUniformLocation(shader_program, 'u_projection_matrix'),
            model_view_matrix: gl.getUniformLocation(shader_program, 'u_model_view_matrix'),
        },
    };

    const buffers = initBuffers(gl);

    drawScene(gl, program_info, buffers);
}

function initBuffers(gl) {
    //create buffer for square's positions.
    const position_buffer = gl.createBuffer();

    //select position_buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);

    //array of positions for square
    const positions = [
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0,
    ];

    ///pass to webgl
    gl.bufferData(gl.ARRAY_BUFFER,
                    new Float32Array(positions),
                    gl.STATIC_DRAW);

    return {
        position: position_buffer,
    };
}

function drawScene(gl, program_info, buffers) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0); //clear to black
    gl.clearDepth(1.0); //clear everything
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEWUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const field_of_view = 45.0 * Math.PI / 180.0;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const z_near = 0.1;
    const z_far = 100.0
    const projection_matrix = mat4.create();

    mat4.perspective(projection_matrix,
        field_of_view,
        aspect,
        z_near,
        z_far);

    //set the drawing position to the identity point

    const model_view_matrix = mat4.create();

    //move it
    mat4.translate(model_view_matrix,
        model_view_matrix,
        [-0.0, 0.0, -1.0]);

    //tell webgl ohw to pull out positions from the position buffer into vertex
    //position
    {
        const num_components = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            program_info.attribLocations.vertex_position,
            num_components,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            program_info.attribLocations.vertex_position);
    }

    gl.useProgram(program_info.program);

    //set shader uniforms
    gl.uniformMatrix4fv(
        program_info.uniformLocations.projection_matrix,
        false,
        projection_matrix);
    gl.uniformMatrix4fv(
        program_info.uniformLocations.model_view_matrix,
        false,
        model_view_matrix);
    {
        const offset = 0;
        const vertex_count = 4;
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertex_count);
    }
}



function initShaderProgram(gl, vs_source, fs_source) {
    const vertex_shader = loadShader(gl, gl.VERTEX_SHADER, vs_source);
    const fragment_shader = loadShader(gl, gl.FRAGMENT_SHADER, fs_source);

    //create the shader program
    const shader_program = gl.createProgram();
    gl.attachShader(shader_program, vertex_shader);
    gl.attachShader(shader_program, fragment_shader);
    gl.linkProgram(shader_program);

    if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shader_program));
        return null;
    }

    return shader_program;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    //send source to shader object
    gl.shaderSource(shader, source);

    //compile the shader program

    gl.compileShader(shader);

    //see if compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

const vertex_shader_source = `
    precision mediump float;
    attribute vec4 a_vertex_position;
    uniform mat4 u_model_view_matrix;
    uniform mat4 u_projection_matrix;

    void main() {
        gl_Position = u_projection_matrix * u_model_view_matrix * a_vertex_position;
    }
`;

const fragment_shader_source = `
    void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
`;

const sd_fragment_shader = `
//based on lightbits' tutorial

precision mediump float;
//uniform vec2 u_resolution;
//uniform vec2 u_mouse_position;

//tests if ray hit object
bool rayMarch(vec3 ray_origin , vec3 ray_dir,
  out int num_iter , out float dist_traveled);

vec3 compNormal(vec3 point);
vec3 lambertLight(vec3 point, vec3 light_pos, vec3 light_color);
float castShadow(vec3 point, vec3 light_pos, float shadow_intensity);
vec3 applyFog( vec3 orig_color, vec3 fog_color, float distance );

float mapScene(vec3 point); //function that fully describes scene in distance
float sdSphere ( vec3 point, float radius );
float sdPlane (vec3 point, vec4 normal);
float sdBox( vec3 p, vec3 b );

void main () {
  //to generate perspective matrices
  const vec3 cam_eye = vec3(1.5, 1.0, -2.0); //vec3(0, 0, -2);
  const vec3 cam_forward = normalize(-cam_eye); //vec3(0, 0, 1);
  const vec3 cam_right = normalize(cross(vec3(0, 1, 0), cam_forward)); //vec3(1, 0, 0);
  const vec3 cam_up = normalize(cross(cam_forward, cam_right));//vec3(0, 1, 0);
  const float focal_length = 2.0;
  const vec3 sky_color = vec3(0.31, 0.47, 0.67);

/*
  float u = gl_FragCoord.x * 2.0/min(u_resolution.x, u_resolution.y) - 1.0;
  float v = gl_FragCoord.y * 2.0/min(u_resolution.x, u_resolution.y) - 1.0;
  float mouse_x = u_mouse_position.x*2.0/
    min(u_resolution.x, u_resolution.y) -1.0;
  float mouse_y = -u_mouse_position.y*2.0/
    min(u_resolution.x, u_resolution.y) +1.0;
    */

  float u = gl_FragCoord.x * 2.0/min(1280.0, 720.0) - 1.0;
  float v = gl_FragCoord.y * 2.0/min(1280.0, 720.0) - 1.0;
  float mouse_x = 0.0;
  float mouse_y = 0.0;

  vec3 ray_origin = cam_eye;
  vec3 ray_dir = normalize((cam_forward * focal_length) + cam_right * u + cam_up * v);

  int num_iter; //number of iterations to hit an object
  float dist_traveled; //distance ray has gone to hit object
  bool ray_hit;

  //determine distance and num_iter
  ray_hit = rayMarch(ray_origin, ray_dir, num_iter, dist_traveled);

  vec3 color = sky_color;

  if (ray_hit) {
    vec3 ray_loc = ray_origin + ray_dir*dist_traveled;
    color = (lambertLight(ray_loc, vec3(mouse_x, mouse_y, -2.0), vec3(0.5, 1.0, 1.0)) +
      lambertLight(ray_loc, vec3(0.5, 0.5, 0.5), vec3(1.0, 0.5, 0.5)))/2.0;
  }

  color = applyFog(color, sky_color, dist_traveled);
  gl_FragColor = vec4(color, 1.0);
} //end main

bool rayMarch(vec3 ray_origin
             , vec3 ray_dir
             , out int num_iter
             , out float dist_traveled) {

  const float epsilon = 0.001;
  const float z_far_limit = 30.0;
  const int max_steps = 64;
  bool hit = false;

  dist_traveled = 0.0;

  for(int i = 0; i < max_steps; ++i) {
    float dist_to_object = mapScene(ray_origin + ray_dir*dist_traveled);

    if (dist_to_object < epsilon) {
      hit = true;
      break;
    }
    else if (dist_traveled > z_far_limit) {
      hit = false;
      break;
    }

    dist_traveled+=dist_to_object;
    num_iter = i;
  } //end for

  return hit;
} //end raymarch

//perform numerical differentiation to get the normal vector.
vec3 compNormal(vec3 point) {
  float delta = 0.0001;

  float dx = mapScene(point + vec3(delta, 0.0, 0.0)) - mapScene(point - vec3(delta, 0.0, 0.0));
  float dy = mapScene(point + vec3(0.0, delta, 0.0)) - mapScene(point - vec3(0.0, delta, 0.0));
  float dz = mapScene(point + vec3(0.0, 0.0, delta)) - mapScene(point - vec3(0.0, 0.0, delta));
  return normalize(vec3(dx, dy, dz));
}

vec3 lambertLight(vec3 point, vec3 light_pos, vec3 light_color) {
  const vec3 ambient_light = vec3(0.15, 0.2, 0.32);
  float light_intensity = 0.0;

  float shadow = castShadow(point, light_pos, 16.0);
  if (shadow > 0.0) {
    vec3 normal = compNormal(point);
    vec3 light_dir = normalize(light_pos - point);
    light_intensity = shadow*clamp(dot(normal, light_dir), 0.0, 1.0);
  }

  return light_color*light_intensity + ambient_light*(1.0 - light_intensity);
}

//reverse trace the shadow from the surface to the light
//returns 0.0 if completely in shadow, else returns a higher value clamped @ 1.0.

float castShadow(vec3 point, vec3 light_pos, float shadow_intensity) {
  const float epsilon = 0.001;
  const int max_steps = 50;

  //should not travel farther than source
  float max_dist = length(light_pos - point);

  vec3 ray_dir = normalize(light_pos - point);

  float result = 1.0;
  float dist_traveled = 10.0 * epsilon;

  for (int i = 0; i < max_steps; i++) {
    float dist = mapScene(point + ray_dir*dist_traveled);

    //we hit a surface before we hit light
    if (dist < epsilon) {
      result = 0.0;
      break;
    }

    //calculate penumbra factor using how close we are to an adjacent surface
    result = min(result, shadow_intensity * dist/dist_traveled);
    dist_traveled += dist;

    if (dist_traveled >= max_dist)
       break;

  } //end for
  return result;
}

vec3 applyFog( vec3 orig_color, vec3 fog_color, float distance ) {
  float fog_amount = 1.0 - exp( -distance * 0.2 );
  return mix (orig_color, fog_color, fog_amount);
}

float sdSphere (vec3 point, float radius) {
  return length(point)-radius;
}

float sdBox(vec3 point, vec3 box_dim) {
  vec3 dist = abs(point) - box_dim;
  return min(max(dist.x,max(dist.y,dist.z)),0.0) +
         length(max(dist,0.0));
}

float udRoundBox(vec3 point, vec3 dim, float radius) {
  return length(max(abs(point) - dim, 0.01)) - radius;
}

float sdPlane (vec3 point, vec4 normal) {
  return dot(point, normal.xyz) + normal.w;
}

//function that fully describes the scene in distances
float mapScene(vec3 point) {
  const float radius = 0.5;

  float o1 = sdSphere(point + vec3 (-0.5, 0.2, 0.0), radius);
  float o2 =
    udRoundBox(point + vec3 (0.5, 0.3, 0.0), vec3(0.25, 0.25, 0.25), 0.05);
  float o3 = sdPlane(point + vec3(0.0, -0.1, 0.0), vec4(0.0, 1.0, 0.0, 1.0));
  return min(min(o1, o2), o3);;
}
`;


window.onload = main;
