import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getDataMode, type DataMode } from '../data/mode';
import { exportBackup, exportCSV, restoreBackup } from '../data/backup';
import { applyAppearance, loadPreferences, savePreferences, type Preferences } from '../data/preferences';
import { loadViews, saveView } from '../components/home/journal-views';
import { DevicePreferences } from './device-preferences';
import { PrimaryNav } from '../components/app-navigation';
import { Icon } from '../components/home/journal-icons';
import { ClimbHeader } from '../climbs/climb-pages';
import './settings.scss';
import { Sheet } from '../components/home/journal-sheet';
import '../components/home/home.scss';
const REMINDER_ID=41001;
export async function updateReminder(p:Preferences) {
  if(!Capacitor.isNativePlatform()) { if(p.reminder) throw new Error('Daily reminders are available in the iPhone app.'); return; }
  if(p.reminder) {
    const permission=await LocalNotifications.requestPermissions();
    if(permission.display!=='granted') throw new Error('Allow notifications for pincht in iPhone Settings to enable reminders.');
  }
  await LocalNotifications.cancel({notifications:[{id:REMINDER_ID}]});
  if(p.reminder) { const [hour,minute]=p.reminderTime.split(':').map(Number); await LocalNotifications.schedule({notifications:[{id:REMINDER_ID,title:'Your journal',body:'A moment to log your day.',schedule:{on:{hour,minute},repeats:true}}]}); }
}
async function exportFile(name:string,data:string,mime:string) {
  if(Capacitor.isNativePlatform()) {
    const file=await Filesystem.writeFile({path:name,data,directory:Directory.Cache,encoding:Encoding.UTF8});
    await Share.share({title:'pincht backup',files:[file.uri]});
  } else {
    const url=URL.createObjectURL(new Blob([data],{type:mime})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
export default function SettingsPage({ onDataMode }: { onDataMode: (mode: DataMode) => void }) {
  const [p,setP]=useState(loadPreferences),[error,setError]=useState(''),[status,setStatus]=useState(''),[device,setDevice]=useState(false),[pending,setPending]=useState<string>(),[busy,setBusy]=useState(false),[,refresh]=useState(0);
  const input=useRef<HTMLInputElement>(null),views=loadViews();
  async function update(next:Preferences,reminder=false) {
    setError('');
    try {
      if(reminder) await updateReminder(next);
      try { savePreferences(next); } catch(error) {
        if(reminder) await updateReminder(p).catch(()=>{});
        throw error;
      }
      setP(next);
    } catch(e) {setError((e as Error).message);}
  }
  async function importData() {
    if(pending===undefined)return;
    setError('');
    try {restoreBackup(pending);} catch(e) {setError((e as Error).message);setPending(undefined);return;}
    // The restore is already committed even if the OS rejects its reminder.
    const restored=loadPreferences();setP(restored);applyAppearance(restored);refresh(v=>v+1);setPending(undefined);
    try {await updateReminder(restored);location.reload();}
    catch(e) {setError(`Backup imported. ${(e as Error).message}`);setStatus('Backup imported.');}
  }
  async function download(format:'json'|'csv') {setError('');setBusy(true);try {await exportFile(`pincht-${new Date().toISOString().slice(0,10)}.${format}`,format==='json'?exportBackup():exportCSV(),format==='json'?'application/json':'text/csv');setStatus('Export ready.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <><main className="today-page configuration-page settings-page"><ClimbHeader title="Settings" back="#/library" />
    <section className="settings-section"><h2 className="eyebrow">Appearance</h2><div className="climb-segment">{(['system','light','dark'] as const).map(value=><button key={value} aria-pressed={p.appearance===value} onClick={()=>void update({...p,appearance:value})}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div></section>
    <section className="settings-section"><h2 className="eyebrow">Journal</h2><div className="settings-list"><label className="settings-row"><strong>Default view</strong><select aria-label="Default view" value={views.find(view=>view.isDefault)?.id??'all'} onChange={e=>{try{const view=views.find(view=>view.id===e.target.value)!;saveView({...view,isDefault:true});refresh(v=>v+1);}catch(e){setError((e as Error).message);}}}>{views.map(view=><option key={view.id} value={view.id}>{view.name}</option>)}</select><span className="reference-chevron"><Icon name="back" size={16} /></span></label><div className="settings-row"><strong>Week starts</strong><span className="settings-value">Monday</span></div></div></section>
    <section className="settings-section"><h2 className="eyebrow">Units</h2><div className="settings-list"><div className="settings-row"><strong>Weight</strong><span className="settings-value">kg</span></div><div className="settings-row"><strong>Climbing grades</strong><span className="settings-value">French · Font</span></div></div></section>
    <section className="settings-section"><h2 className="eyebrow">Reminders</h2><div className="settings-list"><div className="settings-row"><strong>Daily reminder</strong><button type="button" role="switch" aria-label="Daily reminder" aria-checked={p.reminder} className="settings-switch" onClick={()=>void update({...p,reminder:!p.reminder},true)}><i /></button></div><label className="settings-row"><strong>Time</strong><input aria-label="Reminder time" type="time" value={p.reminderTime} onChange={e=>void update({...p,reminderTime:e.target.value},true)} /><span className="reference-chevron"><Icon name="back" size={16} /></span></label></div></section>
    <section className="settings-section"><h2 className="eyebrow">Devices</h2><div className="settings-list"><button className="settings-row" onClick={()=>setDevice(true)}><strong>Tindeq Progressor</strong><span className="settings-value">{p.tindeq.deviceName?'Saved device':'Not connected'}</span><span className="reference-chevron"><Icon name="back" size={16} /></span></button></div></section>
    <section className="settings-section"><h2 className="eyebrow">Data</h2><div className="settings-list"><label className="settings-row"><strong>Stored data</strong><select aria-label="Stored data mode" value={getDataMode()} onChange={event => onDataMode(event.target.value as DataMode)}><option value="real">My real setup</option><option value="demo">Testing / dummy data</option></select><span className="reference-chevron"><Icon name="back" size={16} /></span></label><div className="settings-row"><strong>Export everything</strong><span className="settings-value export-formats"><button className="text-action" disabled={busy} onClick={()=>void download('json')}>JSON</button> · <button className="text-action" disabled={busy} onClick={()=>void download('csv')}>CSV</button></span></div><button className="settings-row" onClick={()=>input.current?.click()}><strong>Import</strong><span className="reference-chevron"><Icon name="back" size={16} /></span></button></div><p className="settings-caption">Each mode keeps its own saved data.</p><input className="sr-only" ref={input} aria-label="Import backup" type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(file)try{setPending(await file.text());}catch{setError('Could not read that file.');}e.target.value='';}} /></section>
    {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  </main><PrimaryNav active="library" />{device&&<DevicePreferences onClose={()=>{setDevice(false);setP(loadPreferences());}} />}{pending!==undefined&&<Sheet title="Import backup?" onClose={()=>setPending(undefined)}><p>This replaces the stored real and testing data with the selected backup.</p><button className="secondary-button" onClick={()=>setPending(undefined)}>Cancel</button><button className="primary-button" onClick={()=>void importData()}>Import backup</button></Sheet>}</>;
}
