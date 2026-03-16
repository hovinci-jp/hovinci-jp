"use client";

import { useEffect, useRef } from "react";

// three.js は CDN から実行時にロード
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreeLib = any;

// ─── モバイル専用の波シェーダー ──────────────────────────────────────────────
// WebGLRenderTarget（オフスクリーンバッファ）を一切使わず、
// フラグメントシェーダーだけで波を描画する。
// モバイルブラウザの FloatType/HalfFloatType 非対応問題を根本回避できる。
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
      init(T);
    };
    document.head.appendChild(script);

    function init(T: ThreeLib) {
      try {
        renderer = new T.WebGLRenderer({ antialias: false, alpha: true });
      } catch {
        return;
      }

      // モバイルはピクセル比を 1 に固定してGPU負荷を軽減
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

      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const clock = new T.Clock();

      const uniforms = {
        uTime:       { value: 0.0 },
        uResolution: { value: new T.Vector2(initW, initH) },
        // タッチで起こした波: 最大4点を保持
        uHitUV:  { value: [
          new T.Vector2(-1, -1),
          new T.Vector2(-1, -1),
          new T.Vector2(-1, -1),
          new T.Vector2(-1, -1),
        ]},
        uHitTime: { value: new T.Vector4(-999, -999, -999, -999) },
      };

      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `;

      // mediump 精度でモバイル互換性を確保
      const fragmentShader = `
        precision mediump float;

        uniform float uTime;
        uniform vec2  uResolution;
        uniform vec2  uHitUV[4];
        uniform vec4  uHitTime;

        varying vec2 vUv;

        float rand(vec2 co) {
          return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // 1点からの円形リップル: 低周波・広域減衰でPC版に近い質感
        float ripple(vec2 uv, vec2 center, float startT, float t) {
          float age = t - startT;
          if (age < 0.0 || age > 5.0) return 0.0;
          float dist = length(uv - center);
          // 距離減衰を緩めて波が広く伝わるようにする
          float damp = exp(-age * 0.9) * exp(-dist * 2.2);
          // 周波数を下げて波の幅を広くし、光の縞ではなく波らしく見せる
          return sin((dist - age * 0.18) * 9.0) * damp;
        }

        // 環境波: 低速なうねりをベースにランダムリップルを重ねる
        float ambientWaves(vec2 uv, float t) {
          float h = 0.0;
          // 大きなうねり（振幅をPC版に合わせて抑える）
          h += sin(uv.x * 3.1 + t * 0.32) * cos(uv.y * 2.8 + t * 0.28) * 0.028;
          h += sin(uv.x * 5.4 - t * 0.41 + uv.y * 1.9) * 0.016;
          h += cos(uv.x * 2.1 + uv.y * 4.2 + t * 0.22) * 0.020;

          // ランダム発生リップル（6点）
          for (int i = 0; i < 6; i++) {
            float fi     = float(i);
            float seed   = fi * 137.508;
            float cx     = rand(vec2(seed, 0.1)) * 0.8 + 0.1;
            float cy     = rand(vec2(seed, 0.2)) * 0.8 + 0.1;
            float period = 6.0;
            float offset = rand(vec2(seed, 0.3)) * period;
            float lt     = mod(t + offset, period);
            h += ripple(uv, vec2(cx, cy), 0.0, lt) * 0.32;
          }
          return h;
        }

        // PC版と同じライティング式で水面色を計算
        // epsを大きめにして法線の傾きを強調し、凹凸感を出す
        vec3 waterColor(float h, float hE, float hN) {
          float dX = (hE - h) * 22.0;
          float dZ = (hN - h) * 22.0;
          vec3 normal = normalize(vec3(-dX, 1.0, dZ));

          vec3 V = vec3(0.0, 1.0, 0.0);
          vec3 L = normalize(vec3(0.3, 1.0, 0.5));
          float NdotV  = max(dot(normal, V), 0.0);
          float fresnel = pow(1.0 - NdotV, 4.5);
          vec3 H  = normalize(L + V);
          float spec  = pow(max(dot(normal, H), 0.0), 30.0) * 0.50;
          vec3 L2 = normalize(vec3(-0.4, 0.8, -0.3));
          vec3 H2 = normalize(L2 + V);
          float spec2 = pow(max(dot(normal, H2), 0.0), 15.0) * 0.18;
          float crest  = pow(max( h, 0.0), 1.4) * 1.8;
          float trough = pow(max(-h, 0.0), 1.4) * 0.6;
          // PC版と同じ暗めの水面色（brightを抑えて光りすぎを防ぐ）
          vec3 hi     = vec3(0.08, 0.10, 0.12);
          vec3 bright = vec3(0.28, 0.35, 0.40);
          return hi * (fresnel * 1.10 + spec * 2.0 + spec2 * 1.6)
               + mix(hi, bright, crest) * crest
               - hi * trough;
        }

        void main() {
          float t = uTime;
          // epsを大きめにして法線勾配を可視化しやすくする
          float eps = 3.0 / min(uResolution.x, uResolution.y);

          float h  = ambientWaves(vUv, t);
          float hE = ambientWaves(vUv + vec2(eps, 0.0), t);
          float hN = ambientWaves(vUv + vec2(0.0, eps), t);

          // タッチ波を重ねる
          float hitTimes[4];
          hitTimes[0] = uHitTime.x;
          hitTimes[1] = uHitTime.y;
          hitTimes[2] = uHitTime.z;
          hitTimes[3] = uHitTime.w;
          for (int i = 0; i < 4; i++) {
            float r  = ripple(vUv,                   uHitUV[i], hitTimes[i], t);
            float rE = ripple(vUv + vec2(eps, 0.0),  uHitUV[i], hitTimes[i], t);
            float rN = ripple(vUv + vec2(0.0, eps),  uHitUV[i], hitTimes[i], t);
            h  += r  * 0.6;
            hE += rE * 0.6;
            hN += rN * 0.6;
          }

          gl_FragColor = vec4(waterColor(h, hE, hN), 1.0);
        }
      `;

      scene.add(
        new T.Mesh(
          new T.PlaneGeometry(2, 2),
          new T.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
        )
      );

      // ─── タッチインタラクション ───────────────────────────────────
      let hitIdx = 0;

      function addHit(u: number, v: number) {
        const t = clock.getElapsedTime();
        uniforms.uHitUV.value[hitIdx].set(u, v);
        const arr: [number, number, number, number] = [
          uniforms.uHitTime.value.x,
          uniforms.uHitTime.value.y,
          uniforms.uHitTime.value.z,
          uniforms.uHitTime.value.w,
        ];
        arr[hitIdx] = t;
        uniforms.uHitTime.value.set(...arr);
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

      // ─── リサイズ ────────────────────────────────────────────────
      const onResize = () => {
        if (!mount || !renderer) return;
        const nw = window.innerWidth;
        const nh = window.innerHeight;
        renderer.setSize(nw, nh, false);
        uniforms.uResolution.value.set(nw, nh);
      };
      window.addEventListener("resize", onResize);
      const resizeObserver = new ResizeObserver(() => onResize());
      if (mount!.parentElement) resizeObserver.observe(mount!.parentElement);
      resizeObserver.observe(mount!);

      // ─── アニメーションループ ────────────────────────────────────
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
        resizeObserver.disconnect();
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
