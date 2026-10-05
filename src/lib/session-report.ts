export type SessionReportLoad = { block: string; weight: number | null; sets: number | null; reps: number | null; rpe: number | null; notes: string | null };
export type SessionReportWod = { name: string; type: string; scale: string; result: string; status: string; isPr: boolean };
export type SessionReportInput = { title: string; date: string; rpe: number | null; loads: SessionReportLoad[]; wods: SessionReportWod[] };

function encode(text: string): string {
  const map: Record<string, number> = {"á":225,"é":233,"í":237,"ó":243,"ú":250,"ü":252,"ñ":241,"Á":193,"É":201,"Í":205,"Ó":211,"Ú":218,"Ü":220,"Ñ":209,"¿":191,"¡":161,"·":183,"—":151};
  return Array.from(text).map((c) => { const n=c.charCodeAt(0); return (n <= 127 ? n : (map[c] ?? 63)).toString(16).padStart(2,"0"); }).join("").toUpperCase();
}
function wrap(text: string, max = 88): string[] {
  const out:string[]=[]; let cur="";
  for (const word of text.split(/\s+/)) { if ((cur+" "+word).trim().length > max) { if(cur) out.push(cur); cur=word; } else cur=(cur+" "+word).trim(); }
  if(cur) out.push(cur); return out;
}
export function buildSessionReportPdf(input: SessionReportInput): Uint8Array {
  const lines = ["RM OR DIE","RESUMEN DE SESIÓN",input.title,input.date,"","RPE GENERAL",input.rpe != null ? input.rpe.toFixed(1) : "No registrado","","CARGAS REALES"];
  const loads=input.loads.filter(l=>l.weight!=null||l.reps!=null||l.sets!=null);
  if(!loads.length) lines.push("No se registraron cargas.");
  for(const l of loads){
    lines.push([l.block,l.weight!=null?l.weight+" kg":"sin carga",l.sets!=null?l.sets+" series":"",l.reps!=null?l.reps+" reps":"",l.rpe!=null?"RPE "+l.rpe:""].filter(Boolean).join(" · "));
    if(l.notes) lines.push(...wrap("Notas: "+l.notes,82));
  }
  lines.push("","RESULTADO DEL WOD");
  if(!input.wods.length) lines.push("No se registró resultado de WOD.");
  for(const w of input.wods){ lines.push(w.name+" · "+w.scale.toUpperCase(), "Resultado: "+w.result, "Estado: "+w.status+(w.isPr?" · PR":"")); }
  lines.push("","TRANSFERENCIA PARA ENTRENADOR","Informe generado al finalizar la sesión con RPE general, resultado del WOD y cargas realmente utilizadas.");
  const W=595,H=842,L=42,T=800,B=42,LH=13,MAX=Math.floor((T-B)/LH);
  const pages:string[][]=[]; for(let i=0;i<lines.length;i+=MAX) pages.push(lines.slice(i,i+MAX));
  const objs:string[]=[]; objs[1]="<< /Type /Catalog /Pages 2 0 R >>"; objs[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"; const ids:number[]=[];
  pages.forEach((pl,pi)=>{ const pid=4+pi*2,cid=pid+1; ids.push(pid); const stream=["BT","/F1 9 Tf",L+" "+T+" Td",...pl.map((line,i)=>(i?"0 -"+LH+" Td\\n":"")+"<"+encode(line)+"> Tj"),"ET"].join("\n"); objs[cid]="<< /Length "+stream.length+" >>\nstream\n"+stream+"\nendstream"; objs[pid]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+W+" "+H+"] /Resources << /Font << /F1 3 0 R >> >> /Contents "+cid+" 0 R >>"; });
  objs[2]="<< /Type /Pages /Kids ["+ids.map(id=>id+" 0 R").join(" ")+"] /Count "+ids.length+" >>";
  let pdf="%PDF-1.4\n%RMOR\n"; const offsets:number[]=[0];
  for(let i=1;i<objs.length;i++){if(!objs[i])continue; offsets[i]=pdf.length; pdf+=i+" 0 obj\n"+objs[i]+"\nendobj\n";}
  const x=pdf.length; pdf+="xref\n0 "+objs.length+"\n0000000000 65535 f \n"; for(let i=1;i<objs.length;i++) pdf+=String(offsets[i]??0).padStart(10,"0")+" 00000 n \n";
  pdf+="trailer\n<< /Size "+objs.length+" /Root 1 0 R >>\nstartxref\n"+x+"\n%%EOF"; return new TextEncoder().encode(pdf);
}
export function downloadSessionReport(input: SessionReportInput): void { const blob=new Blob([buildSessionReportPdf(input) as unknown as BlobPart],{type:"application/pdf"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="rmordie-session-report-"+new Date().toISOString().slice(0,10)+".pdf"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000); }