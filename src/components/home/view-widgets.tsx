import { BookCover } from '../../books/book-cover';
import { useId, useState, type ReactNode, type PointerEvent } from 'react';
import { addDays, checkIn, daysBetween, weekStart, type RoutineData } from '../../routines/data';
import { loadSessions } from '../../workouts/storage';
import { asleepMinutes, duration, getNights, localDate, shortDate, stageTotals, type Day, type RehabLoad } from './journal-data';
import { fullWidgets, widgetNames, type WidgetId } from './journal-views';
import { loadResources } from './journal-storage';
import { strengthGoal, widgetData, gradeRank } from './widget-data';
import { directDragSeriesId, loadSeries } from '../../workouts/measurements';
import { NextWorkout } from './next-workout';
import './widgets.scss';

type Point = {x:number;y:number;label:string;value:string};
const dateLabel = (date:string) => shortDate(date,{day:'numeric',month:'short',year:'numeric'});
const colors = {training:'var(--series-1)',climb:'var(--series-2)',rehab:'var(--series-3)'};
function Chart({children,points,height=124,label,compact=false}:{children:ReactNode;points:Point[];height?:number;label:string;compact?:boolean}) {
  const [active,setActive] = useState<number>();
  const id=useId();
  function inspect(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 315;
    const y = (event.clientY - rect.top) / rect.height * height;
    let best = Infinity, index: number | undefined;
    points.forEach((point, i) => {
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distance < best) { best = distance; index = i; }
    });
    setActive(index);
  }
  return <div className={`widget-chart${compact?' compact-chart':''}`}>
    <svg viewBox={`0 0 315 ${height}`} role="group" aria-label={label} onPointerDown={inspect} onPointerMove={inspect} onPointerLeave={()=>setActive(undefined)}>
      {children}
      {points.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r={compact?10:12} fill="transparent" tabIndex={0} role="button" aria-label={`${point.label}: ${point.value}`} aria-describedby={active===index?id:undefined} onFocus={()=>setActive(index)} onBlur={()=>setActive(undefined)} onClick={()=>setActive(index)}><title>{point.label}: {point.value}</title></circle>)}
      {active!==undefined&&points[active]&&<circle cx={points[active].x} cy={points[active].y} r="3" fill="var(--color-text)" pointerEvents="none"/>}
    </svg>
    {active!==undefined&&points[active]&&<output id={id} className="chart-tooltip" role="status"><b>{points[active].value}</b><span>{points[active].label}</span></output>}
  </div>;
}
function Empty({children='No logs yet.'}:{children?:ReactNode}) {return <p className="widget-empty">{children}</p>}
function Line({values,color,target,compact=false,area=true}:{values:{date:string;value:number}[];color:string;target?:number;compact?:boolean;area?:boolean}) {
  if(!values.length)return <Empty>No measurements yet.</Empty>;
  const height=compact?100:124,left=compact?3:28,right=compact?312:300,top=compact?6:12,bottom=compact?96:100;
  const min=Math.max(0,Math.min(...values.map(v=>v.value),target??Infinity)-2), max=Math.max(...values.map(v=>v.value),target??0)+2;
  const first=Date.parse(values[0].date),last=Date.parse(values.at(-1)!.date);
  const y=(value:number)=>bottom-(value-min)/Math.max(1,max-min)*(bottom-top);
  const points=values.map(value=>({x:values.length===1?(left+right)/2:left+(Date.parse(value.date)-first)/Math.max(1,last-first)*(right-left),y:y(value.value),label:dateLabel(value.date),value:`${value.value.toFixed(1)} kg`}));
  const path=points.map(point=>`${point.x},${point.y}`).join(' ');
  return <Chart points={points} height={height} compact={compact} label="Measurements in kilograms">
    {!compact&&[min,(min+max)/2,max].map(value=><g key={value}><path d={`M28 ${y(value)}H308`} className="chart-grid"/><text x="22" y={y(value)+3} textAnchor="end">{Math.round(value)}</text></g>)}
    {target!==undefined&&<><path d={`M${left} ${y(target)}H${right}`} stroke="var(--color-goal-fg)" strokeDasharray="4 4"/><text x={right} y={y(target)-5} textAnchor="end">target {target} kg</text></>}
    {area&&<path d={`M${points.map(point=>`${point.x} ${point.y}`).join(' L')} L${points.at(-1)!.x} ${bottom} L${points[0].x} ${bottom}Z`} fill={color} opacity=".1"/>}
    <polyline points={path} stroke={color} fill="none" strokeWidth={compact?4:2} strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r={compact?5:3} fill={color}/>
    {!compact&&<text x={points.at(-1)!.x} y={points.at(-1)!.y-7} textAnchor="end" style={{fill:color}}>{values.at(-1)!.value.toFixed(1)}</text>}
    {!compact&&[0,Math.floor((values.length-1)/2),values.length-1].filter((value,index,list)=>list.indexOf(value)===index).map(index=><text key={index} x={points[index].x} y="120" textAnchor={index===0?'start':index===values.length-1?'end':'middle'}>{shortDate(values[index].date,{month:'short',day:'numeric'})}</text>)}
  </Chart>
}
function Bars({values,color,format=String}:{values:{date:string;value:number}[];color:string;format?:(value:number)=>string}) {
  const max=Math.max(1,...values.map(value=>value.value)),width=315/Math.max(1,values.length);
  return <Chart compact height={100} label="Recent logs" points={values.map((value,index)=>({x:index*width+width/2,y:96-value.value/max*85,label:dateLabel(value.date),value:format(value.value)}))}>{values.map((value,index)=><rect key={`${value.date}-${index}`} x={index*width+3} y={96-value.value/max*85} width={Math.max(1,width-8)} height={Math.max(2,value.value/max*85)} rx="5" fill={value.value?color:'var(--color-track)'} opacity={index===values.length-1?1:.4}/>)}</Chart>
}
function Ring({value,total,label,color}:{value:number;total:number;label:string;color:string}) {const ratio=total?Math.min(1,value/total):0;return <div className="widget-ring" role="img" aria-label={label}><svg viewBox="0 0 76 76"><circle cx="38" cy="38" r="32" fill="none" stroke="var(--color-track)" strokeWidth="6"/><circle cx="38" cy="38" r="32" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${ratio*201.06} 201.06`} strokeLinecap="round" transform="rotate(-90 38 38)"/></svg><span>{label}</span></div>}
function Legend({sleep=false,rest=false}:{sleep?:boolean;rest?:boolean}) {return <div className="widget-legend">{(sleep?['deep','REM','light']:['training','climb','rehab']).map((name,index)=><span key={name}><i style={{background:sleep?'var(--color-sleep-fg)':Object.values(colors)[index],opacity:sleep?[1,.62,.3][index]:1}}/>{name}</span>)}{rest&&<span><i style={{background:'var(--color-track)'}}/>rest</span>}</div>}
export function ViewWidgets({widgets,days,data,loads,goalId}:{widgets:WidgetId[];days:Day[];data:RoutineData;loads:RehabLoad[];goalId?:string}) {
  const today=localDate(), model=widgetData(days,data,loadSessions()), goal=strengthGoal(loadResources(),goalId), series=loadSeries(days,model.sessions).find(series=>series.id===(goal?.goal?.seriesId??directDragSeriesId)), strength=(series?.points??[]).filter(load=>load.date<=today);
  const workingLoads=loads.filter(load=>load.date<=today), latest=workingLoads.at(-1), weight=model.weights.at(-1), previousWeight=model.weights.filter(value=>value.date>=addDays(today,-6))[0];
  const bookHref=model.book?`#/library/books/book-${model.book.id}`:'#/library/books';
  function compact(id:WidgetId) {
    let title:string=widgetNames[id],category='training',headline:ReactNode,subline:ReactNode,chart:ReactNode,href:string|undefined;
    const big=(value:ReactNode,unit?:ReactNode)=><>{value}{unit&&<small>{unit}</small>}</>;
    if(id==='rehab'){category='rehab';headline=big(latest?latest.kg.toFixed(1):'—','kg');subline='20 mm drag · last hold';chart=<Line compact values={workingLoads.map(load=>({date:load.date,value:load.kg}))} color="var(--color-rehab-fg)"/>;href='#/library/metrics/rehab'}
    if(id==='sleep'){category='sleep';headline=model.sleep.length?duration(model.sleep.reduce((sum,value)=>sum+value.value,0)/model.sleep.length):'—';subline=`avg of ${model.sleep.length} nights`;chart=<Bars values={model.sleep} format={duration} color="var(--color-sleep-fg)"/>;href='#/library/metrics/sleep'}
    if(id==='climbing'){category='climb';headline=big(model.dates.filter(date=>model.activity(date).includes('climb')).length,'of 7');subline='last seven days';chart=<div className="widget-segments">{model.dates.map(date=><a key={date} href={`#/journal/${date}`} aria-label={`${dateLabel(date)}: ${model.activity(date).includes('climb')?'climbed':'no climb logged'}`} style={{background:model.activity(date).includes('climb')?'var(--color-climb-fg)':'var(--color-track)'}}/>)}</div>}
    if(id==='weight'){category='weight';headline=big(weight?weight.value.toFixed(1):'—','kg');const delta=weight&&previousWeight&&weight.date!==previousWeight.date?weight.value-previousWeight.value:undefined;subline=delta!==undefined?`${delta>0?'+':''}${delta.toFixed(1)} over 7 days`:'No recent change recorded';chart=<Line compact area={false} values={model.weights.filter(value=>value.date>=addDays(today,-6))} color="var(--color-text-muted)"/>;href='#/library/metrics/weight'}
    if(id==='alcohol'){category='habit';headline=big(model.streak,'days');subline=`best run ${model.best}`;chart=<div className="widget-segments streak-segments">{daysBetween(addDays(today,-13),today).map(date=><a key={date} href={`#/journal/${date}`} aria-label={`${dateLabel(date)}: ${model.alcohol&&checkIn(data,model.alcohol.id,date)?.status==='done'&&checkIn(data,model.alcohol.id,date)?.drinks===0?'alcohol-free':'not logged alcohol-free'}`} style={{background:model.alcohol&&checkIn(data,model.alcohol.id,date)?.status==='done'&&checkIn(data,model.alcohol.id,date)?.drinks===0?'var(--color-habit-fg)':'var(--color-track)'}}/>)}</div>}
    if(id==='reading'){category='habit';subline=model.book?`${model.book.title} · p.${model.page} of ${model.book.pages}`:'No current book';chart=model.book?<Ring value={model.page} total={model.book.pages} label={`${Math.round(model.page/Math.max(1,model.book.pages)*100)}%`} color="var(--color-habit-fg)"/>:<Empty><a href={bookHref}>Choose a book ›</a></Empty>;href=bookHref}
    if(id==='train'){subline=model.train?`${model.train.comparator==='at-most'?'at most':model.train.comparator==='exactly'?'exactly':'at least'} ${model.train.target} this week`:'No training routine';chart=model.train?<Ring value={model.trainCount} total={model.train.target} label={`${model.trainCount}/${model.train.target}`} color="var(--color-training-fg)"/>:<Empty/>;href=model.train?`#/library/routines/${model.train.id}`:'#/routines'}
    if(id==='drinks'){category='habit';headline=big(model.drinks,model.alcohol?`of ${model.alcohol.target}`:undefined);subline=model.alcohol?`at most ${model.alcohol.target} · ${model.unlogged} unlogged`:'No alcohol routine';chart=<div className="widget-limit"><div><i style={{width:`${Math.min(100,model.drinks/Math.max(1,model.alcohol?.target??1)*100)}%`}}/><b/></div><span>limit {model.alcohol?.target??'—'}</span></div>;href=model.alcohol?`#/library/routines/${model.alcohol.id}`:'#/routines'}
    if(id==='hardest'){category='climb';headline=model.hardest?.record.metric??'—';subline=model.hardest?`${model.hardest.record.metric.toUpperCase().startsWith('V')?'V scale':'Font'} · ${shortDate(model.hardest.date,{weekday:'short',day:'numeric',month:'short'})} · go ${model.hardest.record.climb!.sendGo}`:'No graded sends yet';chart=model.hardest?<a className="record-pill widget-record" data-category="climb" href={`#/library/climbs/${model.hardest.record.id}`}>{model.hardest.record.title}</a>:null}
    if(id==='pullups'){headline=big(model.pullups.reduce((sum,value)=>sum+value.value,0),'reps');const rpe=model.pullups.at(-1)?.rpe;subline=`${model.pullups.length} sessions${rpe!==undefined?` · RPE ${rpe}`:''}`;chart=<Bars values={model.pullups} format={value=>`${value} reps`} color="var(--color-training-fg)"/>;href='#/library/workouts/plan-pull-ups-3x5'}
    if(id==='projects'){category='climb';headline=big(model.projects.length,'open');chart=<div className="widget-projects">{model.projects.slice(0,3).map(({record,goes})=><a key={record.id} href={`#/library/climbs/${record.id}`}><span>{record.title}</span><small>{goes} {goes===1?'go':'goes'}</small></a>)}</div>;if(!model.projects.length)subline='No unsent climbs logged'}
    if(id==='wall'){category='climb';const values=model.weekDates.map(date=>({date,value:date<=today?days.find(day=>day.date===date)?.measurements?.climbingMinutes??0:0}));headline=duration(values.reduce((sum,value)=>sum+value.value,0));subline='this week';chart=<Bars values={values} format={duration} color="var(--color-climb-fg)"/>;href='#/do'}
    return <section className="compact-widget" data-widget={id} aria-label={title}><div className="widget-label"><i data-category={category}/>{href?<a href={href}>{title}</a>:title}</div>{headline!==undefined&&<div className="compact-value">{headline}</div>}{subline&&<div className="compact-subline">{subline}</div>}{chart}</section>;
  }
  function full(id:WidgetId) {
    let meta:ReactNode,chart:ReactNode;
    if(id==='next')return <section className="full-widget-slot" aria-label="Next up"><NextWorkout data={data} empty/></section>;
    if(id==='book')return <section className="full-widget book-widget" aria-label="Reading · full width"><a className="widget-book-cover" aria-label="Open current book" href={bookHref}>{model.book && <BookCover book={model.book} className="cover-image"/>}</a><div><div className="widget-label"><i data-category="habit"/>Reading</div>{model.book?<><a className="widget-book-title" href={bookHref}>{model.book.title}</a><div className="compact-subline">{model.book.author}</div><div className="book-progress"><div><i style={{width:`${Math.min(100,model.page/model.book.pages*100)}%`}}/></div><span>{model.page} / {model.book.pages}</span></div>{model.rate>0&&<div className="compact-subline">~{Math.round(model.rate)} pages a day · est. {shortDate(addDays(today,Math.ceil((model.book.pages-model.page)/model.rate)),{day:'numeric',month:'short'})}</div>}</>:<Empty><a href={bookHref}>Choose a book ›</a></Empty>}</div></section>;
    if(id==='sends'){
      const sends=model.sends.filter(item=>item.date.startsWith(today.slice(0,4)));
      const grades=[...new Set(sends.map(item=>item.record.metric||'Ungraded'))].sort((a,b)=>Number(a.startsWith('V'))-Number(b.startsWith('V')) || gradeRank(a)-gradeRank(b));
      const counts=grades.map(grade=>sends.filter(item=>(item.record.metric||'Ungraded')===grade).length),max=Math.max(1,...counts),height=Math.max(42,grades.length*18+12);
      meta=`${today.slice(0,4)} · ${sends.length} sends`;
      chart=grades.length?<Chart height={height} label="Sends by grade" points={grades.map((grade,index)=>({x:40+counts[index]/max*240,y:index*18+10,label:`${today.slice(0,4)} · ${grade}`,value:`${counts[index]} sends`}))}>{grades.map((grade,index)=><g key={grade}><text x="0" y={index*18+13}>{grade}</text><rect x="35" y={index*18+3} width={counts[index]/max*240} height="12" rx="3" fill="var(--color-climb-fg)"/><text x={42+counts[index]/max*240} y={index*18+13}>{counts[index]}</text></g>)}</Chart>:<Empty>No sends logged this year.</Empty>;
    }
    if(id==='strength'){meta=`${series?.name??'20 mm three-finger drag'} · kg`;chart=<><Line values={strength.map(load=>({date:load.date,value:load.kg}))} target={goal?.goal?.targetKg} color="var(--color-rehab-fg)"/>{goal&&<a className="widget-goal" href={`#/library/goals/${goal.id}`}>{goal.title} · target {goal.goal!.targetKg} kg</a>}</>}
    if(id==='sessions'){
      meta='last 12 weeks';const weeks=Array.from({length:12},(_,index)=>({date:addDays(weekStart(today),(index-11)*7),...model.counts(addDays(weekStart(today),(index-11)*7))}));const max=Math.max(6,...weeks.map(week=>week.training+week.climb+week.rehab));
      chart=<><Chart label="Sessions per week" points={weeks.map((week,index)=>({x:37+index*23,y:100-(week.training+week.climb+week.rehab)/max*86,label:`Week of ${dateLabel(week.date)}`,value:`${week.training} training · ${week.climb} climb · ${week.rehab} rehab`}))}>{[0,max/2,max].map(value=><g key={value}><text x="18" y={103-value/max*86} textAnchor="end">{Math.round(value)}</text><path className="chart-grid" d={`M26 ${100-value/max*86}H312`}/></g>)}{weeks.map((week,index)=>{let y=100;return <g key={week.date}>{Object.entries(colors).map(([category,color])=>{const height=week[category as keyof typeof colors]/max*86;y-=height;return <rect key={category} x={29+index*23} y={y} width="16" height={height} rx="2" fill={color}/>})}{index%3===0&&<text x={37+index*23} y="120" textAnchor="middle">{shortDate(week.date,{day:'numeric',month:'short'})}</text>}</g>})}</Chart><Legend/></>;
    }
    if(id==='stages'){
      const nights=getNights(days.filter(day=>day.date<=today));meta=nights.length?`${shortDate(nights[0].date,{day:'numeric',month:'short'})} – ${shortDate(nights.at(-1)!.date,{day:'numeric',month:'short'})}`:'last 7 nights';const max=Math.max(600,...nights.map(asleepMinutes));
      chart=nights.length?<><Chart label="Sleep stages" height={146} points={nights.map((night,index)=>{const totals=stageTotals(night);return {x:49+index*38,y:116-asleepMinutes(night)/max*104,label:dateLabel(night.date),value:`${duration(asleepMinutes(night))} · deep ${duration(totals.deep)} · REM ${duration(totals.rem)} · light ${duration(totals.light)}`}})}>{[240,480].map(value=><g key={value}><text x="20" y={119-value/max*104} textAnchor="end">{value/60}h</text><path className="chart-grid" d={`M28 ${116-value/max*104}H313`}/></g>)}{nights.map((night,index)=>{let y=116;const totals=stageTotals(night);return <g key={night.date}>{(['deep','rem','light'] as const).map((stage,stageIndex)=>{const height=totals[stage]/max*104;y-=height;return <rect key={stage} x={36+index*38} y={y} width="26" height={height} fill="var(--color-sleep-fg)" opacity={[1,.62,.3][stageIndex]}/>})}<text x={49+index*38} y="137" textAnchor="middle">{shortDate(night.date,{day:'numeric'})}</text></g>})}</Chart><Legend sleep/></>:<Empty>No sleep stages logged. Add optional stages in Log sleep.</Empty>;
    }
    if(id==='calendar'){
      meta='last 12 weeks';
      const start=addDays(weekStart(today),-77),dates=daysBetween(start,addDays(weekStart(today),6));
      const points=dates.map((date,index)=>({x:42+Math.floor(index/7)*23,y:30+(index%7)*19,label:dateLabel(date),value:date>today?'Upcoming':model.activity(date).join(' · ')||'No activity logged'}));
      chart=<><Chart label="Training calendar" height={160} points={points}>
        {['M','T','W','T','F','S','S'].map((name,index)=><text key={index} x="0" y={34+index*19}>{name}</text>)}
        {dates.map((date,index)=>{
          const activity=date>today?[]:model.activity(date),monthDate=addDays(date,3),previous=addDays(monthDate,-7);
          return <g key={date}>
            {index%7===0&&(index===0||monthDate.slice(0,7)!==previous.slice(0,7))&&<text x={33+Math.floor(index/7)*23} y="12">{shortDate(monthDate,{month:'short'})}</text>}
            {(activity.length?activity:['rest']).map((category,categoryIndex)=><rect key={category} x={33+Math.floor(index/7)*23+categoryIndex*18/Math.max(1,activity.length)} y={22+index%7*19} width={18/Math.max(1,activity.length)} height="16" rx={activity.length>1?1:3} fill={date>today?'none':colors[category as keyof typeof colors]??'var(--color-track)'} stroke={date>today?'var(--color-border)':undefined} strokeDasharray={date>today?'3 2':undefined}/>)}
          </g>;
        })}
      </Chart><Legend rest/></>;
    }
    if(id==='habits'){
      meta='last 7 days';const height=36+model.habits.length*34;
      const habitColor=(kind:string)=>`var(--color-${kind==='rehab'?'rehab':kind==='training'?'training':'habit'}-fg)`;
      chart=model.habits.length?<><Chart label="Habits for the last seven days" height={height} points={model.habits.flatMap((routine,row)=>model.dates.map((date,col)=>({x:128+col*26,y:34+row*34,label:`${dateLabel(date)} · ${routine.name}`,value:model.habitState(routine.id,date)})))}>
        {model.dates.map((date,col)=><text key={date} x={128+col*26} y="10" textAnchor="middle">{shortDate(date,{weekday:'narrow'})}</text>)}
        {model.habits.map((routine,row)=>{
          const states=model.dates.filter(date=>date<today).map(date=>model.habitState(routine.id,date)),done=states.filter(state=>state==='done').length,total=states.filter(state=>state!=='rest').length;
          return <g key={routine.id}>
            <text className="habit-name" x="0" y={39+row*34}>{routine.name.length>15?routine.name.slice(0,14)+'…':routine.name}</text>
            {model.dates.map((date,col)=>{
              const state=model.habitState(routine.id,date),color=state==='missed'?'var(--color-climb-fg)':habitColor(routine.kind);
              return <circle key={date} cx={128+col*26} cy={34+row*34} r={state==='rest'?2.5:state==='done'?8:7} fill={state==='done'?color:state==='rest'?'var(--color-border)':'none'} stroke={state==='rest'||state==='done'?'none':state==='unlogged'?'var(--color-text-muted)':color} strokeWidth={state==='unlogged'?1.5:2} strokeDasharray={state==='unlogged'?'3 2.4':undefined}/>;
            })}
            <text x="315" y={38+row*34} textAnchor="end" style={{fontSize:11}}>{done}/{total}</text>
          </g>;
        })}
      </Chart><div className="widget-legend"><span>● done</span><span>◌ unlogged</span><span>· rest</span><span>○ due today</span></div></>:<Empty>No active routines.</Empty>;
    }
    if(id==='activity'){meta='last 7 days';chart=<div className="widget-activity">{model.dates.map(date=><a key={date} href={`#/journal/${date}`}><span>{shortDate(date,{weekday:'narrow'})}</span><div>{model.activity(date).map(category=><i key={category} style={{background:colors[category as keyof typeof colors]}}/>)}</div><span>{shortDate(date,{day:'numeric'})}</span></a>)}</div>}
    return <section className="full-widget" data-widget={id} aria-label={widgetNames[id]}><header><h2>{widgetNames[id]}</h2><span>{meta}</span></header>{chart}</section>;
  }
  return <div className="journal-widgets reference-widgets">{widgets.map(id=><div className={fullWidgets.includes(id)?'widget-span-full':'widget-slot'} key={id}>{fullWidgets.includes(id)?full(id):compact(id)}</div>)}</div>;
}
