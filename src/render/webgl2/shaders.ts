export const solidVS = `#version 300 es
layout(location = 0) in vec2 a_pos;
uniform vec2 u_center;
uniform vec2 u_half;
void main() {
  float nx = (a_pos.x - u_center.x) / u_half.x;
  float ny = (a_pos.y - u_center.y) / u_half.y;
  gl_Position = vec4(nx, -ny, 0.0, 1.0);
}
`;

export const solidFS = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 o;
void main() {
  o = u_color;
}
`;

export const lineVS = `#version 300 es
layout(location = 0) in vec2 a_pos;
uniform vec2 u_center;
uniform vec2 u_half;
void main() {
  float nx = (a_pos.x - u_center.x) / u_half.x;
  float ny = (a_pos.y - u_center.y) / u_half.y;
  gl_Position = vec4(nx, -ny, 0.0, 1.0);
}
`;

export const lineFS = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 o;
void main() {
  o = u_color;
}
`;
