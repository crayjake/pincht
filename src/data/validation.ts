import type { Day, JournalRecord } from '../components/home/journal-data.ts';
import type { RoutineData } from '../routines/data.ts';
import type { Session } from '../workouts/session.ts';
import type { Exercise, WorkoutPlan, WorkoutPreset } from '../workouts/fixtures.ts';
import type { JournalView } from '../components/home/journal-views.ts';
import type { WorkoutDraft } from '../workouts/draft.ts';
import { workoutPresets } from '../workouts/fixtures.ts';

// Validate storage boundaries before projection code or forms consume them.
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nonnegative = (v: unknown) => number(v) && v >= 0;
const integer = (v: unknown): v is number => number(v) && v >= 0 && Number.isInteger(v);
const date = (v: unknown) => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const categories = ['climb', 'training', 'rehab', 'goal', 'habit', 'sleep'];
const optional = (value: unknown, test: (v: unknown) => boolean) => value === undefined || test(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
export function isResources(value: unknown): value is JournalRecord[] {
  return Array.isArray(value) && value.every(r => object(r) && text(r.id) && text(r.title) && text(r.metric) && text(r.meta) && categories.includes(r.kind)
    && optional(r.climb, c => object(c) && integer(c.goes) && optional(c.sendGo, n => integer(n) && n > 0 && n <= c.goes))
    && optional(r.climbInfo, c => object(c) && ['boulder','route'].includes(c.type) && text(c.where) && optional(c.notes, text))
    && optional(r.goal, g => object(g) && g.metric === 'finger-strength' && number(g.targetKg) && g.targetKg > 0 && optional(g.seriesId, text))
    && optional(r.climbGoal, g => object(g) && strings(g.climbIds) && g.climbIds.length > 0 && new Set(g.climbIds).size === g.climbIds.length && optional(g.targetDate, date) && optional(g.tags, strings))
    && optional(r.progress, p => object(p) && integer(p.completed) && integer(p.total) && p.total > 0)
    && optional(r.sleep, s => object(s) && date(s.date) && Array.isArray(s.segments) && s.segments.every((segment: unknown) => object(segment) && ['deep', 'rem', 'light', 'awake'].includes(segment.stage) && nonnegative(segment.minutes))));
}
function richNodes(value: unknown): boolean {
  return Array.isArray(value) && value.every(n => object(n) && text(n.type) && (n.type === 'text' ? text(n.text) : (n.type === 'recordPill' || n.type === 'climbCard') ? object(n.attrs) && text(n.attrs.id) && text(n.attrs.label) && categories.includes(n.attrs.category) : optional(n.content, richNodes)));
}
export function isDays(value: unknown): value is Day[] {
  return Array.isArray(value) && value.every(d => object(d) && date(d.date) && Array.isArray(d.types) && d.types.every((t: unknown) => categories.includes(String(t)) || t === 'rest')
    && object(d.metrics) && optional(d.metrics.sleep, nonnegative) && optional(d.metrics.weight, nonnegative)
    && Array.isArray(d.visibleMetrics) && d.visibleMetrics.every((m: unknown) => m === 'sleep' || m === 'weight') && isResources(d.records)
    && optional(d.measurements, m => object(m) && Object.values(m).every(value => optional(value, nonnegative)))
    && optional(d.entry, e => object(e) && text(e.title) && optional(e.tags, strings) && object(e.body) && e.body.type === 'doc' && richNodes(e.body.content)));
}
export function isRoutineData(value: unknown): value is RoutineData {
  if (!object(value)) return false;
  return Array.isArray(value.routines) && value.routines.every((r: unknown) => object(r) && text(r.id) && text(r.name) && ['reading','alcohol','training','rehab'].includes(r.kind)
    && typeof r.active === 'boolean' && date(r.start) && ['daily','interval','weekly'].includes(r.schedule) && integer(r.interval) && r.interval > 0 && integer(r.target) && (r.kind === 'alcohol' || r.target > 0)
    && optional(r.workoutPlanIds, strings) && optional(r.days, d => Array.isArray(d) && d.every(n => integer(n) && n <= 6))
    && optional(r.tags, t => strings(t) && t.every(tag => [...categories,'reading'].includes(tag)))
    && optional(r.planSchedule, p => p === 'pulley' || p === 'wrist') && optional(r.comparator, c => ['at-least','exactly','at-most'].includes(String(c))))
    && Array.isArray(value.books) && value.books.every((b: unknown) => object(b) && text(b.id) && text(b.title) && text(b.author) && integer(b.pages) && b.pages > 0 && integer(b.initialPage) && b.initialPage <= b.pages && optional(b.status, s => ['want-to-read','reading','finished'].includes(String(s))) && optional(b.started, date) && optional(b.isbn, text) && optional(b.catalogKey, text))
    && text(value.currentBookId) && date(value.lastVisit) && object(value.widgets) && typeof value.widgets.rehab === 'boolean' && typeof value.widgets.sleep === 'boolean'
    && Array.isArray(value.checkIns) && value.checkIns.every((c: unknown) => object(c) && text(c.routineId) && date(c.date) && ['done','skipped'].includes(c.status)
      && optional(c.minutes, integer) && optional(c.page, integer) && optional(c.drinks, integer) && optional(c.bookId, text));
}
export function isPreset(value: unknown): value is WorkoutPreset {
  if (!object(value) || !text(value.id) || !text(value.name) || !text(value.exerciseId) || !object(value.prescription)) return false;
  const p = value.prescription;
  return integer(p.sets) && p.sets > 0 && nonnegative(p.restSeconds) && (
    p.kind === 'reps' ? integer(p.reps) && p.reps > 0 && nonnegative(p.addedLoadKg) :
    p.kind === 'hold' ? (p.mode === undefined || p.mode === 'max') && number(p.holdSeconds) && p.holdSeconds > 0 && nonnegative(p.targetKg) && nonnegative(p.toleranceKg) && number(p.edgeMm) && p.edgeMm > 0 && text(p.grip) && ['left','right','both'].includes(p.hand) :
    p.kind === 'timed' ? number(p.holdSeconds) && p.holdSeconds > 0 :
    p.kind === 'paced' && integer(p.reps) && p.reps >= 0 && Array.isArray(p.steps) && p.steps.length > 0 && p.steps.every((s: unknown) => object(s) && text(s.label) && number(s.seconds) && s.seconds > 0));
}
export function isExercises(value: unknown): value is Exercise[] { return Array.isArray(value) && value.every(e => object(e) && text(e.id) && text(e.name) && ['training','rehab'].includes(e.category) && text(e.description) && optional(e.tags,strings)); }
export function isPresets(value: unknown): value is WorkoutPreset[] { return Array.isArray(value) && value.every(isPreset); }
export function isPlans(value: unknown): value is WorkoutPlan[] {
  return Array.isArray(value) && value.every(p => object(p) && text(p.id) && text(p.name) && text(p.description) && strings(p.presetIds) && p.presetIds.length > 0 && optional(p.exercises,isExercises) && optional(p.presets,isPresets) && new Set(p.presetIds).size === p.presetIds.length && p.presetIds.every(id => [...workoutPresets,...(p.presets ?? [])].some(preset => preset.id === id)));
}
function isSession(s: unknown): s is Session {
  return object(s) && text(s.id) && text(s.startedAt) && Number.isFinite(Date.parse(s.startedAt)) && optional(s.finishedAt, d => text(d) && Number.isFinite(Date.parse(d)))
    && isPreset(s.preset) && object(s.exercise) && text(s.exercise.id) && text(s.exercise.name) && ['training','rehab'].includes(s.exercise.category)
    && ['manual','tindeq','simulator'].includes(s.source) && Array.isArray(s.sets) && s.sets.every((set: unknown) => object(set) && integer(set.set) && set.set > 0 && ['completed','stopped','interrupted'].includes(set.status) && ['manual','tindeq','simulator'].includes(set.source)
      && optional(set.reps, integer) && optional(set.meanKg, nonnegative) && optional(set.peakKg, nonnegative) && optional(set.durationSeconds, nonnegative) && Array.isArray(set.trace))
    && ['ready','preparing','holding','result','rest','review'].includes(s.phase) && Array.isArray(s.trace) && Array.isArray(s.attempts)
    && optional(s.workout, w => object(w) && isPlans([w.plan]) && Array.isArray(w.prescriptions) && w.prescriptions.every(isPreset) && Array.isArray(w.sessions) && w.sessions.every(isSession));
}
export function isSessions(value: unknown): value is Session[] { return Array.isArray(value) && value.every(isSession); }
export function isViews(value: unknown): value is JournalView[] {
  const widget = (v: unknown) => ['rehab','sleep','climbing','weight','alcohol','reading','train','drinks','hardest','pullups','projects','wall','sends','sessions','strength','stages','calendar','habits','book','next','activity'].includes(String(v));
  return Array.isArray(value) && value.every(v => object(v) && text(v.id) && text(v.name) && strings(v.tags) && v.tags.every(t => [...categories,'reading'].includes(t))
    && Array.isArray(v.blocks) && v.blocks.every((b: unknown) => object(b) && text(b.id) && ['journal','todo','widgets','chart'].includes(b.type) && typeof b.enabled === 'boolean' && optional(b.widgets, w => Array.isArray(w) && w.every(widget)) && optional(b.chart, widget)));
}
export function isDraft(value: unknown): value is WorkoutDraft | null {
  return value === null || object(value) && text(value.route) && text(value.title) && number(value.updatedAt)
    && optional(value.session, isSession) && optional(value.flow, f => object(f) && object(f.snapshot) && isPlans([f.snapshot.plan]) && Array.isArray(f.snapshot.presets) && f.snapshot.presets.every(isPreset) && isSessions(f.sessions) && text(f.workoutId) && text(f.startedAt)
      && ['manual','tindeq','simulator'].includes(f.source) && strings(f.optional) && optional(f.skipped, strings) && (f.running === null || isPreset(f.running)) && (f.review === null || isSession(f.review)) && optional(f.runningSession, isSession));
}
