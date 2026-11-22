/**
 * Locally owned shadcn-style ChartContainer/ChartTooltipContent composed
 * with Recharts v3. Counts refer ONLY to published rules, not attendance,
 * payments, actual ranks or members. The unchanged static HTML is fallback.
 */
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {ResponsiveContainer,BarChart,Bar,Cell,CartesianGrid,XAxis,YAxis,Tooltip,LabelList} from "recharts";
const data=[
 {key:"B",number:7,color:"#9e714a",kind:"rank"},
 {key:"C",number:7,color:"#477c8b",kind:"rank"},
 {key:"K",number:7,color:"#798e62",kind:"rank"},
 {key:"A",number:10,color:"#8974a3",kind:"award"}
];
const translations={
 cs:{heading:"Mapa systému hodností",intro:"Počet úrovní v publikovaných pravidlech, nikoli výsledky účastníků.",one:"Kvalifikace B / C / K",all:"Také ocenění A",group:"Zobrazení grafu",unit:"schválených kategorií",B:"B · Boj",C:"C · Velení",K:"K · Řemeslo",A:"A · Ocenění",disclaimer:"Nejde o získané hodnosti, návštěvy, členství ani platby. Kvalifikace se ověřuje podle pravidel."},
 en:{heading:"Explore the rank system",intro:"Published rules, not participant results.",one:"B / C / K qualifications",all:"Include A achievements",group:"Chart view",unit:"published categories",B:"B · Combat",C:"C · Command",K:"K · Craft",A:"A · Achievements",disclaimer:"Not earned ranks, attendance, memberships or payments. Qualifications require verification under the full rules."},
 ru:{heading:"Карта системы званий",intro:"Число уровней в правилах, а не результаты участников.",one:"Квалификации B / C / K",all:"Включая достижения A",group:"Вид графика",unit:"утверждённых категорий",B:"B · Бой",C:"C · Командование",K:"K · Ремесло",A:"A · Достижения",disclaimer:"Не отражает полученные звания, посещения, членство или оплату. Квалификации проверяются по полным правилам."},
 uk:{heading:"Мапа системи звань",intro:"Кількість рівнів у правилах, а не результати учасників.",one:"Кваліфікації B / C / K",all:"З досягненнями A",group:"Вигляд графіка",unit:"затверджених категорій",B:"B · Бій",C:"C · Командування",K:"K · Ремесло",A:"A · Досягнення",disclaimer:"Не відображає здобуті звання, відвідування, членство чи оплату. Кваліфікації перевіряють за правилами."},
 be:{heading:"Мапа сістэмы званняў",intro:"Колькасць узроўняў у правілах, не вынікі ўдзельнікаў.",one:"Кваліфікацыі B / C / K",all:"З дасягненнямі A",group:"Выгляд графіка",unit:"зацверджаных катэгорый",B:"B · Бой",C:"C · Камандаванне",K:"K · Рамяство",A:"A · Дасягненні",disclaimer:"Не паказвае атрыманыя званні, наведванні, сяброўства ці аплату. Кваліфікацыі правяраюцца паводле правілаў."},
 sk:{heading:"Mapa systému hodností",intro:"Počet úrovní v pravidlách, nie výsledky účastníkov.",one:"Kvalifikácie B / C / K",all:"Vrátane úspechov A",group:"Zobrazenie grafu",unit:"schválených kategórií",B:"B · Boj",C:"C · Velenie",K:"K · Remeslo",A:"A · Úspechy",disclaimer:"Nejde o získané hodnosti, účasti, členstvo ani platby. Kvalifikácie sa overujú podľa pravidiel."}
};
const currentLang=()=>{let l=document.documentElement.lang.toLowerCase().slice(0,2);return translations[l]?l:"cs"};
function ChartContainer({children,description}){
 return <div className="dm-viz-chart" data-chart="ranks" role="img" aria-label={description}>
  <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
 </div>
}
function ChartTooltipContent({active,payload,t}){
 if(!active||!payload?.length)return null;
 const entry=payload[0].payload;if(!entry)return null;
 return <div className="dm-viz-tooltip" role="tooltip"><strong>{t[entry.key]}</strong><span>{entry.number} {t.unit}</span></div>
}
function Diagram({lang}){
 const [awards,setAwards]=useState(false),t=translations[lang]||translations.cs;
 const bars=awards?data:data.slice(0,3);
 return <div className="dm-viz-app">
  <div className="dm-viz-head"><div><h2 id="dm-rank-viz-title">{t.heading}</h2><p>{t.intro}</p></div>
   <div className="dm-viz-tabs" role="group" aria-label={t.group}>
    <button type="button" aria-pressed={!awards} onClick={()=>setAwards(false)}>{t.one}</button>
    <button type="button" aria-pressed={awards} onClick={()=>setAwards(true)}>{t.all}</button>
   </div>
  </div>
  <ChartContainer description={t.heading+". "+bars.map(b=>t[b.key]+": "+b.number).join("; ")}>
   <BarChart data={bars} margin={{top:22,right:12,bottom:4,left:0}} accessibilityLayer>
    <CartesianGrid vertical={false} stroke="#d1d9dd" strokeDasharray="3 5"/>
    <XAxis dataKey="key" axisLine={false} tickLine={false} tick={{fill:"#294158",fontSize:14,fontWeight:700}}/>
    <YAxis domain={[0,11]} allowDecimals={false} width={35} tick={{fill:"#526578",fontSize:12}}/>
    <Tooltip content={props=><ChartTooltipContent {...props} t={t}/>} cursor={{fill:"rgba(135,151,169,.1)"}}/>
    <Bar dataKey="number" maxBarSize={76} radius={[8,8,0,0]} isAnimationActive={false}>
     {bars.map(b=><Cell key={b.key} fill={b.color}/>)}
     <LabelList dataKey="number" position="top" fill="#1d3044" fontSize={15} fontWeight={700}/>
    </Bar>
   </BarChart>
  </ChartContainer>
  <p className="dm-viz-note">{t.disclaimer}</p>
 </div>
}
function init(){
 const node=document.getElementById("dm-rank-visualisation");if(!node)return;
 try{
  const root=createRoot(node);
  const render=()=>root.render(<Diagram lang={currentLang()}/>);
  render();
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
 }catch(_){/* HTML summary remains readable when chart fails */}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
