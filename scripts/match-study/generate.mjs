// Synthetic, seeded student requests. Never reads production posts or identities.
export const SEED=20260911;
export function random(seed=SEED){let s=seed;return ()=>{s|=0;s=s+0x6d2b79f5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export const roman=['','I','II','III','IV','V','VI'];
const cn=['','一','二','三','四','五','六'];
const types=['hall','goods','study','transport','other'];
const styles=['en-formal','en-casual','zh-CN','zh-HK','mixed','en-typos'];
const objects=[['calculator','计算器','計算機'],['desk lamp','台灯','枱燈'],['bike','单车','單車'],['kettle','水壶','水壺'],['monitor','显示器','螢幕'],['guitar','吉他','結他'],['FINA 2203 textbook','FINA 2203 课本','FINA 2203 課本'],['chair','椅子','凳']];
const places=[['HKUST','科大','科大'],['Hang Hau','坑口','坑口'],['Airport','机场','機場'],['Mong Kok','旺角','旺角'],['Tseung Kwan O','将军澳','將軍澳'],['Kowloon Tong','九龙塘','九龍塘']];
export function generate(){
 const rng=random();const pick=a=>a[Math.floor(rng()*a.length)];const integer=(a,b)=>a+Math.floor(rng()*(b-a+1));
 const hallName=n=>pick([`Hall ${roman[n]}`,`Hall ${n}`,`hall${n}`,`${cn[n]}舍`,`HALL ${roman[n]}`,`Hall\u2006${n}`]);
 const students=Array.from({length:500},(_,i)=>({id:`student-${String(i).padStart(3,'0')}`,style:styles[i%styles.length],postCount:5+i%6,year:1+i%5,postingHabit:pick(['brief','chatty','careful','distracted'])}));
 const posts=[];
 for(const student of students)for(let i=0;i<student.postCount;i++){
  const style=rng()<.22?pick(styles):student.style;const lang=style==='zh-CN'?1:style==='zh-HK'?2:0;
  const u=rng();const kind=u<.24?'hall':u<.46?'goods':u<.64?'study':u<.86?'transport':'other';
  const day=integer(14,20);const minute=pick([1080,1110,1140,1170,1200]);const date=`2026-09-${day}`;const time=`${Math.floor(minute/60)}:${String(minute%60).padStart(2,'0')}`;
  const truth={kind,actionable:rng()>=.12,date,minute};let en='',zh='',hk='',title='';let currentHall=null,targetHall=null;
  const stamp=[` on ${date} at ${time}.`,` ${date} ${time}。`,` ${date} ${time}。`];
  if(kind==='hall'){
   const from=integer(1,6);let to=integer(1,5);if(to>=from)to++;
   Object.assign(truth,{from,to,term:pick(['fall','spring']),room:pick(['single','double']),wantedRoom:pick(['single','double']),eligibility:pick(['female','male'])});
   currentHall=hallName(from);targetHall=hallName(to);
   const term=truth.term==='fall'?'秋季':'春季';const room=truth.room==='single'?'单人':'双人';const wanted=truth.wantedRoom==='single'?'单人':'双人';const gender=truth.eligibility==='female'?'女生':'男生';
   en=`I'm in ${currentHall}, looking for ${targetHall}. ${truth.room} to ${truth.wantedRoom}, ${truth.eligibility} eligibility, ${truth.term} semester only. Must use the official swap process.`;
   zh=`目前${currentHall}，想换去${targetHall}。${term}学期，${gender}，现在${room}房只考虑${wanted}房，按学校正规流程。`;
   hk=`而家住${currentHall}，想換${targetHall}。${term}學期，${gender}，${room.replace('单','單').replace('双','雙')}房換${wanted.replace('单','單').replace('双','雙')}房，會行學校程序。`;
   title=pick(['Hall swap','想换个宿舍','換 hall','any luck with this?','Need a change']);
  }else if(kind==='goods'){
   const object=pick(objects);Object.assign(truth,{object:object[0],side:pick(['offer','seek']),price:pick([80,100,150,200,250]),date:null,minute:null});
   const offer=truth.side==='offer';en=`${offer?'Selling my':'Looking to buy a'} ${object[0]}. ${offer?'Asking':'Budget up to'} HKD ${truth.price}. Campus pickup; please message if suitable.`;
   zh=`${offer?'出':'收'}${object[1]}，${offer?'要价':'预算上限'}${truth.price}港币，校内交收，有的话聊聊。`;
   hk=`${offer?'放':'收'}${object[2]}，${offer?'賣':'最多出'}${truth.price}蚊，校內交收，有冇人啱？`;
   title=pick([`${offer?'Have':'Need'} ${object[lang]}`,'有人要吗','still looking','求问一下','放啲嘢']);
  }else if(kind==='study'){
   Object.assign(truth,{course:pick(['COMP 2011','MATH 1013','FINA 2203','LANG 1406']),side:pick(['mentor','learner','peer']),communication:pick(['English','Chinese'])});
   en=`${truth.course}: ${truth.side==='mentor'?'I can explain the material':truth.side==='learner'?'I need someone to explain the material':'Looking for a revision buddy'}. Let's use ${truth.communication}`+stamp[0];
   zh=`${truth.course}，${truth.side==='mentor'?'可以帮忙讲解':truth.side==='learner'?'想找人给我讲讲':'找一起复习的同学'}，用${truth.communication==='English'?'英语':'中文'}交流`+stamp[1];
   hk=`${truth.course}，${truth.side==='mentor'?'可以教返你':truth.side==='learner'?'想搵人教下我':'想搵溫書伴'}，${truth.communication==='English'?'英文':'中文'}交流`+stamp[2];
   title=pick([truth.course,'救救','study anyone','溫書呀','this class...']);
  }else if(kind==='transport'){
   const from=pick([0,0,0,1,2]);let to=integer(0,5);if(to===from)to=(to+1)%6;
   Object.assign(truth,{from:places[from][0],to:places[to][0],side:pick(['share','share','driver','rider']),party:integer(1,3),seats:integer(1,3)});
   en=`${places[from][0]} to ${places[to][0]}`+stamp[0]+(truth.side==='driver'?`I can drive; ${truth.seats} seats available.`:truth.side==='rider'?`Need a ride for ${truth.party} people.`:`Share a taxi? There are ${truth.party} of us; standard four-passenger taxi.`);
   zh=`${places[from][1]}去${places[to][1]}`+stamp[1]+(truth.side==='driver'?`我开车，有${truth.seats}个空位。`:truth.side==='rider'?`求搭车，我们${truth.party}人。`:`拼出租吗？我们${truth.party}人，普通四客座的士。`);
   hk=`${places[from][2]}去${places[to][2]}`+stamp[2]+(truth.side==='driver'?`我揸車，有${truth.seats}個位。`:truth.side==='rider'?`想搭順風車，我哋${truth.party}個。`:`夾的士？我哋${truth.party}個，普通四客座的士。`);
   title=pick(['anyone going?','走不走','夾車','ride pls','一起吧']);
  }else{
   Object.assign(truth,{activity:pick(['basketball','piano','chess','coffee','hiking']),side:'peer',place:pick(['campus','Hang Hau'])});
   en=`Anyone up for ${truth.activity} near ${truth.place}`+stamp[0];zh=`想找人一起${truth.activity}，${truth.place}见`+stamp[1];hk=`有冇人想一齊${truth.activity}，${truth.place}見`+stamp[2];
   title=pick(['anyone free','来玩吗','有人吗','約個伴','a break']);
  }
  let body=[en,zh,hk][lang];
  if(style==='en-formal')body=`Hello everyone. ${body} Thank you for considering this request.`;
  if(style==='en-casual')body=body.toLowerCase().replaceAll('please','pls').replaceAll('people','ppl')+' haha dm if interested';
  if(style==='mixed')body=pick([en+' 有合适的私聊一下～',zh+' pls lmk if this works for u',hk+' anyone?']);
  if(style==='en-typos')body=body.toLowerCase().replaceAll('looking','lookin').replaceAll('available','availble').replaceAll('tomorrow','tmr')+' idk if right place to ask';
  if(rng()<.22)title=pick(['hi','求','??','lmk','小事','help','啊啊啊']);
  if(!truth.actionable){body=pick(['anyone here?','1','随便看看','有冇人呀','nice weather today','so tired...','海风好大','nvm']);title=pick(['hii','学习','听海','hey','...']);}
  let category=rng()<.27?pick(types.filter(t=>t!==kind)):kind;
  if(category==='hall'&&kind!=='hall'){currentHall=pick(['x','-','idk','Hall I']);targetHall=rng()<.7?currentHall:pick(['Hall II','x','?']);}
  if(category!=='hall'){currentHall=null;targetHall=null;}
  const payload={category,title,body,locationId:pick(['ug-hall-i','ug-hall-ii','ug-hall-iii','pg-hall-i']),currentHall,targetHall};
  posts.push({localId:`${student.id}-p${i+1}`,studentId:student.id,style,truth,payload});
 }
 // Interleave all students rather than giving the last few users the entire feed.
 for(let i=posts.length-1;i>0;i--){const j=integer(0,i);[posts[i],posts[j]]=[posts[j],posts[i]];}
 return {seed:SEED,students,posts};
}
// Latent-intent oracle: potential contacts, never guaranteed real-world success.
// Ground truth stays outside all matcher inputs.
export function compatible(a,b){
 if(a.studentId===b.studentId)return false;const x=a.truth,y=b.truth;
 if(!x.actionable||!y.actionable||x.kind!==y.kind)return false;
 if(x.kind==='hall')return x.from===y.to&&x.to===y.from&&x.term===y.term&&x.room===y.wantedRoom&&x.wantedRoom===y.room&&x.eligibility===y.eligibility;
 if(x.kind==='goods')return x.object===y.object&&x.side!==y.side&&(x.side==='offer'?x.price<=y.price:y.price<=x.price);
 if(x.date!==y.date||Math.abs(x.minute-y.minute)>30)return false;
 if(x.kind==='transport')return x.from===y.from&&x.to===y.to&&((x.side==='share'&&y.side==='share'&&x.party+y.party<=4)||(x.side==='driver'&&y.side==='rider'&&x.seats>=y.party)||(y.side==='driver'&&x.side==='rider'&&y.seats>=x.party));
 if(x.kind==='study')return x.course===y.course&&x.communication===y.communication&&((x.side==='peer'&&y.side==='peer')||(x.side==='mentor'&&y.side==='learner')||(x.side==='learner'&&y.side==='mentor'));
 return x.activity===y.activity&&x.place===y.place;
}
export function normalizeHall(raw){
 const v=String(raw??'').normalize('NFKC').toLowerCase().replace(/[\s\u2000-\u200f]/g,'');
 for(let n=1;n<=6;n++)if([`hall${n}`,`hall${roman[n].toLowerCase()}`,`${cn[n]}舍`].includes(v))return `hall-${n}`;
 return null;
}
