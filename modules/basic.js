
/*-------------------------------------*/
export const vertex_shader_source = `
    precision mediump float;
    attribute vec4 a_vertex_position;
    uniform mat4 u_model_view_matrix;
    uniform mat4 u_projection_matrix;
    uniform float u_time;

    void main() {
        gl_Position = u_projection_matrix * u_model_view_matrix * a_vertex_position;
    }
`;

/*-------------------------------------*/
export const fragment_shader_source = `
    void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
`;


/*-------------------------------------*/
export const texture_fragment_shader_source = `
//based on lightbits' tutorial

precision mediump float;

const float PI = 3.141592653589;

varying highp vec2 vTextureCord;
uniform sampler2D u_sampler;
uniform float u_time;

//tests if ray hit object
bool rayMarch(vec3 ray_origin , vec3 ray_dir,
  out int num_iter , out float dist_traveled);

vec3 compNormal(vec3 point);
vec3 lambertLight(vec3 point, vec3 light_pos, vec3 light_color);
float castShadow(vec3 point, vec3 light_pos, float shadow_intensity);
vec3 applyFog( vec3 orig_color, vec3 fog_color, float distance );
vec4 trimap(sampler2D s, vec3 p, vec3 n, float k);
vec3 periodize(vec3 p);

float mapScene(vec3 point); //function that fully describes scene in distance
float sdSphere ( vec3 point, float radius );
float sdPlane (vec3 point, vec4 normal);
float sdBox( vec3 p, vec3 b );

void main () {
  //to generate perspective matrices
  ///*2.0*PI*0.1*u_time)*/
  vec3 cam_eye = vec3(0.0, 0.0, -2.0); //vec3(0, 0, -2);
  vec3 cam_forward = normalize(-cam_eye); //vec3(0, 0, 1);
  vec3 cam_right = normalize(cross(vec3(0, 1, 0), cam_forward)); //vec3(1, 0, 0);
  vec3 cam_up = normalize(cross(cam_forward, cam_right));//vec3(0, 1, 0);
  const float focal_length = 2.0;
  const vec3 sky_color = vec3(0.31, 0.47, 0.67);

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
    color = trimap(u_sampler, periodize(ray_loc), compNormal(ray_loc), 8.0).xyz;
    color = color*color;
    color *= 2.0;
    color = sqrt(color);
    /*
    color = (lambertLight(ray_loc, vec3(mouse_x, sin(u_time*2.0*PI), -2.0), vec3(0.5, 1.0, 1.0)) +
      lambertLight(ray_loc, vec3(0.5, 0.5, 0.5), vec3(1.0, 0.5, 0.5)))/2.0;
      */
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
float sdPlane (vec3 point, vec4 normal) {
  return dot(point, normal.xyz) + normal.w;
}
//function that fully describes the scene in distances
float mapScene(vec3 point) {
  const float radius = 0.5;

  float o1 = sdSphere(point, radius);
  float o2 = sdPlane(point + vec3(0.0, -0.1, 0.0), vec4(0.0, 1.0, 0.0, 1.0));
  return min(o1, o2);
}

vec3 periodize(vec3 p) {
  vec3 a = vec3(0.0, 0.0, 0.0);
  a.x = mod(p.x , 2.0)/2.0;
  a.y = mod(p.y , 2.0)/2.0;
  a.z = mod(p.z , 2.0)/2.0;

  return a;
}

vec4 trimap(sampler2D s, vec3 p, vec3 n, float k) {
  vec4 x = texture2D( s, p.yz );
  vec4 y = texture2D( s, p.zx );
  vec4 z = texture2D( s, p.xy );

  vec3 w = pow( abs(n), vec3(k) ) ;

  return (x*w.x + y*w.y + z*w.z) / (w.x + w.y + w.z);
}
`;

/*-------------------------------------*/

/*-------------------------------------*/
export const sd_fragment_shader = `
//based on lightbits' tutorial

precision mediump float;

const float PI = 3.141592653589;

//uniform vec2 u_resolution;
//uniform vec2 u_mouse_position;
uniform float u_time;

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
  vec3 cam_eye = vec3(sin(2.0*PI*0.1*u_time), 0.0, -2.0); //vec3(0, 0, -2);
  vec3 cam_forward = normalize(-cam_eye);//normalize(-cam_eye); //vec3(0, 0, 1);
  vec3 cam_right = normalize(cross(vec3(0, 1, 0), cam_forward)); //vec3(1, 0, 0);
  vec3 cam_up = normalize(cross(cam_forward, cam_right));//vec3(0, 1, 0);
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
    color = (lambertLight(ray_loc, vec3(mouse_x, sin(u_time*2.0*PI), -2.0), vec3(0.5, 1.0, 1.0)) +
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
    udRoundBox(point + vec3 (cos(2.0*PI*1.0*u_time), 0.3, 0.0), vec3(0.25, 0.25, 0.25), 0.05);
  float o3 = sdPlane(point + vec3(0.0, -0.1, 0.0), vec4(0.0, 1.0, 0.0, 1.0));
  return min(min(o1, o2), o3);;
}
`;



