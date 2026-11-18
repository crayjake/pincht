import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createSession, sessionReducer, type MeasurementSource, type Session, type SessionEvent, type ForceSample } from '../../workouts/session';
import type { Exercise, WorkoutPreset } from '../../workouts/fixtures';
import { bluetoothError, ProgressorTransport, SimulatorTransport, type ForceTransport } from '../../workouts/transport';
import { loadPreferences, savePreferences } from '../../data/preferences';

export function useWorkoutSession(preset: WorkoutPreset, exercise: Exercise, source: MeasurementSource, initial?: Session) {
  const [session, setSession] = useState(() => initial ?? createSession(preset, exercise, source, Date.now()));
  const current = useRef(session), transport = useRef<ForceTransport | null>(null), mounted = useRef(true);
  const foreground = useRef(!document.hidden), backgroundEpoch = useRef(0), streaming = useRef(false), armed = useRef(false);
  const [now, setNow] = useState(Date.now), [connected,setConnected]=useState(false), [tared,setTared]=useState(false);
  const [device,setDevice]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState(''), [idleForce,setIdleForce]=useState<number>();
  const act = useCallback((event: SessionEvent) => {
    if (!mounted.current) return;
    const previous=current.current, next=sessionReducer(previous,event);
    current.current=next; setSession(next);
    if ((previous.phase==='holding' && next.phase!=='holding') || ['pause','restart','redo','finish'].includes(event.type)) {
      armed.current=false; streaming.current=false;
      void transport.current?.stop().catch(error=>{if(mounted.current){setError(bluetoothError(error));setConnected(false);setTared(false);}});
      if(next.candidate?.status==='interrupted' || (source!=='manual' && (loadPreferences().tindeq.zeroEachSet || ['pause','restart','redo'].includes(event.type)))) setTared(false);
    }
  },[source]);
  useEffect(()=>{
    mounted.current=true;
    const timer=setInterval(()=>{const time=Date.now();setNow(time);if(foreground.current&&!document.hidden)act({type:'tick',now:time});},100);
    const background=()=>{foreground.current=false;backgroundEpoch.current++;armed.current=false;streaming.current=false;setTared(false);act({type:'pause',now:Date.now()});act({type:'interrupt',now:Date.now(),reason:'App left the foreground during the hold. Retry this set.'});void transport.current?.stop().catch(()=>{});};
    const visibility=()=>{if(document.hidden)background();else foreground.current=true;};
    document.addEventListener('visibilitychange',visibility);
    const listener=Capacitor.isNativePlatform()?App.addListener('appStateChange',({isActive})=>{if(!isActive)background();else foreground.current=!document.hidden;}):undefined;
    return()=>{mounted.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);void listener?.then(handle=>handle.remove());void transport.current?.dispose();};
  },[act]);
  useEffect(()=>{if(session.phase==='review')void transport.current?.dispose();},[session.phase]);
  async function connect(remembered=false) {
    setBusy(true);setError('');setTared(false);setConnected(false);armed.current=false;streaming.current=false;
    await transport.current?.dispose();
    const callbacks={
      sample:(sample:ForceSample)=>{
        if(!mounted.current||!foreground.current||document.hidden)return;
        if(current.current.phase==='ready' && armed.current){
          setIdleForce(sample.kg);
          if(sample.kg < loadPreferences().tindeq.thresholdKg)return;
          armed.current=false;act({type:'start',now:Date.now()});
        }
        act({type:'sample',sample,now:Date.now()});
      },
      disconnected:()=>{if(!mounted.current)return;armed.current=false;streaming.current=false;setConnected(false);setTared(false);setError('Progressor disconnected. Connect and zero to retry.');act({type:'interrupt',now:Date.now(),reason:'Progressor disconnected during the hold.'});},
      error:(message:string)=>{if(!mounted.current)return;armed.current=false;streaming.current=false;setError(message);setTared(false);act({type:'interrupt',now:Date.now(),reason:message});void transport.current?.stop().catch(()=>{});},
    };
    const preferences=loadPreferences();
    const next=source==='simulator'?new SimulatorTransport(callbacks,preset.prescription.kind==='hold'?preset.prescription.targetKg||35:0):new ProgressorTransport(callbacks,undefined,{deviceId:remembered?preferences.tindeq.deviceId:undefined,onDevice:(deviceId,deviceName)=>{const p=loadPreferences();savePreferences({...p,tindeq:{...p.tindeq,deviceId,deviceName}});}});
    transport.current=next;
    try{const name=await next.connect();if(mounted.current){setDevice(name);setConnected(true);}}
    catch(error){if(mounted.current)setError(bluetoothError(error));}
    finally{if(mounted.current)setBusy(false);}
  }
  const autoConnected=useRef(false);
  useEffect(()=>{const p=loadPreferences();if(!autoConnected.current && source==='tindeq'&&Capacitor.isNativePlatform()&&p.tindeq.autoConnect&&p.tindeq.deviceId){autoConnected.current=true;void connect(true);}},[]); // A saved native device needs no chooser.
  async function arm() {
    if(!transport.current||!foreground.current||document.hidden||current.current.phase!=='ready')return;
    armed.current=true;setIdleForce(undefined);
    if(!streaming.current){streaming.current=true;try{await transport.current.start();}catch(error){armed.current=false;streaming.current=false;setTared(false);setError(bluetoothError(error));}}
  }
  useEffect(()=>{if(session.phase==='ready'&&tared&&connected&&source!=='manual')void arm();},[session.phase,tared,connected]);
  async function tare() {
    setBusy(true);setError('');setTared(false);armed.current=false;
    const epoch=backgroundEpoch.current;
    try{streaming.current=false;await transport.current!.stop();await transport.current!.tare();if(mounted.current&&foreground.current&&epoch===backgroundEpoch.current)setTared(true);}
    catch(error){if(mounted.current)setError(bluetoothError(error));}
    finally{if(mounted.current)setBusy(false);}
  }
  async function start() {
    if(!foreground.current||document.hidden||(source!=='manual'&&(!connected||!tared))||!['ready','preparing'].includes(current.current.phase))return;
    setError('');setBusy(true);armed.current=false;act({type:'start',now:Date.now()});
    try{if(transport.current&&!streaming.current){streaming.current=true;await transport.current.start();}}
    catch(error){streaming.current=false;if(mounted.current)setError(bluetoothError(error));act({type:'interrupt',now:Date.now(),reason:'Could not start the force stream. Connect and zero, then retry.'});}
    finally{if(mounted.current)setBusy(false);}
  }
  async function disconnect(){armed.current=false;streaming.current=false;await transport.current?.dispose();setConnected(false);setTared(false);act({type:'interrupt',now:Date.now(),reason:'Progressor disconnected during the hold.'});}
  async function simulateDrop(){await disconnect();}
  return {session,now,act,connect:()=>connect(),tare,start,simulateDrop,disconnect,connected,tared,busy,device,error,idleForce};
}
