"""Build an editable, local CapCut draft after the complete media family exists.

This writes only the workspace copy. It never opens CapCut or touches its live drafts.
"""
from pathlib import Path
import hashlib, json, os, sys, time, uuid

DEMO=Path(__file__).resolve().parents[1]
OUT=DEMO/'capcut-overlay-v2'
sys.path.insert(0,str(DEMO/'.cache/capcut-python'))
import pycapcut as cc

def read(p): return json.loads(p.read_text(encoding='utf-8'))
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def fixed_id(label): return uuid.uuid5(uuid.NAMESPACE_URL,'petalpop-overlay-v2/'+label).hex
def axis(content):
    mats={m['id']:m for m in content['materials'].get('videos',[])}
    tracks=[t for t in content['tracks'] if t.get('name')=='PP-BASE']
    if len(tracks)!=1: raise ValueError('Expected one PP-BASE track')
    return {'canvas':content['canvas_config'],'fps':content['fps'],'segments':[{
        'target':s['target_timerange'],'source':s.get('source_timerange'),
        'clip':s.get('clip'),'path':mats[s['material_id']]['path']
    } for s in tracks[0]['segments']]}

plan=read(OUT/'rendered-moments.json')
cut=read(OUT/'base-cut.json')
sound=read(OUT/'sound-placements.json')
lock=read(OUT/'placement-lock.json')
if lock['baseCutSha256']!=digest(OUT/'base-cut.json'): raise ValueError('Cut changed; reopen moment placement before rebuilding')
if len(plan['moments'])!=15 or len(cut['clips'])!=15: raise ValueError('Refusing incomplete graphic family')
for clip in cut['clips']:
    if digest(OUT/clip['path'])!=clip['sha256']: raise ValueError('Base media changed after placement')
for m in plan['moments']:
    if not (OUT/m['overlay']).is_file(): raise ValueError('Missing '+m['id'])

projects=OUT/'capcut-projects';projects.mkdir(exist_ok=True)
name='PetalPop - Overlay Ad V2'
final=projects/name
existing_path=final/'draft_content.json'
guard_path=OUT/'capcut-base-guard.json'
existing=read(existing_path) if existing_path.exists() else None
if existing is not None:
    if not guard_path.exists() or axis(existing)!=read(guard_path):
        raise ValueError('Main cut changed in the existing draft; rebuild moment placements first. Existing project untouched.')

script=cc.ScriptFile(cut['width'],cut['height'],cut['fps'])
for kind,track,index in [(cc.TrackType.video,'PP-BASE',0),(cc.TrackType.video,'PP-OVERLAYS',1),
                        (cc.TrackType.audio,'PP-NARRATION',0),(cc.TrackType.audio,'PP-MUSIC',1),
                        (cc.TrackType.audio,'PP-SFX-IN',2),(cc.TrackType.audio,'PP-SFX-OUT',3),(cc.TrackType.audio,'PP-TAP-SFX',4)]:
    script.add_track(kind,track,relative_index=index)
for clip in cut['clips']:
    mat=cc.VideoMaterial(str(OUT/clip['path']),material_name=clip['id']+' - base')
    mat.material_id=fixed_id(clip['id']+'/base-material')
    seg=cc.VideoSegment(mat,cc.Timerange(round(clip['startFrame']/30*cc.SEC),round(clip['durationFrames']/30*cc.SEC)))
    seg.segment_id=fixed_id(clip['id']+'/base-segment')
    script.add_segment(seg,'PP-BASE')
for m in plan['moments']:
    mat=cc.VideoMaterial(str(OUT/m['overlay']),material_name=m['id']+' - '+m['title'])
    mat.material_id=fixed_id(m['id']+'/overlay-material')
    seg=cc.VideoSegment(mat,cc.Timerange(round(m['startFrame']/30*cc.SEC),round(m['durationFrames']/30*cc.SEC)))
    seg.segment_id=fixed_id(m['id']+'/overlay-segment')
    script.add_segment(seg,'PP-OVERLAYS')
for file,track in [('narration.wav','PP-NARRATION'),('music-for-editor.wav','PP-MUSIC')]:
    material=cc.AudioMaterial(str(OUT/'audio'/file))
    material.material_id=fixed_id(track+'/material')
    seg=cc.AudioSegment(material,cc.Timerange(0,min(90*cc.SEC,material.duration)),volume=sound['editorVolume'])
    seg.segment_id=fixed_id(track+'/segment')
    script.add_segment(seg,track)
for i,cue in enumerate(sound['placements']):
    track={'in':'PP-SFX-IN','out':'PP-SFX-OUT','tap':'PP-TAP-SFX'}[cue['direction']]
    material=cc.AudioMaterial(str(OUT/cue['path']))
    material.material_id=fixed_id(cue['moment']+'/'+cue['direction']+'/'+str(i)+'/material')
    seg=cc.AudioSegment(material,cc.Timerange(round(cue['startFrame']/30*cc.SEC),round(cue['durationSeconds']*cc.SEC)),volume=sound['editorVolume'])
    seg.segment_id=fixed_id(cue['moment']+'/'+cue['direction']+'/'+str(i))
    script.add_segment(seg,track)
content=json.loads(script.dumps())
family={'PP-OVERLAYS','PP-NARRATION','PP-MUSIC','PP-SFX-IN','PP-SFX-OUT','PP-TAP-SFX'}
if existing is not None:
    # Preserve the user's base track and every unrelated track. Replace only ours.
    generated=content
    content=existing
    content['tracks']=[t for t in existing['tracks'] if t.get('name') not in family]+[t for t in generated['tracks'] if t.get('name') in family]
    for kind,materials in generated['materials'].items():
        merged={m['id']:m for m in content['materials'].get(kind,[]) if 'id' in m}
        for m in materials:
            if 'id' in m: merged[m['id']]=m
        content['materials'][kind]=list(merged.values())

# Validate all references and frame coordinates before a single project write.
materials={m['id']:m for values in content['materials'].values() for m in values if isinstance(m,dict) and 'id' in m}
for track in content['tracks']:
    if track.get('name') in family|{'PP-BASE'}:
        for seg in track['segments']:
            material=materials[seg['material_id']]
            if 'path' in material and not Path(material['path']).is_file(): raise ValueError('Missing project media')
if len([t for t in content['tracks'] if t.get('name')=='PP-OVERLAYS'][0]['segments'])!=15: raise ValueError('Partial timeline')
owned={t['name']:t for t in content['tracks'] if t.get('name') in family|{'PP-BASE'}}
if len(owned)!=7 or len([t for t in content['tracks'] if t.get('name') in owned])!=7: raise ValueError('Duplicated owned tracks')
for track_name in ['PP-BASE','PP-OVERLAYS']:
    for clip,segment in zip(cut['clips'],owned[track_name]['segments'],strict=True):
        expected={'start':round(clip['startFrame']/30*cc.SEC),'duration':round(clip['durationFrames']/30*cc.SEC)}
        if segment['target_timerange']!=expected: raise ValueError('Timeline coordinate mismatch')
if max(s['target_timerange']['start']+s['target_timerange']['duration'] for t in owned.values() for s in t['segments'])!=90*cc.SEC: raise ValueError('Incomplete draft duration')
if owned['PP-OVERLAYS']['segments'][0]['render_index']<=owned['PP-BASE']['segments'][0]['render_index']: raise ValueError('Overlay layer ordering mismatch')
for track_name in family-{'PP-OVERLAYS'}:
    for segment in owned[track_name]['segments']:
        if abs(segment['volume']-sound['editorVolume'])>1e-9: raise ValueError('Audio gain mismatch')
for track_name in ['PP-NARRATION','PP-MUSIC']:
    if owned[track_name]['segments'][0]['target_timerange']['duration']!=90*cc.SEC: raise ValueError('Incomplete full-length audio stem')
content['name']=name
final.mkdir(exist_ok=True)
staged=final/'draft_content.pending.json'
staged.write_text(json.dumps(content,ensure_ascii=False,indent=2),encoding='utf-8')
reopened=read(staged)
if axis(reopened)!=axis(content): raise ValueError('Draft readback mismatch')
if existing_path.exists():
    (final/'draft_content.before-rebuild.json').write_bytes(existing_path.read_bytes())
os.replace(staged,existing_path)
meta_path=final/'draft_meta_info.json'
if meta_path.exists(): meta=read(meta_path)
else:
    template=DEMO/'.cache/capcut-python/pycapcut/assets/draft_meta_info.json'
    meta=read(template)
meta.update(draft_id=fixed_id('draft'),draft_name=name,draft_fold_path=str(final),draft_root_path=str(projects),draft_cover=str(OUT/'review/PP-01-68.png'),tm_duration=90*cc.SEC,tm_draft_modified=time.time_ns()//1000)
meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
guard_path.write_text(json.dumps(axis(content),sort_keys=True,indent=2),encoding='utf-8')
report={'draft':str(existing_path),'width':cut['width'],'height':cut['height'],'fps':cut['fps'],'durationSeconds':90,'baseClips':15,'overlayClips':15,'tracks':[t.get('name') for t in content['tracks']], 'clipIdentity':'Stable PP identifiers in material names and UUID5 segment IDs','allMediaPresent':True,'readbackChecked':True,'exactTimelineChecked':True,'audioGainMatchesMaster':True,'fullLengthMusicTail':True,'noDuplicateOwnedTracks':True,'existingUnrelatedTracksPreserved':existing is not None,'openedInCapCut':False,'liveCapCutProjectsModified':False}
(OUT/'capcut-draft-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('Editable local CapCut draft generated:',existing_path)
