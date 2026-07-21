import { commandLine, decideAutomaticLight } from "./policy.mjs";
const ids=["mode","distance","pot","light","expression","confidence","lightDirection"];
const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
const view=Object.fromEntries(["distanceOut","potOut","lightOut","confidenceOut","decision","command","ring","rgb","brightness","action"].map(id=>[id,document.getElementById(id)]));
let lastApplied={color:[0,0,0],brightness:0,action:"hold"};
function render(){
  view.distanceOut.value=`${el.distance.value} cm`;view.potOut.value=el.pot.value;view.lightOut.value=el.light.value;view.confidenceOut.value=`${Math.round(el.confidence.value*100)}%`;
  const decision=decideAutomaticLight({mode:el.mode.value,distance:Number(el.distance.value),pot:Number(el.pot.value),light:Number(el.light.value),expression:el.expression.value,confidence:Number(el.confidence.value)},{lightDirection:el.lightDirection.value});
  const line=commandLine(decision);view.decision.textContent=decision.reason;view.command.textContent=line?.trim()||"명령을 보내지 않고 이전 상태 유지";
  if(decision.action!=="hold")lastApplied={...decision,color:decision.color||[0,0,0],brightness:decision.brightness||0};
  const [r,g,b]=lastApplied.color;const strength=lastApplied.brightness/80;view.ring.style.setProperty("--color",`rgb(${r},${g},${b})`);view.ring.style.setProperty("--glow",`${Math.round(strength*45)}px`);view.ring.style.opacity=String(.25+.75*strength);
  view.ring.setAttribute("aria-label",`RGB ${r}, ${g}, ${b}, 밝기 ${lastApplied.brightness}`);view.rgb.textContent=`${r}, ${g}, ${b}`;view.brightness.textContent=`${lastApplied.brightness} / 80`;view.action.textContent=decision.action;
}
ids.forEach(id=>el[id].addEventListener("input",render));
window.updateExpressionPrediction=(label,confidence)=>{el.expression.value=label||"";el.confidence.value=confidence||0;render();};render();
