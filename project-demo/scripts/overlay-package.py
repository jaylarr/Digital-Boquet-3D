"""Package only the final ad and its editable project; no cache or older cuts."""
from pathlib import Path
from copy import deepcopy
import hashlib, json, os, shutil, zipfile

DEMO=Path(__file__).resolve().parents[1]
OUT=DEMO/'capcut-overlay-v2'
DELIVERY=DEMO/'delivery'
ROOT=DELIVERY/'PetalPop-Ad-V2'
PROJECT=ROOT/'CapCut'/'PetalPop - Overlay Ad V2'

def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
    return h.hexdigest()
def save(p,data):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def copy(source,target):
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,target)

qa=read(OUT/'qa-report.json')
if sha(OUT/'petalpop-overlay-ad.mp4')!=qa['sha256']: raise ValueError('Master no longer matches validated export')
if not qa['fullDecode'] or not read(OUT/'alpha-verification.json')['allOverlaysContainTransparency']: raise ValueError('Required output checks missing')
draft=deepcopy(read(OUT/'capcut-projects'/'PetalPop - Overlay Ad V2'/'draft_content.json'))
meta=deepcopy(read(OUT/'capcut-projects'/'PetalPop - Overlay Ad V2'/'draft_meta_info.json'))
ROOT.mkdir(parents=True,exist_ok=True)
material_paths={}
copied=set()
for values in draft['materials'].values():
    for material in values:
        if not isinstance(material,dict) or not material.get('path'): continue
        source=Path(material['path']).resolve()
        relative=source.relative_to(OUT.resolve())
        destination=PROJECT/'Media'/relative
        if source not in copied: copy(source,destination);copied.add(source)
        material['path']=str(destination)
        material_paths[material['id']]=destination.relative_to(PROJECT).as_posix()
copy(OUT/'poster.png',PROJECT/'cover.png')
meta.update(draft_fold_path=str(PROJECT),draft_root_path=str(PROJECT.parent),draft_cover=str(PROJECT/'cover.png'))
save(PROJECT/'draft_content.json',draft)
save(PROJECT/'draft_meta_info.json',meta)
save(ROOT/'media-paths.json',{'project':'CapCut/PetalPop - Overlay Ad V2','materialPaths':material_paths})
for name in ['petalpop-overlay-ad.mp4','petalpop-overlay-ad.srt','poster.png','moment-sheet.csv','index.html']:
    copy(OUT/name,ROOT/name)
copy(DEMO.parent/'docs/marketing-overlay-script.md',ROOT/'Script.md')
copy(DEMO/'src/OverlayAd.tsx',ROOT/'Drawing-source/OverlayAd.tsx')
for name in ['scenes.json','assets.json']:
    copy(DEMO/'src'/name,ROOT/'Drawing-source'/name)
for name in ['captions.json','gift-card.png']:
    copy(DEMO/'public/assets'/name,ROOT/'Drawing-source'/name)
for name in ['qa-report.json','alpha-verification.json','capcut-draft-report.json']:
    copy(OUT/name,ROOT/'Validation'/name)
ui=OUT/'capcut-ui-validation.json'
if ui.exists(): copy(ui,ROOT/'Validation'/ui.name)
copy(DEMO/'scripts/overlay-relink.ps1',ROOT/'Relink-Media.ps1')
(ROOT/'START-HERE.txt').write_text(
    'PETALPOP 3D - LITTLE BLOOMS. BIG FEELINGS.\n\n'
    'WATCH: Open petalpop-overlay-ad.mp4. It is the finished 90-second vertical ad.\n'
    'Captions are included as SRT. Script.md is the revised production script.\n\n'
    'EDIT IN CAPCUT DESKTOP:\n'
    '1. Extract this entire ZIP into a permanent folder.\n'
    '2. Copy CapCut/PetalPop - Overlay Ad V2 into your CapCut Drafts location.\n'
    '3. Run Relink-Media.ps1 with -ProjectPath followed by that copied folder path.\n'
    '   Example from this extracted folder in PowerShell:\n'
    '   & .\\Relink-Media.ps1 -ProjectPath "D:\\CapCut Drafts\\PetalPop - Overlay Ad V2"\n'
    '4. Open CapCut and select PetalPop - Overlay Ad V2.\n'
    'The project folder contains all base footage, transparent graphics and audio.\n'
    'Keep the Media folder with the project. No paid media or cloud upload is needed.\n'
    'CapCut compatibility evidence is in Validation; JSON checks alone do not prove UI compatibility.\n\n'
    'EDITING: PP-BASE is the fixed 15-clip cut. PP-OVERLAYS contains 15 replaceable\n'
    'transparent graphic clips. Music, narration and 32 sound cues use separate tracks.\n'
    'Drawing-source contains the React/SVG artwork and supporting data for reference.\n'
    'The complete runnable rendering tools remain in the original project workspace.\n'
    'The media relinker rewrites only packaged media paths and keeps a draft backup.\n',encoding='utf-8')

files=[]
for p in sorted(ROOT.rglob('*')):
    if p.is_file() and p.name!='package-manifest.json':
        files.append({'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)})
save(ROOT/'package-manifest.json',{'version':1,'project':'PetalPop 3D','masterSha256':qa['sha256'],'files':files})
archive=DELIVERY/'PetalPop-Ad-V2.zip'
pending=DELIVERY/'PetalPop-Ad-V2.pending.zip'
with zipfile.ZipFile(pending,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=3,allowZip64=True) as z:
    for p in sorted(ROOT.rglob('*')):
        if p.is_file(): z.write(p,'PetalPop-Ad-V2/'+p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(pending) as z:
    if z.testzip() is not None: raise ValueError('Archive CRC validation failed')
    for entry in files:
        info=z.getinfo('PetalPop-Ad-V2/'+entry['path'])
        if info.file_size!=entry['bytes']: raise ValueError('Archive size mismatch')
        h=hashlib.sha256()
        with z.open(info) as f:
            for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
        if h.hexdigest()!=entry['sha256']: raise ValueError('Archive hash mismatch')
os.replace(pending,archive)
save(DELIVERY/'package-report.json',{'archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive),'files':len(files)+1,'crcChecked':True,'allEntryHashesChecked':True,'masterMatchesValidatedExport':True,'mediaMaterials':len(material_paths),'selfContainedDraftMedia':True})
print('Packaged and verified:',archive)
