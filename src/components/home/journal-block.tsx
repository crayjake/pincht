import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { ViewWidgets } from './view-widgets';
import { loadDays, loadResources } from './journal-storage';
import { loadRoutines } from '../../routines/storage';
import { loadSessions } from '../../workouts/storage';
import { dragLoads } from '../../routines/rehab-loads';
import { widgetNames, type WidgetId } from './journal-views';
function Block({ node }: NodeViewProps) {
  const widget = node.attrs.widget as WidgetId;
  return <NodeViewWrapper className="journal-embedded-block" contentEditable={false}>{widget in widgetNames ? <ViewWidgets widgets={[widget]} days={loadDays()} data={loadRoutines()} loads={dragLoads(loadSessions())} /> : <p>Unavailable block</p>}</NodeViewWrapper>;
}
export const journalBlock = Node.create({
  name: 'journalBlock', group: 'block', atom: true,
  addAttributes() { return { widget: { default: 'sends' } }; },
  parseHTML() { return [{tag:'div[data-journal-widget]',getAttrs:element=>({widget:element.getAttribute('data-journal-widget')})}]; },
  renderHTML({node,HTMLAttributes}) {return ['div',mergeAttributes(HTMLAttributes,{'data-journal-widget':node.attrs.widget})];},
  addNodeView() { return ReactNodeViewRenderer(Block); },
});

export const climbCard = Node.create({
  name: 'climbCard', group: 'block', atom: true,
  addAttributes() { return { id: { default: '' }, label: { default: '' }, category: { default: 'climb' } }; },
  parseHTML() { return [{tag:'div[data-climb-card]',getAttrs:element=>({id:element.getAttribute('data-climb-card')})}]; },
  renderHTML({node,HTMLAttributes}) {return ['div',mergeAttributes(HTMLAttributes,{'data-climb-card':node.attrs.id})];},
  addNodeView() { return ReactNodeViewRenderer(ClimbCard); },
});
function ClimbCard({node}: NodeViewProps) {
  const days=loadDays(), id=String(node.attrs.id);
  const record=[...loadResources(),...days.flatMap(day=>day.records)].find(record=>record.id===id&&record.kind==='climb');
  const logs=days.filter(day=>day.records.some(record=>record.id===id&&record.climb?.goes));
  return <NodeViewWrapper className="journal-embedded-block embedded-climb" contentEditable={false}>
    <a href={`#/library/climbs/${encodeURIComponent(id)}`}><span className="record-pill" data-category="climb">{record?.title??node.attrs.label}</span><span>{record?.metric}</span></a>
    <p className="mono muted">{record?.climbInfo?.where??record?.meta}</p>
    <p>{logs.length?`${logs.length} sessions · ${logs.reduce((sum,day)=>sum+(day.records.find(record=>record.id===id)?.climb?.goes??0),0)} goes`:'No sessions yet'}</p>
  </NodeViewWrapper>;
}
