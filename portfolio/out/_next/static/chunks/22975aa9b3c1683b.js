(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,74365,e=>{"use strict";var t=e.i(43476),l=e.i(71645);function a(){let e=(0,l.useRef)(null);return(0,l.useEffect)(()=>{let t,l=e.current;if(!l)return;let a=null,r=!1,i=document.createElement("script");return i.src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",i.onload=()=>{if(r)return;let e=window.THREE;e&&function(e){(a=new e.WebGLRenderer({antialias:!0,alpha:!0})).setPixelRatio(Math.min(devicePixelRatio,2)),a.setSize(l.clientWidth,l.clientHeight),a.setClearColor(0,0),l.appendChild(a.domElement);let i=new e.Scene,n=new e.PerspectiveCamera(55,l.clientWidth/l.clientHeight,.1,200);n.position.set(0,11,9),n.lookAt(0,0,-1);let o=new e.OrthographicCamera(-1,1,1,-1,0,1),u=new e.Scene,c={minFilter:e.NearestFilter,magFilter:e.LinearFilter,format:e.RGBAFormat,type:e.FloatType,depthBuffer:!1,stencilBuffer:!1},v=new e.WebGLRenderTarget(1024,1024,c),s=v.clone(),m={uState:{value:null},uTexel:{value:new e.Vector2(9765625e-10,9765625e-10)},uMouse:{value:new e.Vector2(-1,-1)},uImpulse:{value:0}};u.add(new e.Mesh(new e.PlaneGeometry(2,2),new e.ShaderMaterial({uniforms:m,vertexShader:`
              varying vec2 vUv;
              void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
            `,fragmentShader:`
              precision highp float;
              uniform sampler2D uState;
              uniform vec2      uTexel;
              uniform vec2      uMouse;
              uniform float     uImpulse;
              varying vec2 vUv;
              void main() {
                float curr = texture2D(uState, vUv).r;
                float prev = texture2D(uState, vUv).g;
                float n = texture2D(uState, vUv + vec2(0., uTexel.y)).r;
                float s = texture2D(uState, vUv - vec2(0., uTexel.y)).r;
                float e = texture2D(uState, vUv + vec2(uTexel.x, 0.)).r;
                float w = texture2D(uState, vUv - vec2(uTexel.x, 0.)).r;
                float lap  = n + s + e + w - 4.0 * curr;
                float c    = 0.50;
                float next = 2.0 * curr - prev + c * c * lap;
                next *= 0.9955;
                next  = clamp(next, -1., 1.);
                if (uImpulse > 0.001) {
                  float d = length(vUv - uMouse);
                  next -= uImpulse * exp(-d * d * 7000.0);
                  next  = clamp(next, -1., 1.);
                }
                gl_FragColor = vec4(next, curr, 0., 1.);
              }
            `})));let d={uHeightMap:{value:null},uTexel:{value:new e.Vector2(9765625e-10,9765625e-10)},uDispScale:{value:.44}},h=new e.PlaneGeometry(22,22,480,480);h.rotateX(-Math.PI/2),i.add(new e.Mesh(h,new e.ShaderMaterial({uniforms:d,vertexShader:`
              precision highp float;
              uniform sampler2D uHeightMap;
              uniform vec2      uTexel;
              uniform float     uDispScale;
              varying vec2  vUv;
              varying vec3  vNormal;
              varying float vHeight;
              void main() {
                vUv = uv;
                float h  = texture2D(uHeightMap, uv).r;
                float hE = texture2D(uHeightMap, uv + vec2(uTexel.x, 0.)).r;
                float hN = texture2D(uHeightMap, uv + vec2(0., uTexel.y)).r;
                vHeight  = h;
                float scale = uDispScale * 55.0;
                float dX    = (hE - h) * scale;
                float dZ    = (hN - h) * scale;
                vNormal     = normalize(vec3(-dX, 1.0, dZ));
                vec3 pos = position;
                pos.y   += h * uDispScale;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
              }
            `,fragmentShader:`
              precision highp float;
              varying vec2  vUv;
              varying vec3  vNormal;
              varying float vHeight;
              void main() {
                vec3 V = normalize(vec3(0.0, 11.0, 9.0));
                vec3 L = normalize(vec3(0.3,  1.0, 0.5));
                float NdotV  = max(dot(vNormal, vec3(0.,1.,0.)), 0.0);
                float fresnel = pow(1.0 - NdotV, 4.5);
                vec3  H    = normalize(L + V);
                float spec = pow(max(dot(vNormal, H), 0.0), 30.0) * 0.50;
                vec3  L2   = normalize(vec3(-0.4, 0.8, -0.3));
                vec3  H2   = normalize(L2 + V);
                float spec2= pow(max(dot(vNormal, H2), 0.0), 15.0) * 0.18;
                float h      = vHeight;
                float crest  = pow(max(h, 0.0), 1.4) * 1.8;
                float trough = pow(max(-h, 0.0), 1.4) * 0.6;
                vec3 hi  = vec3(0.28, 0.33, 0.37);
                vec3 bright = vec3(0.72, 0.80, 0.85);
                vec3 col = hi * (fresnel * 1.10 + spec * 2.0 + spec2 * 1.6)
                         + mix(hi, bright, crest) * crest
                         - hi * trough;
                vec2 uv2 = vUv - 0.5;
                col *= 1.0 - smoothstep(0.28, 0.70, length(uv2));
                gl_FragColor = vec4(col, 1.0);
              }
            `})));let p=new e.Raycaster,f=new e.Vector2,g=new e.Plane(new e.Vector3(0,1,0),0),x=new e.Vector3,w=0,M=-1,S=new e.Clock;function y(e,t){let a=S.getElapsedTime();if(a-M<.016)return;M=a;let r=l.clientWidth,i=l.clientHeight;if(f.set(e/r*2-1,-(t/i*2)+1),p.setFromCamera(f,n),p.ray.intersectPlane(g,x)){let e=(x.x+11)/22,t=(-x.z+11)/22;e>0&&e<1&&t>0&&t<1&&(m.uMouse.value.set(e,t),w=.35)}}let T=e=>{let t=l.getBoundingClientRect();y(e.clientX-t.left,e.clientY-t.top)},C=e=>{let t=l.getBoundingClientRect();y(e.clientX-t.left,e.clientY-t.top)},H=e=>{let t=l.getBoundingClientRect();y(e.touches[0].clientX-t.left,e.touches[0].clientY-t.top)};l.addEventListener("mousemove",T),l.addEventListener("click",C),l.addEventListener("touchmove",H,{passive:!0});let E=()=>{l&&a&&(n.aspect=l.clientWidth/l.clientHeight,n.updateProjectionMatrix(),a.setSize(l.clientWidth,l.clientHeight),a.setPixelRatio(Math.min(devicePixelRatio,2)))};window.addEventListener("resize",E);let R=1.8;!function e(){if(!r){t=requestAnimationFrame(e);var l=S.getElapsedTime();if(l>R){let e=.15+.7*Math.random(),t=.15+.7*Math.random();m.uMouse.value.set(e,t),w=.45,R=l+2.5+3*Math.random()}for(let e=0;e<4;e++){m.uState.value=v.texture,m.uImpulse.value=0===e?w:0,a.setRenderTarget(s),a.render(u,o),a.setRenderTarget(null);let t=v;v=s,s=t}w*=.55,d.uHeightMap.value=v.texture,a.render(i,n)}}(),l._wCleanup=()=>{cancelAnimationFrame(t),l.removeEventListener("mousemove",T),l.removeEventListener("click",C),l.removeEventListener("touchmove",H),window.removeEventListener("resize",E),a.dispose(),v.dispose(),s.dispose()}}(e)},document.head.appendChild(i),()=>{r=!0,l._wCleanup&&l._wCleanup(),a&&l&&a.domElement.parentNode===l&&l.removeChild(a.domElement),i.parentNode&&i.parentNode.removeChild(i)}},[]),(0,t.jsx)("div",{ref:e,className:"absolute inset-0 w-full h-full",style:{cursor:"crosshair"}})}e.s(["default",()=>a])},81,e=>{e.n(e.i(74365))}]);