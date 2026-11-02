"""Original reproducible educational Short: synthetic CSV duplicates -> wrong total.

No copyrighted media, personal customer data, copied YouTube footage, or paid API.
Delivers actual MP4, matching SHA-256 manifest, code example and platform copy.
"""
from __future__ import annotations
import hashlib
import json
import math
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HOME=Path.home()
OUT=HOME/"MoravianHost"/"MediaMachine"/"Drafts"/"ShortFactory"/"review-20261102"
OUT.mkdir(parents=True,exist_ok=True)
W,H=1080,1920
BG=(11,20,35)
WHITE=(245,248,255)
MUTED=(156,173,195)
TEAL=(67,226,194)
AMBER=(255,190,94)
RED=(255,110,117)
FONT="C:/Windows/Fonts/segoeui.ttf"
MONO="C:/Windows/Fonts/consola.ttf"
rows=[("A101","50 Kč"),("A102","40 Kč"),("A103","70 Kč"),("A101","50 Kč")]
assert sum([50,40,70,50])==210 and sum([50,40,70])==160

def font(n:int, mono:bool=False):
    return ImageFont.truetype(MONO if mono else FONT,n)

def rounded(draw,box,fill,border=None,radius=24,width=2):
    draw.rounded_rectangle(box,radius=radius,fill=fill,outline=border,width=width if border else 1)

def text(draw,xy,value,px=50,fill=WHITE,mono=False,spacing=10):
    draw.multiline_text(xy,value,font=font(px,mono),fill=fill,spacing=spacing,stroke_width=0)

def frame(idx:int,n:int)->tuple[Image.Image,ImageDraw.ImageDraw]:
    im=Image.new("RGB",(W,H))
    p=im.load()
    for y in range(H):
        a=y/(H-1)
        c=(int(11+7*a),int(20+11*a),int(35+14*a))
        for x in range(W):p[x,y]=c
    d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,16),fill=TEAL)
    text(d,(76,65),"IMPERION / DATA QUALITY",30,TEAL)
    text(d,(76,116),"PYTHON • QUICK LAB",27,MUTED,mono=True)
    d.line((74,188,W-74,188),fill=(56,75,99),width=3)
    for k in range(n):
        x0=75+k*189
        rounded(d,(x0,1820,x0+165,1830),TEAL if k<=idx else (65,77,96),radius=6)
    text(d,(74,1855),"SYNTHETIC EXAMPLE  •  NO CUSTOMER DATA",23,MUTED)
    return im,d

def boxlines(d,head,body,c=(22,38,56)):
    rounded(d,(65,535,1015,1535),c,(57,76,96),32,3)
    text(d,(115,585),head,42,TEAL)
    text(d,(115,670),body,39)

def render_frames():
    frames=[]
    for i in range(5):
        im,d=frame(i,5)
        if i==0:
            text(d,(74,290),"ONE DUPLICATE\nCAN BREAK A\nDASHBOARD",78)
            rounded(d,(75,680,1005,1200),(22,43,62),(55,83,108),32,3)
            text(d,(138,765),"CSV EXPORT",45,MUTED,mono=True)
            text(d,(138,885),"4 rows   →   3 orders",59,WHITE)
            rounded(d,(135,1005,925,1128),(85,35,47),radius=18)
            text(d,(165,1030),"CHECK BEFORE REPORTING",42,AMBER)
            text(d,(78,1360),"The error can hide in a clean chart.",42,MUTED)
        elif i==1:
            text(d,(76,275),"FIND THE DUPLICATE",69)
            rounded(d,(75,480,1005,1440),(19,34,50),(54,76,94),26,2)
            text(d,(123,550),"order_id        amount",46,TEAL,mono=True)
            d.line((110,625,975,625),fill=(68,89,110),width=3)
            for j,(ident,price) in enumerate(rows):
                top=670+j*168
                if j==3:rounded(d,(105,top-22,970,top+125),(84,37,45),radius=17)
                text(d,(135,top),ident,52,RED if j==3 else WHITE,mono=True)
                text(d,(735,top),price,52,RED if j==3 else WHITE,mono=True)
            text(d,(113,1380),"A101 appears twice!",43,AMBER)
            text(d,(75,1550),"Same order ID, wrong total.",39,MUTED)
        elif i==2:
            text(d,(75,285),"SEE THE DIFFERENCE",65)
            rounded(d,(70,540,1010,920),(89,43,51),radius=29)
            text(d,(127,585),"RAW SUM",42,MUTED)
            text(d,(127,670),"210 Kč",102,WHITE)
            rounded(d,(70,1000,1010,1380),(23,73,68),radius=29)
            text(d,(127,1040),"UNIQUE ORDERS",43,TEAL)
            text(d,(127,1140),"160 Kč",102,WHITE)
            text(d,(105,1500),"+50 Kč due to a duplicate",41,AMBER)
        elif i==3:
            text(d,(73,290),"CHECK IT IN PYTHON",67)
            rounded(d,(70,530,1010,1300),(18,29,45),(61,84,113),28,2)
            text(d,(120,605),'import pandas as pd',40,TEAL,mono=True)
            text(d,(120,730),'df = pd.read_csv(',40,WHITE,mono=True)
            text(d,(138,795),'"orders.csv")',40,WHITE,mono=True)
            text(d,(120,925),'assert df["order_id"]',36,AMBER,mono=True)
            text(d,(138,985),'.is_unique',42,AMBER,mono=True)
            rounded(d,(112,1135,955,1225),(97,45,50),radius=18)
            text(d,(146,1153),"FAIL FAST IF DUPLICATED",36,WHITE)
            text(d,(85,1400),"Stop bad input before a report.",39,MUTED)
        else:
            text(d,(74,265),"ONE SMALL CHECK.\nONE BETTER REPORT.",66,WHITE)
            rounded(d,(75,565,1005,1200),(21,57,65),TEAL,26,3)
            text(d,(128,645),"PRACTICAL AI / PYTHON",44,TEAL)
            text(d,(128,745),"DATA AUTOMATION\nFOR TEAMS",60,WHITE)
            text(d,(128,1035),"Fixed scope. Tested output.",38,MUTED)
            rounded(d,(76,1340,1004,1470),TEAL,radius=21)
            text(d,(150,1372),"PILOT DETAILS IN DESCRIPTION",40,(7,35,38))
            text(d,(84,1550),"aliaksei-chareshneu.github.io",34,MUTED)
        image=OUT/f"csv_quality_scene_{i+1}.png"
        im.save(image,optimize=True)
        frames.append(image)
    return frames

def run(args:list[str])->str:
    p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=120)
    if p.returncode!=0:raise RuntimeError("Command failed: "+" ".join(args[:3])+"\n"+p.stderr[-2000:])
    return p.stdout

def narration() -> Path:
    dest=OUT/"csv_quality_english.wav"
    if dest.exists():return dest
    spoken=("A dashboard can be wrong even when the chart looks perfect. "
            "In this synthetic example, four CSV rows represent only three orders. "
            "One duplicate inflates the total from one hundred sixty to two hundred ten crowns. "
            "In Python, assert that order IDs are unique before reporting. "
            "Need a scoped data validation pilot? Details in the description.")
    script=("Add-Type -AssemblyName System.Speech; "
            "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$s.SelectVoice('Microsoft David Desktop'); "
            "$s.Rate=2; "
            "$s.SetOutputToWaveFile('"+str(dest).replace("'","''")+"'); "
            "$s.Speak('"+spoken.replace("'","''")+"'); $s.Dispose()")
    run(["powershell.exe","-NoProfile","-Command",script])
    if not dest.exists():raise RuntimeError("Local voice failed")
    return dest

def main():
    ffmpeg=shutil.which("ffmpeg");ffprobe=shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:raise RuntimeError("Required FFmpeg tools missing")
    frames=render_frames()
    voice=narration()
    probe=json.loads(run([ffprobe,"-v","error","-show_entries","format=duration","-of","json",str(voice)]))
    secs=float(probe["format"]["duration"])
    duration=max(25.0,math.ceil(secs+1.2))
    if duration>33.0:raise RuntimeError("Narration too long to make this Short without rewriting")
    times=[duration*x for x in (0.17,0.22,0.22,0.21,0.18)]
    timeline=OUT/"csv_quality_sequence.txt"
    with timeline.open("w",encoding="utf-8") as f:
        for image,t in zip(frames,times):
            f.write("file '"+str(image).replace("'","'\\''")+"'\n")
            f.write("duration "+f"{t:.4f}"+"\n")
        f.write("file '"+str(frames[-1])+"'\n")
    silent=OUT/"csv_quality_silent.mp4"
    out=OUT/"imperion_csv_validation_original_en.mp4"
    run([ffmpeg,"-y","-hide_banner","-loglevel","error","-safe","0","-f","concat","-i",str(timeline),
         "-vf","fps=24,format=yuv420p","-an","-c:v","libx264","-preset","veryfast",
         "-crf","20","-movflags","+faststart","-t",str(duration),str(silent)])
    run([ffmpeg,"-y","-hide_banner","-loglevel","error","-i",str(silent),"-i",str(voice),
         "-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","160k",
         "-af","apad","-t",str(duration),"-movflags","+faststart",str(out)])
    meta=json.loads(run([ffprobe,"-v","error","-show_entries",
      "format=duration,size:stream=codec_name,codec_type,width,height","-of","json",str(out)]))
    if not any(s.get("codec_type")=="video" and s.get("codec_name")=="h264" and s.get("width")==W and s.get("height")==H for s in meta["streams"]):
        raise RuntimeError("Final media video codec/dimensions failed")
    if not any(s.get("codec_type")=="audio" and s.get("codec_name")=="aac" for s in meta["streams"]):
        raise RuntimeError("Final audio codec failed")
    sha=hashlib.sha256(out.read_bytes()).hexdigest()
    manifest={
      "stage":"MEDIA_RENDERED_QC_PASSED_PUBLICATION_NOT_YET_ATTEMPTED",
      "content_type":"original_python_data_validation_tutorial",
      "source":"original_synthetic_example_4_rows_3_unique_orders",
      "data_real":False,"rights":"original_graphics_and_local_windows_tts",
      "music":"none","contains_people":False,
      "publisher":"OSVC Aliaksei Chareshneu",
      "title":"One CSV duplicate ruins a dashboard | Python data validation",
      "file":str(out),"sha256":sha,"size":out.stat().st_size,
      "duration":meta["format"]["duration"],"audio":"local Windows TTS",
      "platform":"youtube_shorts,facebook_reels",
      "cta_page":"https://aliaksei-chareshneu.github.io/alchareshneu/corporate/",
      "publish_status":"NOT_PUBLISHED",
      "original_code_snippet":'assert df["order_id"].is_unique'
    }
    (OUT/"imperion_csv_validation_original_en.mp4.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    print(json.dumps({"path":str(out),"bytes":manifest["size"],"duration":manifest["duration"],"sha256":sha,"quality":"QC_PASSED","voice_seconds":secs}))
if __name__=="__main__":
    main()
