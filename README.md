# Speed Meetings

Speed Meetings runs short, structured team conversations. The organizer opens a temporary room, participants join by QR code, and the host starts a timed session when everyone is ready.

There are no accounts or permanent participant records. Display names, pairings, and timer state are scoped to a room. Participants see only their own partner assignment on their phone; the host sees the projected conversation groups.

## Run locally

```sh
npm install
npm run dev -- --host 0.0.0.0
```

For phone testing on the same Wi-Fi, open the app using the computer's LAN address rather than `localhost`. The QR code uses the current page origin.

## Test and build

```sh
npm test
npm run lint
npm run build
```

The test suite includes live HTTP integration tests that start an isolated local Vite server, join 23, 27, 36, or 100 participants concurrently, and check assignments, shared icebreaker questions, and deadlines through eight rounds, pause/resume, and completion. The odd-attendance tests check eleven or thirteen pairs and one rotating break per round, with eight different people taking the eight breaks. Run these alone with `npm test -- src/rooms.integration.test.ts`. This tests the local room service, not physical phones or the deployed Netlify storage.

Production files are written to `dist/`.

## Deploy to Netlify

Deploy the repository to Netlify. `netlify.toml` configures the Vite build and SPA fallback. The `rooms` function stores active session records in Netlify Blobs.

Each room has a randomized code and host secret. Signup closes after three minutes. The room expires after two hours, is deleted when the host ends the session, and expired records are swept when a new room is created. For local development, Vite provides the same API with in-memory storage; those rooms are cleared when the dev server restarts.

## Session flow

The homepage has one action: Set up session. The host chooses rounds, meeting length, finding time, prompts, auto-advance, and sound. Start session opens a temporary QR room and begins a three-minute signup window. The host sees the live check-in list and presses Start the meet when ready, with at least two participants. Partner assignments appear immediately, followed by the configured finding countdown before the first conversation. No opening animation is shown.

Participants enter their first name and optionally a surname on their phone. Only the surname initial is sent and displayed. Matching first names without initials become numbered labels such as Alex 1 and Alex 2; matching initials are numbered too. Existing participants' labels update on their phones when another matching name joins.

Participants select their team and role from dropdowns on their phone; the host uses the same dropdowns when adding someone manually. Teams are AI talk team, Design system team, Web purchase team, Web inLife team, App team, Hive, Solver team, and UX research and Service design. Roles are Product designer, Lead designer, Senior designer, and Director of design.

Pairings prioritize new cross-team conversations. When no new cross-team match is available, a new same-team conversation is allowed as a last resort and the host sees a notice. Design directors never meet leads, and conversations never repeat within the session. Team comparisons ignore case and extra spaces. Existing participants without team or role information remain supported. If no eligible match remains even within their team, the participant takes a break and the host sees a notice.

The host view shows conversation names with an icon and coloured background. Each phone shows only that participant's partners, the same background colour, and shared timer, without a matching symbol. Participant names make matching independent of colour.

Dancing pixel characters appear in the host lobby and on phone waiting, matching, break, and completion screens. Live phone screens use a single vertical stack: dancers above the round heading, the participant's first name in bold above "you are meeting", partner's full display name, icebreaker, then an unboxed timer. Phone pairs change with the round and finding/conversation phase. Characters stay still when the device requests reduced motion.

Odd attendance gives one person a break rather than creating a group of three. Breaks rotate, prioritizing people who have had fewer breaks while respecting matching restrictions. The host sees a BREAK card; the participant sees "Take a short break" and a countdown instead of partner names or an icebreaker. There are no staying or moving group assignments in the interface; everyone sees their next conversation or break during transition time.

The countdown uses an absolute deadline, so host and phone timers stay aligned across refreshes and backgrounding. Pause, resume, skip, early-advance, and end-session controls are available to the host.

## Organizer settings

Session settings are chosen before opening the QR room. The saved default is eight three-minute conversations, each preceded by thirty seconds to find a partner. The meetup estimate excludes the separate three-minute QR signup window. The host can change the timings for each meetup.

Custom icebreaker prompts and organizer preferences are saved locally in the versioned `meetup.app.v1` browser key. Existing storage identifiers are retained across app renames to preserve saved preferences and active rooms. Temporary attendee names and pairings are not added to the saved master team data.

The built-in library contains 60 simple, light-hearted questions about favourites such as sandwiches, colours, holidays, films, and songs. Questions are shuffled for each session without repeats. Existing unchanged built-in questions are refreshed automatically on reload, preserving disabled choices, edited questions, and custom prompts. Active sessions keep their existing questions until a new session starts.

Change the visible app name in `src/domain.ts` (`APP_NAME`) and the browser title in `index.html`.
