import { useEffect, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ObjectScene } from './objectScene';
import { clampPosition, OBJECT_FLOOR, objectSize, type GiftObject } from './giftCatalog';
import type { NoteOrigin } from './EnvelopeNote';

export interface ObjectInteraction {
  selected: string | null; placing: boolean;
  select: (uid: string | null) => void;
  move: (uid: string, position: GiftObject['position']) => void;
  placementDone: () => void;
  photoError: () => void;
  beginEdit: () => void; endEdit: () => void;
}
interface Props { objects: GiftObject[]; interaction?: ObjectInteraction; openNote?: (uid: string, origin?: NoteOrigin) => void; busy: (value: boolean) => void; engineReady: (engine: ObjectScene | null) => void; helpers: React.RefObject<T.Group | null>; }
type CaptureTarget = { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void; };

export function ObjectLayer({ objects, interaction, openNote, busy, engineReady, helpers }: Props) {
  const { gl, invalidate } = useThree();
  const [engine, setEngine] = useState<ObjectScene | null>(null);
  const latest = useRef({ interaction, busy, openNote }); latest.current = { interaction, busy, openNote };
  const drag = useRef<{ uid: string; plane: T.Plane; offset: T.Vector3; start: [number, number]; moved: boolean; pointer: number; target: CaptureTarget; } | null>(null);
  useEffect(() => {
    const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(gl), environment = pmrem.fromScene(room, .04); room.dispose(); pmrem.dispose();
    const next = new ObjectScene(invalidate, () => latest.current.interaction?.photoError(), environment.texture);
    setEngine(next); engineReady(next);
    return () => { if (drag.current) { try { drag.current.target.releasePointerCapture(drag.current.pointer); } catch { /* Pointer already released. */ } drag.current = null; latest.current.interaction?.endEdit(); latest.current.busy(false); } next.dispose(); environment.dispose(); engineReady(null); };
  }, [gl, invalidate, engineReady]);
  useEffect(() => { if (engine) { engine.sync(objects); invalidate(); } }, [engine, objects, invalidate]);
  useEffect(() => {
    const cancel = () => { const current = drag.current; if (current) { drag.current = null; try { current.target.releasePointerCapture(current.pointer); } catch { /* Pointer already released. */ } latest.current.interaction?.endEdit(); } latest.current.busy(false); };
    window.addEventListener('blur', cancel); window.addEventListener('pointercancel', cancel); window.addEventListener('pointerup', cancel);
    return () => { window.removeEventListener('blur', cancel); window.removeEventListener('pointercancel', cancel); window.removeEventListener('pointerup', cancel); };
  }, []);
  function uidOf(object: T.Object3D): string | undefined { for (let o: T.Object3D | null = object; o; o = o.parent) if (o.userData.objectUid) return o.userData.objectUid; }
  function down(event: ThreeEvent<PointerEvent>) {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    const uid = uidOf(event.object), object = objects.find(o => o.uid === uid); if (!object) return;
    if (!interaction && (object.id !== 'sealed-envelope' || !openNote)) return;
    event.stopPropagation(); interaction?.select(object.uid);
    const plane = new T.Plane(new T.Vector3(0, 1, 0), -object.position[1]), point = event.ray.intersectPlane(plane, new T.Vector3());
    if (!point) return;
    const target = event.target as unknown as CaptureTarget;
    drag.current = { uid: object.uid, plane, offset: new T.Vector3(...object.position).sub(point), start: [event.clientX, event.clientY], moved: false, pointer: event.pointerId, target };
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
    interaction?.beginEdit(); busy(true); target.setPointerCapture(event.pointerId);
  }
  function move(event: ThreeEvent<PointerEvent>) {
    const current = drag.current; if (!current || event.pointerId !== current.pointer) return;
    event.stopPropagation();
    if (Math.hypot(event.clientX - current.start[0], event.clientY - current.start[1]) < 3 && !current.moved) return;
    current.moved = true; if (!latest.current.interaction) return;
    const point = event.ray.intersectPlane(current.plane, new T.Vector3()); if (!point) return;
    point.add(current.offset); const position = clampPosition(point.toArray());
    engine?.entries.get(current.uid)?.model.position.set(...position); invalidate(); latest.current.interaction.move(current.uid, position);
  }
  function up(event: ThreeEvent<PointerEvent>) {
    const current = drag.current; if (!current || event.pointerId !== current.pointer) return;
    event.stopPropagation(); drag.current = null; current.target.releasePointerCapture(event.pointerId); latest.current.interaction?.endEdit(); busy(false);
    if (!current.moved && Math.hypot(event.clientX - current.start[0], event.clientY - current.start[1]) < 5 && event.nativeEvent.type !== 'pointercancel' && !latest.current.interaction?.placing && objects.find(o => o.uid === current.uid)?.id === 'sealed-envelope') latest.current.openNote?.(current.uid, { x: event.clientX, y: event.clientY });
  }
  const selected = objects.find(o => o.uid === interaction?.selected), size = selected ? objectSize(selected) : undefined;
  return <>
    {engine && <primitive object={engine.group} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerOver={(event: ThreeEvent<PointerEvent>) => { if (objects.find(o => o.uid === uidOf(event.object))?.id === 'sealed-envelope') gl.domElement.style.cursor = 'pointer'; }} onPointerOut={() => { gl.domElement.style.cursor = ''; }} />}
    <group ref={helpers}>
      {interaction?.placing && selected && <mesh position={[0, selected.position[1], 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={event => { if (event.button !== 0) return; event.stopPropagation(); busy(true); }} onPointerUp={event => { event.stopPropagation(); busy(false); interaction.move(selected.uid, clampPosition(event.point.toArray())); interaction.placementDone(); }}>
        <planeGeometry args={[12, 12]} /><meshBasicMaterial color="#b995aa" transparent opacity={.04} depthWrite={false} side={T.DoubleSide} />
      </mesh>}
      {selected && size && <mesh position={[selected.position[0], selected.position[1] + .014, selected.position[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[selected.scale * Math.max(size[0], size[2]) * .62, selected.scale * Math.max(size[0], size[2]) * .62, 1]} raycast={() => {}}>
        <ringGeometry args={[.95, 1, 48]} /><meshBasicMaterial color="#9b637f" transparent opacity={.65} depthWrite={false} />
      </mesh>}
      {interaction?.placing && <gridHelper args={[5, 10, '#bca1b1', '#d4c2cd']} position={[0, selected?.position[1] ?? OBJECT_FLOOR, 0]} raycast={() => {}} />}
    </group>
  </>;
}
