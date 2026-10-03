import { Component, memo, useEffect, useRef, useState, type ReactNode, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as T from 'three';
import { buildBouquet, disposeModel } from './models';
import { AnimatedBouquet, collisionLayout } from './animation';
import { bursts, makeEffects, updateEffects, type Effects } from './effects';
import { total, type BouquetConfigV1 } from './config';

export interface ViewerMetrics { calls: number; triangles: number; fps: number; frames: number; pixelRatio: number; economy: boolean; modelBuilds: number; updateMs: number; updateMaxMs: number; updates: number; contacts: number; transitioning: number; active: number; cachedModels: number; visibleStems: number; }
export interface ViewerHandle { reset: () => void; capture: () => Promise<HTMLCanvasElement>; metrics: () => ViewerMetrics; }
interface Props { config: BouquetConfigV1; motion: boolean; replay: number; onReady: (handle: ViewerHandle | null) => void; onFailure: () => void; }

function Scene({ config, motion, replay, onReady, onFailure }: Props) {
  const { gl, scene, camera, size, invalidate, setDpr } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [design, setDesign] = useState<AnimatedBouquet | null>(null), [effects, setEffects] = useState<Effects | null>(null);
  const configRef = useRef(config), motionRef = useRef(motion), elapsed = useRef(0), hidden = useRef(document.hidden), visible = useRef(true);
  const transition = useRef(false), effectDirty = useRef(true), cameraTween = useRef(false);
  const frameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fps = useRef({ samples: 0, seconds: 0, value: 0, quality: 0 });
  const cameraGoal = useRef(new T.Vector3()), cameraOffset = useRef(new T.Vector3());
  const low = size.width < 500;
  const hasRainbow = config.effects.includes('rainbow'), centerY = hasRainbow ? .65 : .25;
  const frameTarget = useRef(new T.Vector3(0, centerY, 0));
  const radius = (.59 + Math.sqrt(total(config.flowers)) * .11) * config.spread;
  const width = hasRainbow || config.effects.length ? 4.5 : (radius + .46 * config.size + .2) * 2;
  const distance = Math.max(5.8, Math.max(config.effects.length ? 4.8 : 3.7, width * 1.12 / (size.width / size.height)) / (2 * Math.tan(T.MathUtils.degToRad(18))));
  const framing = useRef({ distance, centerY });
  const designKey = JSON.stringify({ flowers: config.flowers, fillers: config.fillers, wrapper: config.wrapper, ribbon: config.ribbon, size: config.size, spread: config.spread, seed: config.seed });
  const effectKey = config.effects.join(',');
  useEffect(() => { configRef.current = config; motionRef.current = motion; framing.current = { distance, centerY }; }, [config, motion, distance, centerY]);
  // GPU objects are created in effects, so StrictMode's discarded render does not leak them.
  useEffect(() => { const engine = new AnimatedBouquet(); setDesign(engine); return () => engine.dispose(); }, []);
  useEffect(() => {
    if (!design) return;
    design.sync(configRef.current, motionRef.current); transition.current = true; invalidate();
  }, [design, designKey, invalidate]);
  useEffect(() => {
    const next = makeEffects(effectKey ? effectKey.split(',') : [], low);
    if (fps.current.quality) next.lowerQuality();
    setEffects(next); effectDirty.current = true; invalidate(); return () => next.dispose();
  }, [effectKey, low, invalidate]);
  useEffect(() => { elapsed.current = motionRef.current ? 0 : 1.25; effectDirty.current = true; invalidate(); }, [replay, effectKey, invalidate]);
  useEffect(() => { effectDirty.current = true; invalidate(); }, [motion, invalidate]);
  useEffect(() => {
    const listener = () => { hidden.current = document.hidden; if (hidden.current) clearTimeout(frameTimer.current); else invalidate(); };
    document.addEventListener('visibilitychange', listener);
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; if (visible.current) invalidate(); });
    observer.observe(gl.domElement);
    return () => { clearTimeout(frameTimer.current); document.removeEventListener('visibilitychange', listener); observer.disconnect(); };
  }, [gl, invalidate]);
  useEffect(() => { const canvas = gl.domElement; const lost = (event: Event) => { event.preventDefault(); onFailure(); }; canvas.addEventListener('webglcontextlost', lost); return () => canvas.removeEventListener('webglcontextlost', lost); }, [gl, onFailure]);
  useEffect(() => {
    frameTarget.current.set(0, centerY, 0);
    const ctrl = controls.current; if (!ctrl) return;
    camera.position.copy(cameraOffset.current.set(.42, .28, 1).normalize().multiplyScalar(framing.current.distance).add(frameTarget.current));
    ctrl.target.copy(frameTarget.current); ctrl.update(); cameraTween.current = false; invalidate();
  }, [camera, size.width, size.height, centerY, invalidate]);
  useEffect(() => {
    if (camera.position.distanceTo(frameTarget.current) + .05 < distance) {
      cameraGoal.current.copy(cameraOffset.current.copy(camera.position).sub(frameTarget.current).normalize().multiplyScalar(distance).add(frameTarget.current));
      cameraTween.current = true; invalidate();
    }
  }, [distance, camera, invalidate]);
  useFrame((_, rawDelta) => {
    if (hidden.current || !visible.current) return;
    const delta = Math.min(rawDelta, .08), live = motion && !!design?.stems.length;
    if (motion) elapsed.current += delta;
    if (design && (live || transition.current)) transition.current = design.step(elapsed.current, delta, motion);
    if (effects && (motion || effectDirty.current)) { updateEffects(effects.entries, elapsed.current, !motion); effectDirty.current = false; }
    if (cameraTween.current) {
      camera.position.lerp(cameraGoal.current, 1 - Math.exp(-8 * delta));
      camera.lookAt(frameTarget.current);
      if (camera.position.distanceToSquared(cameraGoal.current) < .0001) cameraTween.current = false;
    }
    const liveEffects = motion && effects?.entries.some(e => !bursts.has(e.id) || elapsed.current < 3);
    if (live || liveEffects || transition.current || cameraTween.current) {
      clearTimeout(frameTimer.current);
      // Yield between WebGL frames so pointer/input work gets CPU time on slower devices.
      frameTimer.current = setTimeout(() => { if (!hidden.current && visible.current) invalidate(); }, fps.current.quality === 2 ? 40 : fps.current.quality === 1 ? 24 : 12);
    }
    if ((live || liveEffects) && rawDelta > 0 && rawDelta < 1) {
      fps.current.samples++; fps.current.seconds += rawDelta;
      if (fps.current.seconds > 2) {
        fps.current.value = fps.current.samples / fps.current.seconds;
        const target = fps.current.value < 20 ? 2 : fps.current.value < 32 ? 1 : 0;
        if (target > fps.current.quality) { fps.current.quality = target; design?.lowerQuality(); effects?.lowerQuality(); setDpr(target === 2 ? (low ? .6 : .75) : low ? .8 : 1); }
        fps.current.samples = 0; fps.current.seconds = 0;
      }
    }
  });
  useEffect(() => {
    if (!design || !effects) return;
    onReady({
      reset: () => {
        const ctrl = controls.current; if (!ctrl) return;
        cameraTween.current = false; ctrl.enableDamping = false;
        camera.position.copy(cameraOffset.current.set(.42, .28, 1).normalize().multiplyScalar(framing.current.distance).add(frameTarget.current));
        ctrl.target.copy(frameTarget.current); ctrl.update(); ctrl.enableDamping = true; invalidate();
      },
      capture: async () => {
        const target = new T.WebGLRenderTarget(1080, 1080, { format: T.RGBAFormat }); target.texture.colorSpace = T.SRGBColorSpace;
        const exportCamera = (camera as T.PerspectiveCamera).clone(); exportCamera.aspect = 1; exportCamera.updateProjectionMatrix();
        const safeDistance = Math.max(framing.current.distance, 7.1);
        exportCamera.position.copy(cameraOffset.current.copy(camera.position).sub(frameTarget.current).normalize().multiplyScalar(safeDistance).add(frameTarget.current)); exportCamera.lookAt(frameTarget.current);
        // Full geometry is built only on explicit export, never during quantity edits.
        const full = buildBouquet(configRef.current, collisionLayout(configRef.current));
        const previous = gl.getRenderTarget(); design.group.visible = false; scene.add(full);
        try {
          updateEffects(effects.entries, 1.25, true); gl.setRenderTarget(target); gl.setClearColor('#ffffff', 0); gl.clear(); gl.render(scene, exportCamera);
          const pixels = new Uint8Array(1080 * 1080 * 4); gl.readRenderTargetPixels(target, 0, 0, 1080, 1080, pixels);
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1080;
          const context = canvas.getContext('2d')!, image = context.createImageData(1080, 1080);
          for (let y = 0; y < 1080; y++) image.data.set(pixels.subarray((1079 - y) * 4320, (1080 - y) * 4320), y * 4320);
          context.putImageData(image, 0, 0); return canvas;
        } finally { gl.setRenderTarget(previous); target.dispose(); scene.remove(full); disposeModel(full); design.group.visible = true; updateEffects(effects.entries, elapsed.current, !motionRef.current); invalidate(); }
      },
      metrics: () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, fps: fps.current.value, frames: gl.info.render.frame, pixelRatio: gl.getPixelRatio(), economy: fps.current.quality > 0, ...design.metrics() }),
    });
    return () => onReady(null);
  }, [design, effects, onReady, gl, scene, camera, invalidate]);
  return <>
    <hemisphereLight args={['#fff9f2', '#817983', 1.65]} />
    <directionalLight position={[-3, 5, 4]} intensity={2.5} color="#fff5e9" />
    <directionalLight position={[4, 2, 3]} intensity={1.4} color="#e5eaff" />
    {design && <primitive object={design.group} />}
    {effects && <primitive object={effects.group} />}
    <mesh position={[0, -1.55, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.2, 32]} /><meshBasicMaterial color="#ba9bad" transparent opacity={.12} depthWrite={false} /></mesh>
    <OrbitControls ref={controls} target={[0, centerY, 0]} enablePan={false} enableDamping dampingFactor={.1} minDistance={3.8} maxDistance={13} minPolarAngle={.35} maxPolarAngle={2.4} onStart={() => { cameraTween.current = false; }} />
  </>;
}
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <div className="scene-fallback">The 3D preview couldn’t start. Your bouquet is safe. You can keep editing and sharing its link.</div> : this.props.children; }
}
function Viewer(props: Props) {
  const { onFailure } = props;
  const [supported] = useState(() => { try { const c = document.createElement('canvas'), context = c.getContext('webgl2'); context?.getExtension('WEBGL_lose_context')?.loseContext(); return !!context; } catch { return false; } });
  useEffect(() => { if (!supported) onFailure(); }, [supported, onFailure]);
  if (!supported) return <div className="scene-fallback"><span>✿</span><h3>A little too 3D for this browser</h3><p>You can still create and share your bouquet. Try a browser with WebGL support to see it bloom or download a PNG.</p></div>;
  return <SceneBoundary onFailure={props.onFailure}><Canvas frameloop="demand" dpr={[1, 1.25]} camera={{ position: [3, 2.3, 7], fov: 36, near: .1, far: 50 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}><Scene {...props} /></Canvas></SceneBoundary>;
}
export default memo(Viewer);
