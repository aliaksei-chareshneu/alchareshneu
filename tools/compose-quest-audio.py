# Original fantasy ambient music for Druzina Moravy. No external samples or melodies.
# License: created entirely by code from mathematical oscillators and generated noise.
from pathlib import Path
import wave,subprocess
import numpy as np
from scipy.signal import lfilter
R=Path(__file__).resolve().parents[1]
sr=32000; bpm=72; beat=60/bpm; bar=beat*3; dur=32*bar
n=int(sr*dur); out=np.zeros((n,2),dtype=np.float32);rng=np.random.default_rng(18)
def note(p,t,l,k="pad",v=.05,pan=0):
 a=max(0,int(t*sr)); z=min(n,int((t+l)*sr))
 if z<=a:return
 x=np.arange(z-a,dtype=np.float32)/sr;hz=440*2**((p-69)/12)
 ph=2*np.pi*hz*x+.0013*np.sin(2*np.pi*4.7*x)
 if k=="pad":
  sig=np.sin(ph)+.29*np.sin(ph*2)+.1*np.sin(ph*3)
  env=(1-np.exp(-x/.65))*np.clip((l-x)/1.1,0,1)
 elif k=="flute":
  sig=np.sin(ph)+.12*np.sin(ph*2)
  env=(1-np.exp(-x/.13))*np.clip((l-x)/.37,0,1)
 elif k=="harp":
  sig=np.sin(ph)+.28*np.sin(ph*2)
  env=(1-np.exp(-x/.012))*np.exp(-x/1.3)
 elif k=="bass":
  sig=np.sin(ph)+.2*np.sin(ph*2)
  env=(1-np.exp(-x/.22))*np.clip((l-x)/.55,0,1)
 else:
  sig=np.sin(ph)+.2*np.sin(ph*2.01)
  env=np.exp(-x/2.0)
 y=(sig*env*v).astype(np.float32)
 out[a:z,0]+=y*np.sqrt((1-pan)*.5);out[a:z,1]+=y*np.sqrt((1+pan)*.5)
chords=[([50,53,57],38),([46,50,53],34),([48,53,57],41),([48,52,55],36),([43,46,50],31),([46,50,53],34),([50,53,57],38),([45,50,52],33)]
mel=[[74,77,76,74,69,72],[70,74,77,74,72,70],[72,77,79,77,74,72],[76,79,76,74,72,67],[70,74,72,70,67,70],[74,77,79,77,74,72],[74,81,79,77,76,74],[76,74,72,69,72,73]]
for i,(ch,root) in enumerate(chords):
 t=i*4*bar
 for j,p in enumerate(ch):
  note(p,t,4*bar+.3,"pad",.045,[-.5,0,.5][j]);note(p+12,t+.15,4*bar,"pad",.013,.3)
 note(root,t,4*bar+.1,"bass",.028)
 ar=[ch[0]+12,ch[1]+12,ch[2]+12,ch[1]+12,ch[0]+24,ch[2]+12]
 for k in range(12):note(ar[(k+i)%6],t+k*beat+.12,2,"harp",.026,.43 if k%2 else -.43)
 for k,p in enumerate(mel[i]):note(p,t+.65+k*1.67*beat,1.23*beat if k%3 else 1.8*beat,"flute",.031,.20)
 if i in (0,4): note(ch[2]+24,t+2*bar,3.5,"bell",.013,.4)
 for b in range(4):
  a=int((t+b*bar)*sr);z=min(n,a+int(.48*sr));x=np.arange(z-a,dtype=np.float32)/sr
  f=52+36*np.exp(-x/.09);phi=2*np.pi*np.cumsum(f)/sr
  drum=np.sin(phi)*np.exp(-x*17)*(.014 if b else .025)
  out[a:z]+=drum[:,None]
wind=lfilter([.004],[1,-.996],rng.standard_normal(n).astype(np.float32)).astype(np.float32)
out[:,0]+=wind*.018;out[:,1]+=np.roll(wind,int(.17*sr))*.015
# Gentle in-room echo to create a northern hall ambience.
dry=out.copy()
for t,g in ((.17,.12),(.34,.085),(.63,.06),(1.13,.035)):
 lag=int(t*sr)
 out[lag:,0]+=dry[:-lag,1]*g;out[lag:,1]+=dry[:-lag,0]*g
f=int(2.0*sr);ramp=np.sin(np.linspace(0,np.pi/2,f,dtype=np.float32))**2
out[:f]*=ramp[:,None];out[-f:]*=ramp[::-1,None]
out*=.78/max(.01,float(np.max(np.abs(out))))
target=R/"media"/"druzina-quest-ambient.ogg";temp=target.with_suffix(".wav")
with wave.open(str(temp),"wb") as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(out,-.98,.98)*32767).astype("<i2").tobytes())
subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error","-i",str(temp),"-c:a","libvorbis","-q:a","4",str(target)],check=True)
temp.unlink()
print(f"DURATION={dur:.1f}s SIZE={target.stat().st_size} OGG={target}")
