# pincht

A tracking and journalling tool built for climbers.

Run with Node 24 LTS:

```sh
npm ci
npm run dev
npm test
npm run build
```

Open an existing workout from Today or Train. The personal pulley plan starts on 13 November 2026 (injury on 4 November); wrist rehab starts on 16 November 2026. No separate onboarding, advice screen, or care tracker is included.

## Personal rehab plans

The app implements the supplied pulley plan, wrist email, and wrist strengthening PDF. It uses calendar dates for exercise availability; symptom guidance still applies. Rehab uses the existing workout previews, session timers, review, and journal records.

- **Pulley, first 14 full days:** tendon glides and isometric mug grips, 2–3 times daily; no climbing or forced gripping. The guided starting choices are six glide cycles through five positions at 2 seconds each, and six 10-second mug grips with self-paced rest. They sit within the supplied repetition/hold ranges.
- **Pulley, after 14 full days:** open-handed three-finger drag becomes available, initially approximately 10 kg, six 15–20-second holds with 60 seconds rest, on alternate days. Glides and mug grips become optional and are unchecked by default.
- **Pulley, after 28 full days:** half crimp also becomes available if tolerated, once a confirmed load has been entered. This is the requested four-full-week timing; the original plan mentions week 4. The loading hold duration is configurable as 15 or 20 seconds.
- **Wrist phase 1, first 14 full days:** five sets of 10 comfortable-midrange isometric repetitions, 3 seconds on / 3 seconds off, 3 minutes between sets. The repetition count is Jake's chosen setting. Weight is not invented.
- **Wrist phase 2, next two or three weeks:** four sets of 8–12 eccentric repetitions, 3 seconds lowering, 3 minutes between sets. The timer waits for the unaffected hand to return the weight before each next repetition.
- **Wrist phase 3:** four sets of 5–8 full-range repetitions, 1 second up / 1 second hold / 2 seconds down, 3 minutes between sets. Only the current wrist phase is active, 2–3 sessions per week.

Today derives workout completion from saved, complete real exercises. Partial exercises and simulator sessions do not complete rehab tasks. Availability updates after midnight and on returning to the app.

Exercise definitions live in [`src/workouts/fixtures.ts`](src/workouts/fixtures.ts); date-based availability live in [`src/rehab/data.ts`](src/rehab/data.ts). Sessions snapshot their prescription and save actual results grouped by exercise. Pull-ups and Mobility remain available; pull-ups are locked during the initial pulley gripping-rest period. Workout creation and editing are outside this MVP.

## Today and journal

Today opens **To-do**, with Today, This week, and Coming up sections. Journal keeps inline writing with today's tasks inside its entry. Widgets live in custom views; the default Climbing view scopes tasks and days to climbing-related activity. Climbs and Metrics remain supporting detail destinations.

Open **Routines** from To-do to add, edit, pause, or resume routines. Fixed-day schedules, rest days after completion, and weekly targets are editable, including which workouts count and which views include the routine. Changing a rehab routine's schedule overrides its due dates; its prescribed exercise phases remain in the workout.

Open **Views** from the custom view header to create views, or **Edit view** to change the current one. Choose filters, enable and reorder blocks, select widgets or charts, and choose the view shown in the third navigation tab. View and routine settings are stored independently in Real and Demo modes.

The journal's `@` picker can reference existing climbs, workouts, goals, charts, and books, or create a new climb. Mentioning a climb starts a fresh log for that day, with no inherited attempts or notes. Expanded records support go counts, sent status, removing individual goes, and notes. Mentioning a workout adds a reference; completing and saving its workout is still explicit. Records combine items logged that day with items referenced in the writing.

Use **Today → Stored data** to switch between **Real** and **Demo / testing**. This build starts in Demo mode until you choose otherwise, then remembers the selected mode on this device. Each mode has its own saved journal, habits/books, workouts, and simulator history. Switching never clears or copies over the other mode's records. Demo mode is populated once with six weeks of example days, fifteen journal entries, sleep, reading, and workout measurements relative to the day it is first opened; subsequent demo edits are retained.

Real mode keeps your existing personal rehab dates and saved workouts. It starts without example books, journal entries, check-ins, sleep values, or force measurements. The rehab chart stays empty until real drag measurements are saved. Reading supports adding a real book, page progress, and backdated logs. Saved workouts appear in the selected mode's journal automatically. An empty Today composer is not saved as a written journal entry.

Supporting screens carry **In development · Awaiting UI/UX pass** and use the existing theme. Expanded journal entries have a back action without the primary navigation. Skipped habits are hidden except immediately after a skip, when Undo remains available.

There is one current data format, with no legacy migration layer. Prototype journal/routine stores are no longer loaded. Existing real saved workouts are retained. Storage is local to this browser or app installation; there is no account or cloud sync. Visual comparison at 375 × 812 remains pending because the browser access host was unavailable during implementation.

## Physical iPhone testing on macOS

Use a Mac with **Xcode 26 or newer**, its iOS platform support installed, and Node 24 LTS. Capacitor core, iOS, App, and the community BLE plugin all use major version 8. The checked-in iOS project uses Swift Package Manager; CocoaPods is not required. See [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup).

1. Install/open Xcode once, accept its licence, and install the iOS platform if prompted. In Terminal select the full Xcode installation:

   ```sh
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   xcodebuild -version
   ```

2. From this repository on the Mac, install dependencies, test, build, sync the bundled web app and native plugins, and open Xcode:

   ```sh
   npm ci
   npm test
   npm run ios:sync
   npm run ios:open
   ```

   `ios:sync` runs the production build followed by `cap sync ios`. Run it again after changing web code or dependencies. Do not run `cap add ios` again. There is no development server URL in the native configuration; the app runs its bundled assets offline.

3. In Xcode, wait for package resolution. Select the **App** project → **App** target → **Signing & Capabilities**. Enable **Automatically manage signing**, choose your Apple development team, and use a unique bundle identifier if `com.pincht.app` is unavailable. Keep `capacitor.config.ts`'s `appId` consistent if you change it. No Bluetooth background capability is needed: holds deliberately interrupt when the app backgrounds.

4. Connect an unlocked **physical iPhone 13 mini** by cable. Trust the Mac on the phone. Enable **Settings → Privacy & Security → Developer Mode** on the phone if required, reboot, and confirm. In Xcode choose the **App** scheme and the connected iPhone as the run destination, then **Product → Run** (⌘R). If iOS asks to trust your development certificate, use **Settings → General → VPN & Device Management**. The deployment target is iOS 15 or newer; Xcode must support the installed device OS.

5. Turn on the Progressor and Bluetooth on the phone. Close other apps connected to that Progressor. Three-finger drag is unavailable until 14 full days after the pulley start date. Once available, choose **Train → Open workout** for Pulley rehab. Expand **Change** in the device row and select **Tindeq Progressor**. Start the workout, optionally include glides and mug grips, then start **3-finger drag → Connect**. Allow Bluetooth access, select the Progressor, remove all load, and tap **Tare → Start hold**. For a quick isolated BLE test, open `/#/train/finger-rehab` instead. The Bluetooth purpose string is in `ios/App/App/Info.plist` under `NSBluetoothAlwaysUsageDescription`.

6. Verify the following on the device:

   - At 375 × 812 logical points, in light and dark mode, read the force, timer, and primary action from arm's length. Check the notch and home-indicator safe areas, and that the chart and controls remain reachable when scrolling.
   - Apply force: see fresh kg readings, the trace, and the configured target band (9–11 kg with the starting 10 kg target). The timer begins on the first measurement. A complete hold shows mean force and recorded duration; **Keep set** starts the 60 s rest, and **Skip rest** advances. The sixth kept set opens review directly.
   - **Retry** repeats the same set without keeping the discarded measurement. **Stop hold** creates a partial result which can be kept. **Stop → Stop exercise** returns to the workout overview with only kept sets. **Finish workout & review** reviews those results. The isolated BLE shortcut has a **Review & finish** header action.
   - Glides cycle through five named positions, six times. Check the 5 s preparation timer, pause/resume, and mug-grip holds with self-paced rest. Completing an exercise returns to the numbered workout overview; finishing the last selected exercise goes to review. Half crimp stays locked until 28 full days and a confirmed load. Check each wrist phase separately: only its exercise is available; verify the 3-second on/off timer, assisted eccentric returns, full-range tempo, and 3-minute rests.
   - Turn off or move the Progressor out of range during a hold. A disconnect or 1.5 s without fresh samples must interrupt the attempt, remove **Keep set**, and require retry/tare (and reconnect after disconnect). Old readings must not stay displayed as live.
   - Press Home, switch apps, or lock the phone during a hold. Return to see an interrupted attempt, then retry. No background force data is accepted as a completed set.
   - Deny Bluetooth access, then use the on-screen settings action to restore it in **Privacy & Security → Bluetooth**. Try cancelling discovery and turning Bluetooth off. Each failure must leave a recoverable connection screen.
   - Leave a session or enter review: confirm the Progressor stops streaming. Reconnect from a new session. Save with a symptom note, relaunch the app, and check actual results and prescription in Train history and the entry in the journal.
   - For pull-ups, change actual reps and added kg, complete a set, wait/skip rest, and complete the third set. It must go directly to review. Save and check all three actual results.

The iOS Simulator does not provide Progressor BLE; use a physical phone for this checklist. This implementation was built and automatically tested on Linux. **Xcode compilation, physical iPhone/Progressor testing, and visual browser verification were not possible in that environment** (no Xcode/device; browser access host unavailable). The checklist above remains required hardware verification.

## Real Tindeq testing on a Linux computer

The desktop app uses the BLE plugin's Web Bluetooth implementation, with the same Progressor protocol, workout state, and history as iPhone. You need a working Bluetooth Low Energy adapter and a browser exposing Web Bluetooth. See [Chrome's Web Bluetooth setup](https://developer.chrome.com/docs/capabilities/bluetooth) and the [plugin's web support](https://github.com/capacitor-community/bluetooth-le#platform-support).

1. Use **Chrome or Chromium**. On Linux, open `chrome://flags/#enable-experimental-web-platform-features`, enable **Experimental Web Platform features**, and relaunch the browser. Browser builds and operating-system Bluetooth support vary; the app checks whether the API is exposed and shows setup guidance if it is unavailable.
2. In this repo run `npm ci` if dependencies are not installed, then `npm run dev`. Open the printed **http://localhost:…** URL in that browser. Use localhost or HTTPS: opening an ordinary HTTP network IP address will disable Web Bluetooth. No Xcode or iPhone is required for this desktop test.
3. Turn on computer Bluetooth and the Progressor. Close any phone app or other program connected to that Progressor. Once drag is available (after 14 full days), open **Train → Open workout** for Pulley rehab, expand **Change**, and select **Tindeq Progressor**. Optionally include glides and mug grips, then start **3-finger drag → Connect**, select the Progressor in the browser's device chooser, and confirm. For a quick isolated BLE test, open `/#/train/finger-rehab`, select Tindeq, then **Start workout → Connect**. The Tindeq option is selected by default when browser support is available; the app never silently substitutes simulated measurements.
4. Remove all load and choose **Tare → Start hold**, then apply force. Check the live kg, target band, trace, and timer. Keep a completed or stopped hold, finish early or complete the workout, then save. These records are labelled **Tindeq Progressor** and go into real workout history and the journal.
5. Test **Retry**, disconnecting the Progressor, and switching browser tabs during a hold. Interrupted attempts cannot be kept. Retry requires tare, and a lost connection also requires Connect. Leaving the session or entering review stops streaming and releases the connection.

If **Tindeq Progressor** is disabled, read the setup message under the measurement choices: it identifies an insecure page or missing browser API. If connection reports no active adapter, check computer Bluetooth settings. If the chooser is empty, make sure the Progressor is awake, nearby, and disconnected from other apps. For blocked access, allow Bluetooth in this browser's site settings and click Connect again. This path has automated browser/GATT integration coverage, but physical desktop/Progressor testing has not been performed in this environment.

## Manual entry, simulator, and storage

The app offers **Manual entry** (timed holds followed by an entered measured mean). Manual records are explicitly labelled; their means are entered by the user, not measured by the app. Development builds additionally expose **Simulator · test only**, generated force and **Test stream disconnect**, for exercising the BLE flow. Production/iPhone builds hide simulator controls and simulator history.

Saved real sessions use `pincht.workouts.v1` in localStorage. Simulator sessions use `pincht.workout-simulations.v1`, appear under **Simulator tests**, and are excluded from workout history and the journal. Current journal writing uses `pincht.journal.live`, routine/book data uses `pincht.routines.live`, and custom views use `pincht.views`. Demo mode uses separate `.demo` keys. Saved workouts are projected into the journal by stable IDs without duplicate records. The old prototype journal/routine keys are ignored. A session stores its prescription and exercise snapshots, actual set results, source, full trace where available, attempted/interrupted measurements, timestamps, and optional symptom note. Only explicitly kept sets enter workout results. Saving is idempotent by session ID; a failed write leaves review available for retry. Storage is local to the browser or app installation; in-progress sessions are held in memory until Save.

`npm test` runs domain/protocol/transport tests and DOM interaction tests with controlled clocks, including preparation, paced glides, pause/resume, rest deadlines, exercise transitions, whole-workout saving, retry, partial holds, stale samples, disconnect/background interruptions, native App lifecycle callbacks, teardown, save failures, snapshots, and simulator isolation. Browser integration tests run through the installed BLE plugin's real web implementation against mocked `navigator.bluetooth`/GATT objects, covering discovery filters, command writes, notification decoding, permission/cancellation errors, missing adapters, disconnect/reconnect, saving real results, and teardown. They do not substitute for visual or hardware testing.

## Implementation map

- `src/rehab/`: personal prescription dates, phase availability, and derived workout tasks.
- `src/components/home/journal-storage.ts`: current journal loading without sample history.
- `src/routines/`: routine scheduling and editing, check-ins, book progress, To-do sections, reading/welcome sheets, and drag-load projection.
- `src/components/home/journal-search-data.ts` / `journal-search.tsx`: individual record/entry/routine search and full-screen filters.
- `src/components/app-navigation.tsx` / `home/library-pages.tsx`: Today/Journal/Climbing/Train navigation and development-marked destinations; Climbs and Metrics remain available as detail screens.
- `src/components/home/journal-views.ts` / `view-pages.tsx`: stored custom views, filters, ordered blocks, widgets, charts, and tab placement.
- `src/components/home/journal-climbs.ts` / `journal-records.tsx`: climb mentions, daily go counts, sends, and record notes.
- `src/workouts/fixtures.ts`: editable typed exercises, presets, and workout plans.
- `src/workouts/workout.ts`: whole-workout summaries and prescription snapshots.
- `src/workouts/session.ts`: pure workout state and timer transitions, independent of BLE and React. Rest/manual timers use deadlines. BLE completion and recorded duration use device timestamps, including uint32 rollover; fresh samples are required through the prescribed duration.
- `src/workouts/progressor-protocol.ts`: official service/characteristic UUIDs, command bytes, and defensive little-endian TLV decoding. Batched weight values are float32 kg plus uint32 microseconds.
- `src/workouts/bluetooth-support.ts`: native/browser capability and secure-context checks, with desktop setup guidance.
- `src/workouts/transport.ts`: native and Web Bluetooth discovery, subscriptions, queued control writes, disconnect handling, and cleanup; separate simulator transport.
- `src/components/train/use-session.ts`: connects transport, reducer, foreground lifecycle, and timer ticks. Review/unmount stops streaming and removes notification subscriptions; backgrounding invalidates tare and interrupts active holds.
- `src/workouts/storage.ts`: local persistence and projection into the existing journal.
- `src/components/train/train.tsx` / `train.scss`: preview, shared active layout, review, history, and save feedback. Hash navigation reuses the journal routes and existing theme tokens; force is 92 px, measured hold time 48 px, ring timers 64 px, and the primary button at least 64 px high.

Protocol reference: [official Tindeq Progressor API](https://tindeq.com/progressor_api/) and its linked [reference client](https://github.com/blims/Tindeq-Progressor-API). Discovery filters service `7e4e1701-1ea6-40c9-9dcc-13d34ffead57`; notifications use `…1702…`, control writes use `…1703…`. Parameterless tare/start/stop commands are single bytes `0x64`/`0x65`/`0x66`. Integration and iOS permission guidance: [Capacitor community BLE plugin](https://github.com/capacitor-community/bluetooth-le).
