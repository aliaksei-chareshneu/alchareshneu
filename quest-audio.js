/* Družina original fantasy background score. Never autoplay; works without cookies. */
(()=>{
"use strict";
const audio=document.getElementById("questAudio");
const btn=document.querySelector("[data-quest-audio-toggle]");
if(!audio||!btn)return;
audio.volume=.30;
const msgs={
 cs:["Zapnout hudbu na pozadí","Vypnout hudbu na pozadí"],
 en:["Play original fantasy ambience","Pause background music"],
 ru:["Включить фэнтези-музыку","Выключить музыку"],
 uk:["Увімкнути фентезі-музику","Вимкнути музику"]
};
let playing=false;
function sync(){
 const lang=(document.documentElement.lang||"cs").slice(0,2).toLowerCase();
 const message=(msgs[lang]||msgs.en)[playing?1:0];
 btn.setAttribute("aria-pressed",String(playing));
 btn.setAttribute("aria-label",message);
 btn.setAttribute("title",message);
 btn.textContent=playing?"♫":"♪";
}
btn.addEventListener("click",async()=>{
 if(!audio.paused){audio.pause();playing=false;sync();return;}
 try{audio.volume=.30;await audio.play();playing=true;}
 catch(_){playing=false;}
 sync();
});
audio.addEventListener("pause",()=>{playing=false;sync()});
audio.addEventListener("playing",()=>{playing=true;sync()});
audio.addEventListener("ended",()=>{playing=false;sync()});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&!audio.paused)audio.pause()});
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
sync();
})();
