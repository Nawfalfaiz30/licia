export type ImportRecord = Record<string, unknown>;

export function parseCsv(text: string): ImportRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i], next=text[i+1];
    if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===","&&!quoted){row.push(cell);cell="";continue;}
    if((ch==="\\n"||ch==="\\r")&&!quoted){
      if(ch==="\\r"&&next==="\\n")i++;
      row.push(cell);cell="";
      if(row.some(Boolean))rows.push(row);
      row=[];
      continue;
    }
    cell+=ch;
  }
  if(cell||row.length){row.push(cell);if(row.some(Boolean))rows.push(row);}
  const headers=(rows.shift()||[]).map(x=>x.trim().toLowerCase());
  return rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));
}

export function parseIcs(text: string): ImportRecord[] {
  const unfolded=text.replace(/\\r?\\n[ \\t]/g,"");
  return unfolded.split("BEGIN:VEVENT").slice(1).map(chunk=>{
    const block=chunk.split("END:VEVENT")[0];
    const get=(key:string)=>{
      const line=block.split(/\\r?\\n/).find(item=>item.startsWith(key));
      return line?.split(":").slice(1).join(":")||"";
    };
    return { title:get("SUMMARY"), description:get("DESCRIPTION"), start:get("DTSTART"), end:get("DTEND"), uid:get("UID") };
  }).filter(row=>row.title||row.start||row.uid);
}

export function markdownToRecords(text:string): ImportRecord[] {
  return text.split(/\\r?\\n(?=\\s*#{1,3}\\s)/).map(block=>{
    const lines=block.split(/\\r?\\n/);
    const heading=(lines.find(x=>/^\\s*#{1,3}\\s+/.test(x))||"").replace(/^\\s*#{1,3}\\s+/,"").trim();
    return { title:heading, content:lines.filter(x=>!/^\\s*#{1,3}\\s+/.test(x)).join("\\n").trim() };
  }).filter(x=>x.title||x.content);
}
