import { Component, memo, useCallback, useEffect, useRef, useState, type ReactNode, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as T from 'three';
import { buildBouquet, disposeModel } from './models';
import { AnimatedBouquet, collisionLayout } from './animation';
import { bursts, makeEffects, updateEffects, type Effects } from './effects';
import { total, type BouquetConfigV1 } from './config';
import { ObjectLayer, type ObjectInteraction } from './ObjectLayer';
import { type ObjectScene } from './objectScene';
import { objectSize } from './giftCatalog';
import type { NoteOrigin } from './EnvelopeNote';
import { layout } from './layout';
import { bouquetGround, objectGroundOffset } from './sceneGround';

export interface ViewerMetrics { calls: number; triangles: number; fps: number; frames: number; pixelRatio: number; economy: boolean; modelBuilds: number; updateMs: number; updateMaxMs: number; updates: number; contacts: number; transitioning: number; active: number; cachedModels: number; visibleStems: number; objects: number; objectBuilds: number; groundY: number; editGrid: boolean; }
export interface ViewerHandle { reset: () => void; front: () => void; capture: () => Promise<HTMLCanvasElement>; metrics: () => ViewerMetrics; objectPoints: () => Record<string, [number, number]>; flowerPoints: () => Record<string, [number, number]>; }
export type ViewDirection = 'Front' | 'Right side' | 'Back' | 'Left side';
interface Props { config: BouquetConfigV1; motion: boolean; replay: number; onReady: (handle: ViewerHandle | null) => void; onFailure: () => void; onDirection?: (direction: ViewDirection) => void; interaction?: ObjectInteraction; openNote?: (uid: string, origin?: NoteOrigin) => void; flowerInteraction?: { selected: string | null; select: (key: string) => void }; }

function Scene({ config, motion, replay, onReady, onFailure, onDirection, interaction, openNote, flowerInteraction }: Props) {
  const { gl, scene, camera, size, invalidate, setDpr } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [design, setDesign] = useState<AnimatedBouquet | null>(null), [effects, setEffects] = useState<Effects | null>(null);
  const [objectEngine, setObjectEngine] = useState<ObjectScene | null>(null), [dragging, setDragging] = useState(false);
  const objectHelpers = useRef<T.Group | null>(null);
  const groundHelpers = useRef<T.Group | null>(null);
  const ground = bouquetGround(config), groundOffset = objectGroundOffset(ground);
  const flowerMarker = useRef<T.Mesh | null>(null);
  const objectReady = useCallback((engine: ObjectScene | null) => setObjectEngine(engine), []);
  const objectBusy = useCallback((value: boolean) => { if (controls.current) controls.current.enabled = !value; setDragging(value); }, []);
  const configRef = useRef(config), motionRef = useRef(motion), elapsed = useRef(0), hidden = useRef(document.hidden), visible = useRef(true);
  const transition = useRef(false), effectDirty = useRef(true), cameraTween = useRef(false);
  const frameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fps = useRef({ samples: 0, seconds: 0, value: 0, quality: 0 });
  const cameraGoal = useRef(new T.Vector3()), cameraOffset = useRef(new T.Vector3());
  const low = size.width < 500;
  const hasRainbow = config.effects.includes('rainbow');
  const radius = (.59 + Math.sqrt(total(config.flowers)) * .11) * config.spread;
  let width = hasRainbow || config.effects.length ? 4.5 : (radius + .46 * config.size + .2) * 2;
  let centerY = hasRainbow ? .65 : .25, height = config.effects.length ? 4.8 : 3.7, depth = 0;
  if (config.arrangement) {
    const { flowers, fillers } = layout(config);
    const minY = ground - .05;
    const raisedFillers = config.arrangement.fillerProfile === 'stepped' ? fillers : [];
    const maxY = Math.max(centerY + height / 2, ...flowers.map(p => p.position[1] + .65 * p.scale), ...raisedFillers.map(p => p.position[1] + .8 * p.scale));
    width = Math.max(width, ...flowers.map(p => (Math.abs(p.position[0]) + .55 * p.scale) * 2), ...raisedFillers.map(p => (Math.abs(p.position[0]) + .4 * p.scale) * 2));
    centerY = (maxY + minY) / 2; height = maxY - minY + .15;
  }
  if (config.objects.length) {
    let maxY = centerY + height / 2, minY = Math.min(ground - .05, centerY - height / 2), extentX = width / 2, extentZ = 1.2;
    for (const o of config.objects) { const size = objectSize(o); const radius = Math.hypot(size[0], size[2]) * o.scale / 2; extentX = Math.max(extentX, Math.abs(o.position[0]) + radius); extentZ = Math.max(extentZ, Math.abs(o.position[2]) + radius); maxY = Math.max(maxY, o.position[1] + groundOffset + size[1] * o.scale); minY = Math.min(minY, o.position[1] + groundOffset); }
    centerY = (maxY + minY) / 2; height = maxY - minY + .3; width = Math.max(width, Math.hypot(extentX, extentZ) * 2); depth = extentZ * .65;
  }
  const frameTarget = useRef(new T.Vector3(0, centerY, 0));
  const distance = Math.max(5.8, Math.max(height, width * 1.12 / (size.width / size.height)) / (2 * Math.tan(T.MathUtils.degToRad(18))) + depth) * (config.objects.length ? 1.15 : 1);
  const framing = useRef({ distance, centerY });
  const cameraLayout = useRef({ width: 0, height: 0 });
  const lastDirection = useRef<ViewDirection | null>(null);
  const directionChanged = () => {
    const target = controls.current?.target ?? frameTarget.current, angle = Math.atan2(camera.position.x - target.x, camera.position.z - target.z) * 180 / Math.PI;
    const direction: ViewDirection = Math.abs(angle) <= 45 ? 'Front' : Math.abs(angle) >= 135 ? 'Back' : angle > 0 ? 'Right side' : 'Left side';
    if (lastDirection.current !== direction) { lastDirection.current = direction; onDirection?.(direction); }
  };
  const designKey = JSON.stringify({ flowers: config.flowers, fillers: config.fillers, wrapper: config.wrapper, ribbon: config.ribbon, size: config.size, spread: config.spread, seed: config.seed, arrangement: config.arrangement });
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
    if (dragging) return;
    const previousY = frameTarget.current.y;
    frameTarget.current.set(0, centerY, 0);
    const ctrl = controls.current; if (!ctrl) return;
    if (cameraLayout.current.width !== size.width || cameraLayout.current.height !== size.height) camera.position.copy(cameraOffset.current.set(.42, .28, 1).normalize().multiplyScalar(framing.current.distance).add(frameTarget.current));
    else camera.position.y += centerY - previousY;
    cameraLayout.current = { width: size.width, height: size.height };
    ctrl.target.copy(frameTarget.current); ctrl.update(); cameraTween.current = false; invalidate();
  }, [camera, size.width, size.height, centerY, invalidate, dragging]);
  useEffect(() => {
    if (!dragging && camera.position.distanceTo(frameTarget.current) + .05 < distance) {
      cameraGoal.current.copy(cameraOffset.current.copy(camera.position).sub(frameTarget.current).normalize().multiplyScalar(distance).add(frameTarget.current));
      cameraTween.current = true; invalidate();
    }
  }, [distance, camera, invalidate, dragging]);
  useFrame((_, rawDelta) => {
    if (hidden.current || !visible.current) return;
    const delta = Math.min(rawDelta, .08), live = motion && !!design?.stems.length;
    if (motion) elapsed.current += delta;
    if (design && (live || transition.current)) transition.current = design.step(elapsed.current, delta, motion);
    const selected = flowerInteraction?.selected ? design?.stems.find(s => s.key === `flowers:${flowerInteraction.selected}` && s.targetGrowth) : undefined;
    if (flowerMarker.current) {
      flowerMarker.current.visible = !!selected;
      if (selected) { flowerMarker.current.position.copy(selected.position); flowerMarker.current.quaternion.copy(selected.rotation); flowerMarker.current.scale.setScalar(selected.scale * 1.08); }
    }
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
    if (!design || !effects || (config.objects.length && !objectEngine)) return;
    onReady({
      front: () => {
        const ctrl = controls.current; if (!ctrl) return;
        cameraTween.current = false; ctrl.enableDamping = false; ctrl.update();
        camera.position.copy(cameraOffset.current.set(0, .12, 1).normalize().multiplyScalar(framing.current.distance).add(frameTarget.current));
        ctrl.target.copy(frameTarget.current); ctrl.update(); ctrl.enableDamping = true; invalidate();
      },
      reset: () => {
        const ctrl = controls.current; if (!ctrl) return;
        cameraTween.current = false; ctrl.enableDamping = false; ctrl.update();
        camera.position.copy(cameraOffset.current.set(.42, .28, 1).normalize().multiplyScalar(framing.current.distance).add(frameTarget.current));
        ctrl.target.copy(frameTarget.current); ctrl.update(); ctrl.enableDamping = true; invalidate();
      },
      capture: async () => {
        await objectEngine?.ready();
        const target = new T.WebGLRenderTarget(1080, 1080, { format: T.RGBAFormat }); target.texture.colorSpace = T.SRGBColorSpace;
        const exportCamera = (camera as T.PerspectiveCamera).clone(); exportCamera.aspect = 1; exportCamera.updateProjectionMatrix();
        // Full geometry is built only on explicit export, never during quantity edits.
        const full = buildBouquet(configRef.current, collisionLayout(configRef.current));
        const direction = cameraOffset.current.copy(camera.position).sub(frameTarget.current).normalize();
        let safeDistance = Math.max(framing.current.distance, 7.1), exportCenter = frameTarget.current.clone();
        if (configRef.current.objects.length || configRef.current.arrangement) {
          const bounds = new T.Box3().setFromObject(full); if (objectEngine) bounds.union(new T.Box3().setFromObject(objectEngine.group));
          exportCenter = bounds.getCenter(new T.Vector3());
          exportCamera.position.copy(exportCenter).add(direction); exportCamera.lookAt(exportCenter);
          const inverse = exportCamera.quaternion.clone().invert(), tangent = Math.tan(T.MathUtils.degToRad(exportCamera.fov / 2));
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) { const p = new T.Vector3(x, y, z).sub(exportCenter).applyQuaternion(inverse); safeDistance = Math.max(safeDistance, p.z + Math.max(Math.abs(p.x), Math.abs(p.y)) / tangent * 1.12); }
        }
        exportCamera.position.copy(direction).multiplyScalar(safeDistance).add(exportCenter); exportCamera.lookAt(exportCenter);
        const previous = gl.getRenderTarget(); design.group.visible = false; if (objectHelpers.current) objectHelpers.current.visible = false; if (groundHelpers.current) groundHelpers.current.visible = false; const markerVisible = flowerMarker.current?.visible; if (flowerMarker.current) flowerMarker.current.visible = false; scene.add(full);
        try {
          updateEffects(effects.entries, 1.25, true); gl.setRenderTarget(target); gl.setClearColor('#ffffff', 0); gl.clear(); gl.render(scene, exportCamera);
          const pixels = new Uint8Array(1080 * 1080 * 4); gl.readRenderTargetPixels(target, 0, 0, 1080, 1080, pixels);
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1080;
          const context = canvas.getContext('2d')!, image = context.createImageData(1080, 1080);
          for (let y = 0; y < 1080; y++) image.data.set(pixels.subarray((1079 - y) * 4320, (1080 - y) * 4320), y * 4320);
          context.putImageData(image, 0, 0); return canvas;
        } finally { gl.setRenderTarget(previous); target.dispose(); scene.remove(full); disposeModel(full); design.group.visible = true; if (objectHelpers.current) objectHelpers.current.visible = true; if (groundHelpers.current) groundHelpers.current.visible = true; if (flowerMarker.current) flowerMarker.current.visible = !!markerVisible; updateEffects(effects.entries, elapsed.current, !motionRef.current); invalidate(); }
      },
      metrics: () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, fps: fps.current.value, frames: gl.info.render.frame, pixelRatio: gl.getPixelRatio(), economy: fps.current.quality > 0, objects: objectEngine?.entries.size ?? 0, objectBuilds: objectEngine?.builds ?? 0, groundY: bouquetGround(configRef.current), editGrid: !!groundHelpers.current?.getObjectByName('edit-ground-grid')?.visible, ...design.metrics() }),
      objectPoints: () => { const result: Record<string, [number, number]> = {}; objectEngine?.group.updateMatrixWorld(true); objectEngine?.entries.forEach((entry, uid) => { const point = new T.Box3().setFromObject(entry.model).getCenter(new T.Vector3()).project(camera); result[uid] = [(point.x + 1) * size.width / 2, (1 - point.y) * size.height / 2]; }); return result; },
      flowerPoints: () => { const result: Record<string, [number, number]> = {}; design.stems.filter(s => s.category === 'flowers' && s.targetGrowth).forEach(s => { const point = s.position.clone().project(camera); result[s.key.slice('flowers:'.length)] = [(point.x + 1) * size.width / 2, (1 - point.y) * size.height / 2]; }); return result; },
    });
    return () => onReady(null);
  }, [design, effects, objectEngine, config.objects.length, onReady, gl, scene, camera, invalidate, size.width, size.height]);
  return <>
    <hemisphereLight args={['#fff9f2', '#817983', 1.65]} />
    <directionalLight position={[-3, 5, 4]} intensity={2.5} color="#fff5e9" />
    <directionalLight position={[4, 2, 3]} intensity={1.4} color="#e5eaff" />
    {design && <primitive object={design.group} onClick={(event: ThreeEvent<MouseEvent>) => { if (!flowerInteraction || event.delta > 4 || event.instanceId === undefined) return; const key = event.object.userData.flowerKeys?.[event.instanceId]; if (typeof key === 'string') { event.stopPropagation(); flowerInteraction.select(key); } }} />}
    {flowerInteraction && <mesh ref={flowerMarker} visible={false} raycast={() => {}}><torusGeometry args={[.42, .012, 6, 48]} /><meshBasicMaterial color="#b96e96" transparent opacity={.72} depthWrite={false} depthTest={false} /></mesh>}
    {effects && <primitive object={effects.group} />}
    {!!config.objects.length && <ObjectLayer objects={config.objects} ground={ground} interaction={interaction} openNote={openNote} busy={objectBusy} engineReady={objectReady} helpers={objectHelpers} />}
    <group ref={groundHelpers}>{interaction && <gridHelper name="edit-ground-grid" args={[7, 14, '#ae8b9e', '#d4bdcb']} position={[0, ground + .003, .5]} raycast={() => {}} />}</group>
    <mesh position={[0, ground - .005, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}><circleGeometry args={[1.2, 32]} /><meshBasicMaterial color="#ba9bad" transparent opacity={.12} depthWrite={false} /></mesh>
    <OrbitControls ref={controls} target={[0, centerY, 0]} enabled={!dragging} enablePan={false} enableDamping dampingFactor={.1} minDistance={3.8} maxDistance={config.objects.length ? 24 : 13} minPolarAngle={.35} maxPolarAngle={2.4} onChange={directionChanged} onStart={() => { cameraTween.current = false; }} />
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
