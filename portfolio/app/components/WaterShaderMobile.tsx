"use client";

import { useEffect, useRef } from "react";

// three.js は CDN から実行時にロード
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreeLib = any;

// ─── モバイル専用の波シェーダー ──────────────────────────────────────────────
// 戦略:
//   1. まずPC版と同じping-pong RenderTarget方式を試みる（HalfFloatType使用）
//   2. フレームバッファ完全性チェックで失敗した場合は、
//      シェーダーのみ方式（RenderTarget不使用）にフォールバックする
export default function WaterShaderMobile() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;
    let animId: number;
    let cleanup = false;

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => {
      if (cleanup) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const T: ThreeLib = (window as any).THREE;
      if (!T) return;

      try {
        renderer = new T.WebGLRenderer({ antialias: false, alpha: true });
      } catch {
        return;
      }

      renderer.setPixelRatio(1);
      const initW = window.innerWidth;
      const initH = window.innerHeight;
      renderer.setSize(initW, initH, false);
      renderer.setClearColor(0x000000, 0);

      const canvas = renderer.domElement;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100%";
      mount!.appendChild(canvas);

      // ping-pong方式を試みて失敗したらフォールバック
      const usePingPong = tryPingPong(T);
      if (!usePingPong) {
        initFallback(T);
      }
    };
    document.head.appendChild(script);

    // ── ping-pong RenderTarget方式（PC版と同等） ──────────────────────────
    // 成功したら true、フレームバッファが使えなければ false を返す
    function tryPingPong(T: ThreeLib): boolean {
      const SIM_RES = 512;
      const PLANE_SZ = 22;
      const SUBSTEPS = 4;

      // Three.js経由で拡張を有効化（直接gl.getExtensionではなく必ずこちらを使う）
      const extHalf    = renderer.extensions.get("OES_texture_half_float");
      const extHalfBuf = renderer.extensions.get("EXT_color_buffer_half_float") ||
                         renderer.extensions.get("EXT_color_buffer_float");
      const extFloat   = renderer.extensions.get("OES_texture_float");
      const extFloatBuf= renderer.extensions.get("WEBGL_color_buffer_float") ||
                         renderer.extensions.get("EXT_color_buffer_float");

      let texType: number;
      if (extFloat && extFloatBuf) {
        texType = T.FloatType;
      } else if (extHalf || extHalfBuf) {
        texType = T.HalfFloatType;
      } else {
        // 拡張が取れない場合でもHalfFloatTypeを試みる（iOSはWebGL2で内蔵対応）
        texType = T.HalfFloatType;
      }

      const rtOpts = {
        minFilter: T.NearestFilter,
        magFilter: T.LinearFilter,
        format: T.RGBAFormat,
        type: texType,
        depthBuffer: false,
        stencilBuffer: false,
      };
      let ping = new T.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts);
      let pong = ping.clone();

      // フレームバッファ完全性チェック
      const gl = renderer.getContext();
      renderer.setRenderTarget(ping);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      renderer.setRenderTarget(null);

      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        ping.dispose();
        pong.dispose();
        return false; // フォールバックへ
      }

      // ── シミュレーション（波動方程式） ────────────────────────────
      const simCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const simScene = new T.Scene();
      const simUniforms = {
        uState:   { value: null },
        uTexel:   { value: new T.Vector2(1 / SIM_RES, 1 / SIM_RES) },
        uMouse:   { value: new T.Vector2(-1, -1) },
        uImpulse: { value: 0 },
      };
      simScene.add(new T.Mesh(
        new T.PlaneGeometry(2, 2),
        new T.ShaderMaterial({
          uniforms: simUniforms,
          vertexShader: `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
          `,
          fragmentShader: `
            precision highp float;
            uniform sampler2D uState;
            uniform vec2 uTexel;
            uniform vec2 uMouse;
            uniform float uImpulse;
            varying vec2 vUv;
            void main() {
              float curr = texture2D(uState, vUv).r;
              float prev = texture2D(uState, vUv).g;
              float n = texture2D(uState, vUv + vec2(0., uTexel.y)).r;
              float s = texture2D(uState, vUv - vec2(0., uTexel.y)).r;
              float e = texture2D(uState, vUv + vec2(uTexel.x, 0.)).r;
              float w = texture2D(uState, vUv - vec2(uTexel.x, 0.)).r;
              float lap  = n + s + e + w - 4.0 * curr;
              float next = 2.0 * curr - prev + 0.25 * lap;
              next *= 0.9955;
              next  = clamp(next, -1., 1.);
              if (uImpulse > 0.001) {
                float d = length(vUv - uMouse);
                next -= uImpulse * exp(-d * d * 7000.0);
                next  = clamp(next, -1., 1.);
              }
              gl_FragColor = vec4(next, curr, 0., 1.);
            }
          `,
        })
      ));

      // ── 表示（PC版と同じシェーダー） ─────────────────────────────
      const aspect = window.innerWidth / window.innerHeight;
      const halfW = PLANE_SZ / 2;
      const halfH = halfW / aspect;
      const camera = new T.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 200);
      camera.position.set(0, 50, 0);
      camera.lookAt(0, 0, 0);

      const scene = new T.Scene();
      const dispUniforms = {
        uHeightMap: { value: null },
        uTexel:     { value: new T.Vector2(1 / SIM_RES, 1 / SIM_RES) },
        uDispScale: { value: 0.44 },
      };
      const waterGeo = new T.PlaneGeometry(PLANE_SZ, PLANE_SZ, 240, 240);
      waterGeo.rotateX(-Math.PI / 2);
      scene.add(new T.Mesh(
        waterGeo,
        new T.ShaderMaterial({
          uniforms: dispUniforms,
          vertexShader: `
            precision highp float;
            uniform sampler2D uHeightMap;
            uniform vec2 uTexel;
            uniform float uDispScale;
            varying vec2 vUv;
            varying vec3 vNormal;
            varying float vHeight;
            void main() {
              vUv = uv;
              float h  = texture2D(uHeightMap, uv).r;
              float hE = texture2D(uHeightMap, uv + vec2(uTexel.x, 0.)).r;
              float hN = texture2D(uHeightMap, uv + vec2(0., uTexel.y)).r;
              vHeight = h;
              float scale = uDispScale * 55.0;
              vNormal = normalize(vec3(-(hE - h) * scale, 1.0, (hN - h) * scale));
              vec3 pos = position;
              pos.y += h * uDispScale;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            varying vec2 vUv;
            varying vec3 vNormal;
            varying float vHeight;
            void main() {
              vec3 V = vec3(0.0, 1.0, 0.0);
              vec3 L = normalize(vec3(0.3, 1.0, 0.5));
              float NdotV  = max(dot(vNormal, V), 0.0);
              float fresnel = pow(1.0 - NdotV, 3.5);
              vec3 H  = normalize(L + V);
              float spec  = pow(max(dot(vNormal, H), 0.0), 24.0) * 0.90;
              vec3 L2 = normalize(vec3(-0.4, 0.8, -0.3));
              vec3 H2 = normalize(L2 + V);
              float spec2 = pow(max(dot(vNormal, H2), 0.0), 12.0) * 0.36;
              float crest  = pow(max(vHeight, 0.0), 1.2) * 2.8;
              float trough = pow(max(-vHeight, 0.0), 1.4) * 0.6;
              vec3 hi     = vec3(0.08, 0.10, 0.12);
              vec3 bright = vec3(0.55, 0.65, 0.72);
              vec3 col = hi * (fresnel * 1.60 + spec * 2.8 + spec2 * 2.2)
                       + mix(hi, bright, crest) * crest - hi * trough;
              gl_FragColor = vec4(col, 1.0);
            }
          `,
        })
      ));

      // ── インタラクション ──────────────────────────────────────────
      const raycaster = new T.Raycaster();
      const ndcMouse = new T.Vector2();
      const wPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
      const hitPt = new T.Vector3();
      let impulse = 0;
      let lastSpawnT = -1;
      const clock = new T.Clock();

      function inject(cx: number, cy: number) {
        const t = clock.getElapsedTime();
        if (t - lastSpawnT < 0.016) return;
        lastSpawnT = t;
        ndcMouse.set((cx / mount!.clientWidth) * 2 - 1, -(cy / mount!.clientHeight) * 2 + 1);
        raycaster.setFromCamera(ndcMouse, camera);
        if (raycaster.ray.intersectPlane(wPlane, hitPt)) {
          const u = (hitPt.x + PLANE_SZ / 2) / PLANE_SZ;
          const v = (-hitPt.z + PLANE_SZ / 2) / PLANE_SZ;
          if (u > 0 && u < 1 && v > 0 && v < 1) {
            simUniforms.uMouse.value.set(u, v);
            impulse = 0.35;
          }
        }
      }

      const onTouch = (e: TouchEvent) => {
        const rect = mount!.getBoundingClientRect();
        inject(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
      };
      mount!.addEventListener("touchstart", onTouch, { passive: true });
      mount!.addEventListener("touchmove",  onTouch, { passive: true });

      const onResize = () => {
        if (!renderer) return;
        const nw = window.innerWidth;
        const nh = window.innerHeight;
        const na = nw / nh;
        const hw = PLANE_SZ / 2;
        camera.left = -hw; camera.right = hw;
        camera.top = hw / na; camera.bottom = -hw / na;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh, false);
      };
      window.addEventListener("resize", onResize);
      const ro = new ResizeObserver(() => onResize());
      if (mount!.parentElement) ro.observe(mount!.parentElement);
      ro.observe(mount!);

      let nextAmbient = 1.8;
      function spawnAmbient(t: number) {
        if (t > nextAmbient) {
          simUniforms.uMouse.value.set(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7);
          impulse = 0.45;
          nextAmbient = t + 2.5 + Math.random() * 3.0;
        }
      }

      function animate() {
        if (cleanup) return;
        animId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        spawnAmbient(t);
        for (let i = 0; i < SUBSTEPS; i++) {
          simUniforms.uState.value = ping.texture;
          simUniforms.uImpulse.value = i === 0 ? impulse : 0.0;
          renderer.setRenderTarget(pong);
          renderer.render(simScene, simCam);
          renderer.setRenderTarget(null);
          const tmp = ping; ping = pong; pong = tmp;
        }
        impulse *= 0.55;
        dispUniforms.uHeightMap.value = ping.texture;
        renderer.render(scene, camera);
      }
      animate();
      requestAnimationFrame(onResize);

      (mount as HTMLDivElement & { _wCleanup?: () => void })._wCleanup = () => {
        cancelAnimationFrame(animId);
        mount!.removeEventListener("touchstart", onTouch);
        mount!.removeEventListener("touchmove",  onTouch);
        window.removeEventListener("resize", onResize);
        ro.disconnect();
        renderer.dispose();
        ping.dispose();
        pong.dispose();
      };
      return true;
    }

    // ── フォールバック: シェーダーのみ方式（RenderTarget不使用） ──────────────
    function initFallback(T: ThreeLib) {
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const clock = new T.Clock();

      const uniforms = {
        uTime:       { value: 0.0 },
        uResolution: { value: new T.Vector2(window.innerWidth, window.innerHeight) },
        uHitUV:  { value: [
          new T.Vector2(-1, -1), new T.Vector2(-1, -1),
          new T.Vector2(-1, -1), new T.Vector2(-1, -1),
        ]},
        uHitTime: { value: new T.Vector4(-999, -999, -999, -999) },
      };

      scene.add(new T.Mesh(
        new T.PlaneGeometry(2, 2),
        new T.ShaderMaterial({
          uniforms,
          vertexShader: `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
          `,
          fragmentShader: `
            precision mediump float;
            uniform float uTime;
            uniform vec2  uResolution;
            uniform vec2  uHitUV[4];
            uniform vec4  uHitTime;
            varying vec2 vUv;

            float rand(vec2 co) {
              return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
            }
            float ripple(vec2 uv, vec2 c, float st, float t) {
              float age = t - st;
              if (age < 0.0 || age > 5.0) return 0.0;
              float d = length(uv - c);
              return sin((d - age * 0.18) * 9.0)
                   * exp(-age * 0.9) * exp(-d * 2.2);
            }
            float waves(vec2 uv, float t) {
              float h = 0.0;
              h += sin(uv.x * 3.1 + t * 0.32) * cos(uv.y * 2.8 + t * 0.28) * 0.028;
              h += sin(uv.x * 5.4 - t * 0.41 + uv.y * 1.9) * 0.016;
              h += cos(uv.x * 2.1 + uv.y * 4.2 + t * 0.22) * 0.020;
              for (int i = 0; i < 6; i++) {
                float fi = float(i); float seed = fi * 137.508;
                float cx = rand(vec2(seed, 0.1)) * 0.8 + 0.1;
                float cy = rand(vec2(seed, 0.2)) * 0.8 + 0.1;
                float lt = mod(t + rand(vec2(seed, 0.3)) * 6.0, 6.0);
                h += ripple(uv, vec2(cx, cy), 0.0, lt) * 0.32;
              }
              return h;
            }
            vec3 waterColor(float h, float hE, float hN) {
              vec3 n = normalize(vec3(-(hE - h) * 22.0, 1.0, (hN - h) * 22.0));
              vec3 V = vec3(0.0, 1.0, 0.0);
              vec3 L = normalize(vec3(0.3, 1.0, 0.5));
              float fr = pow(1.0 - max(dot(n, V), 0.0), 3.5);
              vec3 H = normalize(L + V);
              float sp = pow(max(dot(n, H), 0.0), 24.0) * 0.90;
              vec3 L2 = normalize(vec3(-0.4, 0.8, -0.3));
              float sp2 = pow(max(dot(n, normalize(L2 + V)), 0.0), 12.0) * 0.36;
              float crest  = pow(max( h, 0.0), 1.2) * 2.8;
              float trough = pow(max(-h, 0.0), 1.4) * 0.6;
              vec3 hi = vec3(0.08, 0.10, 0.12);
              vec3 br = vec3(0.55, 0.65, 0.72);
              return hi * (fr * 1.60 + sp * 2.8 + sp2 * 2.2)
                   + mix(hi, br, crest) * crest - hi * trough;
            }
            void main() {
              float t = uTime;
              float eps = 3.0 / min(uResolution.x, uResolution.y);
              float h  = waves(vUv, t);
              float hE = waves(vUv + vec2(eps, 0.0), t);
              float hN = waves(vUv + vec2(0.0, eps), t);
              float ht[4];
              ht[0] = uHitTime.x; ht[1] = uHitTime.y;
              ht[2] = uHitTime.z; ht[3] = uHitTime.w;
              for (int i = 0; i < 4; i++) {
                h  += ripple(vUv,                  uHitUV[i], ht[i], t) * 0.6;
                hE += ripple(vUv + vec2(eps, 0.0), uHitUV[i], ht[i], t) * 0.6;
                hN += ripple(vUv + vec2(0.0, eps), uHitUV[i], ht[i], t) * 0.6;
              }
              gl_FragColor = vec4(waterColor(h, hE, hN), 1.0);
            }
          `,
        })
      ));

      let hitIdx = 0;
      function addHit(u: number, v: number) {
        const t = clock.getElapsedTime();
        uniforms.uHitUV.value[hitIdx].set(u, v);
        const a: [number, number, number, number] = [
          uniforms.uHitTime.value.x, uniforms.uHitTime.value.y,
          uniforms.uHitTime.value.z, uniforms.uHitTime.value.w,
        ];
        a[hitIdx] = t;
        uniforms.uHitTime.value.set(...a);
        hitIdx = (hitIdx + 1) % 4;
      }

      const onTouch = (e: TouchEvent) => {
        const rect = mount!.getBoundingClientRect();
        Array.from(e.touches).forEach(touch => {
          addHit(
            (touch.clientX - rect.left) / rect.width,
            1 - (touch.clientY - rect.top) / rect.height
          );
        });
      };
      mount!.addEventListener("touchstart", onTouch, { passive: true });
      mount!.addEventListener("touchmove",  onTouch, { passive: true });

      const onResize = () => {
        if (!renderer) return;
        const nw = window.innerWidth, nh = window.innerHeight;
        renderer.setSize(nw, nh, false);
        uniforms.uResolution.value.set(nw, nh);
      };
      window.addEventListener("resize", onResize);
      const ro = new ResizeObserver(() => onResize());
      if (mount!.parentElement) ro.observe(mount!.parentElement);
      ro.observe(mount!);

      function animate() {
        if (cleanup) return;
        animId = requestAnimationFrame(animate);
        uniforms.uTime.value = clock.getElapsedTime();
        renderer.render(scene, camera);
      }
      animate();
      requestAnimationFrame(onResize);

      (mount as HTMLDivElement & { _wCleanup?: () => void })._wCleanup = () => {
        cancelAnimationFrame(animId);
        mount!.removeEventListener("touchstart", onTouch);
        mount!.removeEventListener("touchmove",  onTouch);
        window.removeEventListener("resize", onResize);
        ro.disconnect();
        renderer.dispose();
      };
    }

    return () => {
      cleanup = true;
      const m = mount as HTMLDivElement & { _wCleanup?: () => void };
      if (m._wCleanup) m._wCleanup();
      if (renderer && mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100%",
        cursor: "default",
      }}
    />
  );
}
