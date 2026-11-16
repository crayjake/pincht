# pincht

A tracking and journalling tool built for climbers.

Run with Node 24 LTS:

```sh
npm ci
npm run dev
npm test
npm run build
```

Open **Train** in the primary navigation, preview a workout, then start it. Pulley rehab runs tendon glides, isometric squeezes, then measured three-finger drag; half crimp is shown locked from week 2. Mobility runs the glides and squeezes separately. Pull-ups record actual reps and added load. Force holds support real Tindeq measurements on iPhone and compatible desktop browsers, timed manual entry, and a labelled simulator. Workout creation, editing, and scheduling are outside this implementation.

Edit exercises, prescriptions, workout order, and locks in [`src/workouts/fixtures.ts`](src/workouts/fixtures.ts). Values follow the supplied Train flow reference: tendon glides are 6 reps through five positions at 2 s each; squeezes are 6 × 10 s with 30 s rest; left-hand, 20 mm, three-finger drag is 6 × 15 s at ~10 kg with 60 s rest; pull-ups are 3 × 5 bodyweight reps with 90 s rest. Squeeze rest and the locked half-crimp target are assumptions marked in the fixture, not a verified clinical prescription. The lock is fixture-controlled; there is no automatic week-based scheduling. Sessions snapshot the whole prescription and save actual results grouped by exercise.

## Today and journal

Today follows the supplied six-screen HTML reference: Due today, rehab and sleep widgets, journal history, full-screen search, welcome-back check-ins, and reading logs. A horizontal divider separates Train from the earlier unlogged check-in. Expanded entries show all records with a back action and no primary navigation or new-entry button.

Reading supports usual-time quick completion, book selection, page progress, and backdated logs. Alcohol check-ins track daily drinks against a Monday-based weekly allowance. Routine history distinguishes unlogged days from explicitly skipped days. Saved real workouts drive the weekly Train count and scheduled rehab completion; simulator sessions are excluded. The rehab widget uses 20 mm drag results alongside sample drag data, while the original max-hang samples remain available separately.

Screens without a supplied reference carry **In development · Awaiting UI/UX pass**, including Climbs, Metrics, Train, routine settings, book selection, filters, and supporting editors/detail sheets. These screens use the existing theme and await design review.

Routine configuration, books, check-ins, widget visibility, and the last Today visit use `pincht.routines` in localStorage. Journal and workout stores and the existing sample data are retained. There is one current routine format and no legacy migration layer. The additional automated checks cover reading/book changes, backdated and skipped logs, welcome-back bulk actions, individual search results and filters, expanded navigation, weekly counts, and simulator exclusion. Visual comparison at 375 × 812 remains pending because the browser access host was unavailable during implementation.

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

5. Turn on the Progressor and Bluetooth on the phone. Close other apps connected to that Progressor. In pincht choose **Train → Open workout** for Pulley rehab. Expand **Change** in the device row and select **Tindeq Progressor**. Start the workout, complete glides and squeezes, then start **3-finger drag → Connect**. Allow Bluetooth access, select the Progressor, remove all load, and tap **Tare → Start hold**. For a quick isolated BLE test, open `/#/train/finger-rehab` instead. The Bluetooth purpose string is in `ios/App/App/Info.plist` under `NSBluetoothAlwaysUsageDescription`.

6. Verify the following on the device:

   - At 375 × 812 logical points, in light and dark mode, read the force, timer, and primary action from arm's length. Check the notch and home-indicator safe areas, and that the chart and controls remain reachable when scrolling.
   - Apply force: see fresh kg readings, the trace, and the configured 9–11 kg target band. The timer begins on the first measurement. A complete hold shows mean force and recorded duration; **Keep set** starts the 60 s rest, and **Skip rest** advances. The sixth kept set opens review directly.
   - **Retry** repeats the same set without keeping the discarded measurement. **Stop hold** creates a partial result which can be kept. **Stop → Stop exercise** returns to the workout overview with only kept sets. **Finish workout & review** reviews those results. The isolated BLE shortcut has a **Review & finish** header action.
   - Glides cycle through five named positions, six times. Check the 5 s preparation timer, pause/resume, and the squeeze work/rest timers. Completing an exercise returns to the numbered workout overview; finishing the last unlocked exercise goes to review. Half crimp remains locked.
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
3. Turn on computer Bluetooth and the Progressor. Close any phone app or other program connected to that Progressor. Open **Train → Open workout** for Pulley rehab, expand **Change**, and select **Tindeq Progressor**. After glides and squeezes, start **3-finger drag → Connect**, select the Progressor in the browser's device chooser, and confirm. For a quick isolated BLE test, open `/#/train/finger-rehab`, select Tindeq, then **Start workout → Connect**. The Tindeq option is selected by default when browser support is available; the app never silently substitutes simulated measurements.
4. Remove all load and choose **Tare → Start hold**, then apply force. Check the live kg, target band, trace, and timer. Keep a completed or stopped hold, finish early or complete the workout, then save. These records are labelled **Tindeq Progressor** and go into real workout history and the journal.
5. Test **Retry**, disconnecting the Progressor, and switching browser tabs during a hold. Interrupted attempts cannot be kept. Retry requires tare, and a lost connection also requires Connect. Leaving the session or entering review stops streaming and releases the connection.

If **Tindeq Progressor** is disabled, read the setup message under the measurement choices: it identifies an insecure page or missing browser API. If connection reports no active adapter, check computer Bluetooth settings. If the chooser is empty, make sure the Progressor is awake, nearby, and disconnected from other apps. For blocked access, allow Bluetooth in this browser's site settings and click Connect again. This path has automated browser/GATT integration coverage, but physical desktop/Progressor testing has not been performed in this environment.

## Manual entry, simulator, and storage

The web app also offers **Manual entry** (timed holds followed by an entered measured mean) and **Simulator · test only** (generated force). The simulator includes **Test stream disconnect**. It uses the same session reducer and screens as BLE, and honours visibility interruptions. Manual records are explicitly labelled; their means are entered by the user, not measured by the app.

Saved real sessions use `pincht.workouts.v1` in localStorage. Simulator sessions use `pincht.workout-simulations.v1`, appear under **Simulator tests**, and are excluded from workout history and the journal. The existing journal store remains `pincht.journal.v1`; saved workouts are projected into it by stable session IDs without duplicate records. A session stores its prescription and exercise snapshots, actual set results, source, full trace where available, attempted/interrupted measurements, timestamps, and optional symptom note. Only explicitly kept sets enter workout results. Saving is idempotent by session ID; a failed write leaves review available for retry. Storage is local to the browser or app installation; in-progress sessions are held in memory until Save.

`npm test` runs domain/protocol/transport tests and DOM interaction tests with controlled clocks, including preparation, paced glides, pause/resume, rest deadlines, exercise transitions, whole-workout saving, retry, partial holds, stale samples, disconnect/background interruptions, native App lifecycle callbacks, teardown, save failures, snapshots, and simulator isolation. Browser integration tests run through the installed BLE plugin's real web implementation against mocked `navigator.bluetooth`/GATT objects, covering discovery filters, command writes, notification decoding, permission/cancellation errors, missing adapters, disconnect/reconnect, saving real results, and teardown. They do not substitute for visual or hardware testing.

## Implementation map

- `src/routines/`: routine scheduling, check-ins, book progress, Today card, reading/welcome sheets, and drag-load projection.
- `src/components/home/journal-search-data.ts` / `journal-search.tsx`: individual record/entry/routine search and full-screen filters.
- `src/components/app-navigation.tsx` / `home/library-pages.tsx`: Today/Journal/Climbing/Train navigation and development-marked destinations; Climbs and Metrics remain available as detail screens.
- `src/components/home/journal-views.ts`: the Climbing preset’s activity and routine scope.
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
