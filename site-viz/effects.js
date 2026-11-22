/**
 * Local-bundle progressive enhancements. These never modify CTA, legal text,
 * registration, consent, price, navigation or site state.
 */
import {animate as motionAnimate} from "motion/mini";
import {animate as animeAnimate, stagger} from "animejs";
const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function visible(node,fn){
 if(!node)return;
 if(!("IntersectionObserver" in window)){fn();return}
 const obs=new IntersectionObserver(entries=>{
  if(entries.some(e=>e.isIntersecting)){obs.disconnect();fn()}
 },{threshold:.1});obs.observe(node)
}
function start(){
 if(reduced())return;
 [
  document.querySelector(".dm-ux-home #druzina .dm-hero-essentials"),
  document.querySelector(".dm-ux-ranks .dm-ranks-summary"),
  document.querySelector(".dm-ux-ranks .dm-rank-viz-section")
 ].forEach(node=>visible(node,()=>{
  try{motionAnimate(node,{opacity:[.87,1],transform:["translateY(12px)","translateY(0px)"]},{duration:.58})}
  catch(_){/* progressive only; HTML content stays visible */}
 }));
 [
  document.querySelectorAll(".dm-ux-home .dm-hero-key"),
  document.querySelectorAll(".dm-ux-ranks .dm-ranks-explainer > div")
 ].forEach(nodes=>{
  if(!nodes.length)return;
  visible(nodes[0],()=>{
   try{animeAnimate(nodes,{opacity:[.76,1],translateY:[8,0],delay:stagger(95),duration:520})}
   catch(_){/* progressive only */}
  })
 })
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
