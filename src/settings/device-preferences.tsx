import { useState } from 'react';
import { Sheet } from '../components/home/journal-sheet';
import { loadPreferences, savePreferences, type Preferences } from '../data/preferences';
export function DevicePreferences({onClose,connected=false,onZero,onDisconnect}:{onClose:()=>void;connected?:boolean;onZero?:()=>Promise<void>;onDisconnect?:()=>Promise<void>}) {
  const [preferences,setPreferences]=useState(loadPreferences),[error,setError]=useState('');
  function update(tindeq:Preferences['tindeq']) {try { const next={...preferences,tindeq};savePreferences(next);setPreferences(next);setError(''); }catch(e){setError((e as Error).message);}}
  const p=preferences.tindeq;
  return <Sheet title="Device preferences" onClose={onClose}><p className="muted">{p.deviceName??'Tindeq Progressor'} · {connected?'Connected':'Not connected'}</p><div className="settings-list">
    <label className="metric-choice"><span>Auto-connect<small className="muted">Reconnect to this device next time</small></span><input type="checkbox" checked={p.autoConnect} onChange={e=>update({...p,autoConnect:e.target.checked})} /></label>
    <label className="metric-choice"><span>Zero before each set<small className="muted">Remove all load before zeroing</small></span><input type="checkbox" checked={p.zeroEachSet} onChange={e=>update({...p,zeroEachSet:e.target.checked})} /></label>
    <label className="settings-row"><span>Start threshold · kg</span><input aria-label="Start threshold · kg" type="number" min="0" max="100" step="0.1" value={p.thresholdKg} onChange={e=>update({...p,thresholdKg:Number(e.target.value)})} /></label>
    <div className="settings-row"><span>Units</span><span>kg</span></div>
    <button className="settings-row" disabled={!connected||!onZero} onClick={()=>void onZero?.()}>Zero device</button>
    <button className="settings-row" disabled={!connected||!onDisconnect} onClick={()=>void onDisconnect?.().then(onClose)}>Disconnect</button>
    <button className="settings-row danger" disabled={!p.deviceId} onClick={async()=>{try{await onDisconnect?.();update({...p,deviceId:undefined,deviceName:undefined});onClose();}catch(e){setError((e as Error).message);}}}>Forget device</button>
  </div>{error&&<p role="alert">{error}</p>}</Sheet>;
}
