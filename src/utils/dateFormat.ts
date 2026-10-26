const pad = (value:number) => String(value).padStart(2,'0');

function validDate(year:number,month:number,day:number):boolean {
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return month>=1&&month<=12&&day>=1&&day<=days[month-1];
}

// Date-only market observations are calendar dates, not UTC instants.
export function formatDate(value:string|null|undefined):string {
  const match=typeof value==='string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match||!validDate(Number(match[1]),Number(match[2]),Number(match[3]))) return 'Unavailable';
  return `${match[2]}/${match[3]}/${match[1]}`;
}

export function parseUSDate(value:string):string|null {
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if(!match||!validDate(Number(match[3]),Number(match[1]),Number(match[2]))) return null;
  return `${match[3]}-${match[1]}-${match[2]}`;
}

export function formatDateTime(value:string):string {
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return 'Unavailable';
  const day=`${pad(date.getMonth()+1)}/${pad(date.getDate())}/${String(date.getFullYear()).padStart(4,'0')}`;
  return `${day}, ${date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}`;
}
