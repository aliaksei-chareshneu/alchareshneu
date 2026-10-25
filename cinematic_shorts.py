"""ShortFactory motion-first renderer; no paid API and no automatic publishing."""
from __future__ import annotations
import argparse, hashlib, json, re, shutil, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W,H,FPS=1080,1920,24
FFMPEG=shutil.which("ffmpeg")
FFPROBE=shutil.which("ffprobe")
FONTS=("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf","C:/Windows/Fonts/arialbd.ttf","/System/Library/Fonts/Supplemental/Arial Bold.ttf")

def cmd(args, timeout=300):
    p=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if p.returncode: raise RuntimeError("Media command failed: "+p.stderr[-1800:])
    return p.stdout

def metadata(p):
    return json.loads(cmd([FFPROBE,"-v","error","-show_streams","-show_format","-of","json",str(p)]))

def sec(stamp):
    h,m,secms=stamp.split(":"); s,ms=secms.split(",")
    return int(h)*3600+int(m)*60+int(s)+int(ms)/1000

def stamp(v):
    n=round(v*1000); h,n=divmod(n,3600000); m,n=divmod(n,60000); s,ms=divmod(n,1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def wordcaptions(path):
    raw=Path(path).read_text(encoding="utf-8-sig").replace("\r\n","\n")
    out=[]; idx=1
    for block in re.split(r"\n\s*\n",raw.strip()):
        lines=block.splitlines(); i=next((i for i,l in enumerate(lines) if "-->" in l),None)
        if i is None: continue
        start,end=(sec(x.strip()) for x in lines[i].split("-->"))
        words=" ".join(lines[i+1:]).split()
        groups=[words[k:k+5] for k in range(0,len(words),5)]
        weights=[sum(len(w) for w in g) for g in groups]
        total=sum(weights) or 1
        at=start
        for j,group in enumerate(groups):
            nxt=end if j==len(groups)-1 else at+(end-start)*weights[j]/total
            out.append(f"{idx}\n{stamp(at)} --> {stamp(nxt)}\n{' '.join(group)}\n")
            idx+=1; at=nxt
    if not out: raise ValueError("Subtitles missing")
    return "\n".join(out)

def font():
    return next((f for f in FONTS if Path(f).exists()),None)

def overlay_png(out,shot,variant,brand_label,source_label,visual_label):
    file=font()
    if not file: raise RuntimeError("Install DejaVu Sans or Arial Bold")
    img=Image.new("RGBA",(W,H)); d=ImageDraw.Draw(img)
    accent=(251,202,117,255) if variant=="documentary" else (96,239,204,255)
    d.rounded_rectangle((60,120,1020,207),radius=16,fill=(4,12,20,187))
    d.text((84,135),brand_label.upper()[:37],font=ImageFont.truetype(file,36),fill=accent)
    f=ImageFont.truetype(file,68); lines=[]; current=""
    for word in shot["headline"].split():
        t=(current+" "+word).strip()
        if d.textbbox((0,0),t,font=f)[2]<880: current=t
        else:
            if current: lines.append(current)
            current=word
    if current: lines.append(current)
    if len(lines)>3: raise ValueError("Too many headline lines")
    boxheight=32+len(lines)*89
    d.rounded_rectangle((58,264,1020,264+boxheight),radius=15,fill=(4,12,20,108))
    y=285
    for line in lines:
        d.text((91,y),line,font=f,fill="white",stroke_width=2,stroke_fill=(0,0,0,255)); y+=89
    label=ImageFont.truetype(file,27)
    d.rounded_rectangle((60,1643,1020,1714),radius=15,fill=(2,8,16,191))
    d.text((78,1660),visual_label.upper()[:40],font=label,fill=(235,240,243))
    d.rounded_rectangle((60,1830,1020,1890),radius=13,fill=(2,8,16,190))
    d.text((80,1844),source_label.upper()[:47],font=label,fill=accent)
    img.save(out)

def check(cfg,media):
    if cfg.get("license")!="CC BY-SA 4.0" or cfg.get("published") is not False:
        raise ValueError("Rights gate: example requires CC BY-SA 4.0 and published=false")
    if set(cfg.get("variants",{}))!={"documentary","action"}: raise ValueError("Need two variants")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{2,40}",cfg.get('output_prefix','roman_motion')): raise ValueError('Unsafe output prefix')
    root=Path(media).resolve(); assets={}
    for name,meta in cfg["assets"].items():
        if not all(meta.get(k) for k in ("filename","source_page","author","license")): raise ValueError("Missing provenance")
        p=(root/meta["filename"]).resolve()
        if not p.is_relative_to(root) or not p.is_file() or p.stat().st_size<20000: raise FileNotFoundError(str(p))
        assets[name]=p
    for name,shots in cfg["variants"].items():
        if not 6<=len(shots)<=14: raise ValueError("Need 6-14 real edits")
        for shot in shots:
            if shot["asset"] not in assets or not 0.5<=shot["seconds"]<=8 or not shot.get("headline"): raise ValueError("Invalid shot")
    return assets

def shot_render(source,shot,graphic,dest,duration,variant):
    still=source.suffix.lower() in (".jpg",".jpeg",".png",".webp")
    if still:
        inputs=["-loop","1","-framerate",str(FPS),"-i",str(source)]
        bg=(f"scale=1220:2140:force_original_aspect_ratio=increase,crop=1220:2140,"
            f"zoompan=z='min(zoom+0.0008,1.14)':x='iw/2-(iw/zoom/2)':"
            f"y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}")
    else:
        offset=float(shot.get("source_start",0))
        if offset+duration>float(metadata(source)["format"]["duration"]): raise ValueError("Video too short: "+str(source))
        inputs=["-ss",str(offset),"-i",str(source)]
        bg=f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
    grade="eq=contrast=1.04:saturation=0.97" if variant=="documentary" else "eq=contrast=1.11:saturation=1.18"
    filterstr=f"[0:v]{bg},{grade}[v0];[v0][1:v]overlay=0:0:shortest=1,format=yuv420p[v]"
    cmd([FFMPEG,"-hide_banner","-loglevel","error","-nostdin","-y",*inputs,
         "-loop","1","-i",str(graphic),"-t",f"{duration:.3f}",
         "-filter_complex",filterstr,"-map","[v]","-an","-c:v","libx264",
         "-preset","ultrafast","-crf","23","-pix_fmt","yuv420p","-r",str(FPS),str(dest)],timeout=300)

def render(cfg,media,voice,subtitles,outdir):
    if not FFMPEG or not FFPROBE: raise RuntimeError("Requires FFmpeg+ffprobe")
    assets=check(cfg,media); d=float(metadata(voice)["format"]["duration"])
    if not 15<=d<=60: raise ValueError("Invalid narration duration")
    outdir=Path(outdir); outdir.mkdir(parents=True,exist_ok=True)
    if any(outdir.iterdir()): raise FileExistsError("Output must be empty; no silent overwrite")
    subs=outdir/"wordgroup_captions.srt"; subs.write_text(wordcaptions(subtitles),encoding="utf-8")
    rights=["Adaptation CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/",
            "Modified footage: cropped, color-graded, annotated, and re-timed.",
            "Scenes are illustrative reenactments; not evidence all legions trained identically.",
            "Historical source: "+cfg.get("source_label","Vegetius, Epitoma rei militaris I.11"),
            "Narration: original script, Kokoro English synthetic speech.",""]
    rights += [f"{key}: {meta['author']} | {meta['source_page']} | {meta['license']}" for key,meta in cfg["assets"].items()]
    (outdir/"LICENSE_CREDITS.txt").write_text("\n".join(rights)+"\n",encoding="utf-8")
    outputs={}
    with tempfile.TemporaryDirectory(prefix="free-motion-") as tmp:
        for variant,shots in cfg["variants"].items():
            vdir=Path(tmp)/variant; vdir.mkdir()
            scale=d/sum(float(s["seconds"]) for s in shots)
            segs=[]; elapsed=0.
            for i,shot in enumerate(shots):
                length=d-elapsed if i==len(shots)-1 else float(shot["seconds"])*scale
                if length<=0.5: raise ValueError("Shot too short")
                graphic=vdir/f"label{i:02d}.png"; overlay_png(graphic,shot,variant,cfg.get("brand_label","BATTLE MYTHS LAB / HISTORY"),cfg.get("source_label","SOURCE: VEGETIUS, EPITOMA I.11"),cfg.get("visual_label","ILLUSTRATIVE RECONSTRUCTION"))
                segment=vdir/f"piece{i:02d}.mp4"
                shot_render(assets[shot["asset"]],shot,graphic,segment,length,variant)
                segs.append(segment); elapsed+=length
            manifest=vdir/"parts.ffconcat"
            manifest.write_text("ffconcat version 1.0\n"+"".join("file '"+p.as_posix()+"'\n" for p in segs),encoding="utf-8")
            mute=vdir/"mute.mp4"
            cmd([FFMPEG,"-hide_banner","-loglevel","error","-nostdin","-y",
                "-safe","0","-f","concat","-i",str(manifest),"-i",str(voice),
                "-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac",
                "-b:a","160k","-af","loudnorm=I=-16:TP=-1.5:LRA=11",
                "-shortest",str(mute)],timeout=240)
            final=outdir/f"{cfg.get('output_prefix','roman_motion')}_{variant}_DRAFT.mp4"
            subs_posix=subs.resolve().as_posix().replace(":","\\:").replace("'","\\'")
            vf=("subtitles='"+subs_posix+"':force_style="
                "'FontName=DejaVu Sans,FontSize=16,Bold=1,Outline=2,Shadow=1,Alignment=2,MarginV=64'")
            cmd([FFMPEG,"-hide_banner","-loglevel","error","-nostdin","-y",
                 "-i",str(mute),"-vf",vf,"-c:v","libx264","-preset","veryfast",
                 "-crf","24","-c:a","copy","-pix_fmt","yuv420p",
                 "-movflags","+faststart",str(final)],timeout=300)
            meta=metadata(final)
            video=next((s for s in meta["streams"] if s["codec_type"]=="video"),None)
            audio=next((s for s in meta["streams"] if s["codec_type"]=="audio"),None)
            length=float(meta["format"]["duration"])
            if not video or not audio or video["codec_name"]!="h264" or audio["codec_name"]!="aac" or (video["width"],video["height"])!=(W,H) or abs(length-d)>0.8: raise RuntimeError("AV QA failed")
            outputs[variant]={"file":final.name,"duration_sec":length,"sha256":hashlib.sha256(final.read_bytes()).hexdigest(),"resolution":"1080x1920","video":"h264","audio":"aac","cuts":len(shots),"published":False}
    result={"status":"DRAFT_REVIEW_ONLY","variants":outputs,"engine":"Kokoro+FFmpeg; no per-video API credits","license":cfg["license"],"sources":cfg["assets"]}
    (outdir/"QA.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    return result

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--script",type=Path,required=True);p.add_argument("--media-dir",type=Path,required=True)
    p.add_argument("--voice",type=Path,required=True);p.add_argument("--srt",type=Path,required=True)
    p.add_argument("--outdir",type=Path,required=True);p.add_argument("--check",action="store_true")
    a=p.parse_args(); cfg=json.loads(a.script.read_text(encoding="utf-8"))
    print(json.dumps({"variants":list(cfg.get("variants",{})),"sources":len(cfg.get("assets",{}))}
                     if a.check else render(cfg,a.media_dir,a.voice,a.srt,a.outdir)))
