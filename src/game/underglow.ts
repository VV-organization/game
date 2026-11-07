import * as THREE from 'three';
import { underglowDesigns } from '../shared/underglow-designs';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Analytic line distances produce a bright tube plus two soft falloffs. The whole
// effect is one ground plane / draw call; animation changes one uniform only.
const fragmentShader = `
precision highp float;
uniform float time;
uniform int style;
uniform vec3 primary;
uniform vec3 secondary;
varying vec2 vUv;
const float PI = 3.14159265359;
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 d = b-a;
  return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));
}
float ellipse(vec2 p, vec2 r) { return abs(length(p/r)-1.0)*min(r.x,r.y); }
float boxRing(vec2 p, vec2 r) { return abs(max(abs(p.x)/r.x,abs(p.y)/r.y)-1.0)*min(r.x,r.y); }
vec2 rotate(vec2 p, float a) { return mat2(cos(a),-sin(a),sin(a),cos(a))*p; }
float tube(float d) { return exp(-d*125.0)*0.9 + exp(-d*32.0)*0.48 + exp(-d*10.0)*0.10; }
void main() {
  vec2 p = (vUv-0.5)*2.0;
  vec2 q = p;
  float a = 10.0;
  float b = 10.0;
  float pulse = 0.88 + 0.12*sin(time*2.4);
  if (style == 1) {
    // Chamfered double perimeter, with four bright ignition corners.
    float outline = max(max(abs(p.x)-0.74,abs(p.y)-0.76),(abs(p.x)+abs(p.y)-1.35)*0.707);
    a = abs(outline);
    b = min(abs(outline+0.09),length(abs(p)-vec2(0.68,0.69))-0.04);
  } else if (style == 2) {
    a = segment(abs(p),vec2(0.73,0.0),vec2(0.73,0.75));
    for(int i=0;i<5;i++) {
      float y=0.38+float(i)*0.09;
      float w=sqrt(max(0.0,0.44-(y-0.32)*(y-0.32)));
      b=min(b,segment(p,vec2(-w,y),vec2(w,y)));
    }
  } else if (style == 3) {
    for(int i=0;i<5;i++) {
      float y=-0.58+float(i)*0.29;
      float d=segment(vec2(abs(p.x),p.y),vec2(0.0,y-0.17),vec2(0.74,y+0.14));
      if(i==0 || i==4) b=min(b,d); else a=min(a,d);
    }
    pulse=0.84+0.16*sin(time*3.0-p.y*8.0);
  } else if (style == 4) {
    q=rotate(p,0.08*sin(time*0.4));
    float h=max(abs(q.x)*0.866+abs(q.y)*0.5,abs(q.y));
    a=min(abs(h-0.76),abs(h-0.43));
    b=abs(h-0.63);
  } else if (style == 5) {
    a=min(ellipse(p,vec2(0.78,0.82)),ellipse(p,vec2(0.58,0.61)));
    b=ellipse(p,vec2(0.36,0.39));
    for(int i=0;i<8;i++) {
      float t=float(i)*PI/4.0+time*0.22;
      b=min(b,abs(length(p-vec2(cos(t)*0.77,sin(t)*0.81))-0.025));
    }
  } else if (style == 6) {
    float angle=atan(p.y,p.x);
    float flower=0.62+0.18*cos(angle*5.0+0.1*sin(time));
    a=abs(length(p)-flower);
    b=min(abs(length(p)-flower*0.75),abs(length(p)-0.20));
  } else if (style == 7) {
    a=ellipse(p,vec2(0.68,0.76));
    for(int i=0;i<14;i++) {
      float t=float(i)*PI/7.0;
      b=min(b,abs(length(p-vec2(cos(t)*0.75,sin(t)*0.82))-0.047));
    }
  } else if (style == 8) {
    float angle=atan(p.y,p.x);
    a=ellipse(p,vec2(0.79,0.82)) + (sin(angle*2.0+0.4)>0.45 ? 0.3:0.0);
    b=ellipse(rotate(p,0.28),vec2(0.61,0.70)) + (sin(angle*2.0-0.5)<-0.2 ? 0.3:0.0);
  } else if (style == 9) {
    for(int i=0;i<6;i++) {
      float y=-0.78+float(i)*0.26;
      float x=mod(float(i),2.0)<0.5?0.70:0.42;
      a=min(a,segment(vec2(abs(p.x),p.y),vec2(x,y),vec2(1.12-x,y+0.26)));
      b=min(b,segment(p,vec2(-0.28,y),vec2(0.28,y)));
    }
  } else if (style == 10) {
    a=min(ellipse(rotate(p,0.64),vec2(0.80,0.37)),ellipse(rotate(p,-0.64),vec2(0.80,0.37)));
    b=ellipse(p,vec2(0.37,0.84));
    b=min(b,min(segment(p,vec2(-0.13,0.0),vec2(0.13,0.0)),segment(p,vec2(0.0,-0.18),vec2(0.0,0.18))));
  } else if (style == 11) {
    q=vec2(abs(p.x),p.y);
    a=min(segment(q,vec2(0.72,-0.78),vec2(0.72,0.18)),segment(q,vec2(0.72,0.18),vec2(0.42,0.48)));
    a=min(a,segment(q,vec2(0.42,0.48),vec2(0.42,0.78)));
    b=min(segment(q,vec2(0.45,-0.78),vec2(0.45,-0.18)),segment(q,vec2(0.45,-0.18),vec2(0.22,0.05)));
    b=min(b,abs(length(q-vec2(0.42,0.74))-0.085));
    b=min(b,abs(length(q-vec2(0.22,0.05))-0.08));
  } else if (style == 12) {
    for(int i=0;i<3;i++) {
      float x=-0.51+float(i)*0.51+sin(p.y*5.0-time*1.6+float(i))*0.14;
      float d=abs(p.x-x)*0.78;
      if(i==1) b=min(b,d); else a=min(a,d);
    }
    a=max(a,abs(p.y)-0.8); b=max(b,abs(p.y)-0.8);
  } else if (style == 13) {
    for(int i=0;i<3;i++) {
      float x=-0.51+float(i)*0.51;
      float d=min(segment(p,vec2(x+0.12,-0.79),vec2(x-0.13,-0.12)),segment(p,vec2(x-0.13,-0.12),vec2(x+0.13,-0.21)));
      d=min(d,segment(p,vec2(x+0.13,-0.21),vec2(x-0.10,0.79)));
      if(i==1) b=d; else a=min(a,d);
    }
    pulse=0.78+0.22*pow(max(0.0,sin(time*5.0)),8.0);
  } else if (style == 14) {
    float d=(abs(p.x)+abs(p.y))*0.707;
    a=min(abs(d-0.60),abs(d-0.29)); b=abs(d-0.46);
  } else if (style == 15) {
    q=vec2(abs(p.x),abs(p.y));
    a=ellipse(rotate(q-vec2(0.37,0.38),-0.68),vec2(0.39,0.25));
    b=min(ellipse(rotate(q-vec2(0.30,0.29),-0.68),vec2(0.22,0.13)),segment(p,vec2(0.0,-0.68),vec2(0.0,0.68)));
  } else if (style == 16) {
    q=abs(p);
    for(int i=0;i<5;i++) {
      float y=-0.68+float(i)*0.34;
      a=min(a,segment(vec2(q.x,p.y),vec2(0.72,y),vec2(0.72,y+0.15)));
      b=min(b,segment(p,vec2(-0.18,y),vec2(0.18,y)));
    }
    b=min(b,segment(q,vec2(0.0,0.8),vec2(0.39,0.59)));
  } else if (style == 17) {
    q=p-vec2(0.0,0.66);
    for(int i=0;i<9;i++) {
      float angle=-2.5+float(i)*0.235;
      vec2 dir=vec2(cos(angle),sin(angle));
      a=min(a,segment(q,dir*0.2,dir*1.20));
    }
    b=min(abs(length(q)-0.48),min(abs(length(q)-0.81),abs(length(q)-1.12)));
    b=max(b,p.y-0.62);
  } else if (style == 18) {
    q=vec2(abs(p.x),p.y);
    a=segment(q,vec2(0.43,-0.78),vec2(0.62,0.75));
    for(int i=0;i<5;i++) {
      float y=-0.58+float(i)*0.29;
      float x=0.43+(y+0.78)*0.124;
      b=min(b,segment(q,vec2(x,y),vec2(x+0.25,y-0.17)));
      b=min(b,segment(q,vec2(x,y),vec2(x-0.25,y-0.21)));
    }
  } else if (style == 19) {
    q=abs(p);
    a=min(segment(q,vec2(0.73,0.38),vec2(0.73,0.76)),segment(q,vec2(0.73,0.76),vec2(0.37,0.76)));
    b=segment(q,vec2(0.20,0.55),vec2(0.53,0.55));
    b=min(b,segment(p,vec2(-0.53,sin(time)*0.27),vec2(0.53,sin(time)*0.27)));
  } else {
    q=p-vec2(-0.33,0.0);
    a=abs(length(q)-0.48);
    a=max(a,0.39-length(q-vec2(0.20,0.10)));
    b=min(segment(p,vec2(0.20,-0.68),vec2(0.60,-0.26)),segment(p,vec2(0.60,-0.26),vec2(0.25,0.22)));
    b=min(b,segment(p,vec2(0.25,0.22),vec2(0.63,0.68)));
    for(int i=0;i<4;i++) {
      vec2 c=i==0?vec2(0.20,-0.68):(i==1?vec2(0.60,-0.26):(i==2?vec2(0.25,0.22):vec2(0.63,0.68)));
      a=min(a,length(p-c)-0.025);
    }
  }
  float mainLight=tube(abs(a));
  float accentLight=tube(abs(b));
  float edge=1.0-smoothstep(0.86,1.0,max(abs(p.x),abs(p.y)));
  float intensity=(mainLight+accentLight)*pulse*edge;
  vec3 color=mix(primary,secondary,accentLight/(mainLight+accentLight+0.0001));
  color=mix(color,vec3(1.0),clamp(intensity-0.8,0.0,0.4));
  gl_FragColor=vec4(color,clamp(intensity,0.0,1.0));
}`;

function luminousColor(value: string | undefined, fallback: string) {
  const color = new THREE.Color(value || fallback);
  let maximum = Math.max(color.r, color.g, color.b);
  if (maximum < 0.2) {
    color.set(fallback);
    maximum = Math.max(color.r, color.g, color.b);
  }
  if (maximum < 0.8 && maximum > 0) color.multiplyScalar(0.8 / maximum);
  return color;
}

/** Local-space light footprint, y=0.04. Invalid/missing equipment stays empty.
 * One mesh, no textures/lights; dispose with the owning kart's normal scene cleanup.
 */
export function createUnderglow(
  variant?: number,
  color?: string,
  dimensions: { width: number; length: number } = { width: 3.3, length: 4.1 },
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'kart-underglow';
  const selected = variant === undefined && color ? 1 : variant;
  if (!Number.isInteger(selected) || selected! < 1 || selected! > 20) return group;
  const design = underglowDesigns[selected! - 1];
  const width = Number.isFinite(dimensions.width) ? Math.max(0.5, dimensions.width) : 3.3;
  const length = Number.isFinite(dimensions.length) ? Math.max(0.5, dimensions.length) : 4.1;
  const geometry = new THREE.PlaneGeometry(width, length);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    name: `underglow-${design.pattern}`,
    uniforms: {
      time: { value: 0 },
      style: { value: selected },
      primary: { value: luminousColor(color, design.primary) },
      secondary: { value: new THREE.Color(design.secondary) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `underglow-${design.pattern}`;
  mesh.position.y = 0.04;
  mesh.renderOrder = 1;
  group.userData.variant = selected;
  group.userData.material = material;
  group.add(mesh);
  return group;
}

/** Changes the existing uniform only; safe to call for an unequipped group. */
export function updateUnderglow(group: THREE.Group, time: number): void {
  const material = group.userData.material as THREE.ShaderMaterial | undefined;
  if (material && Number.isFinite(time)) material.uniforms.time.value = time;
}
