# Pixel Pairs

Pixel Pairs runs short, structured team conversations. The organizer opens a temporary room, participants join by QR code, and the host starts a timed session when everyone is ready.

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

Production files are written to `dist/`.

## Deploy to Netlify

Deploy the repository to Netlify. `netlify.toml` configures the Vite build and SPA fallback. The `rooms` function stores active session records in Netlify Blobs.

Each room has a randomized code and host secret. Signup closes after three minutes. The room expires after two hours, is deleted when the host ends the session, and expired records are swept when a new room is created. For local development, Vite provides the same API with in-memory storage; those rooms are cleared when the dev server restarts.

## Session flow

The homepage has one action: Set up session. The host chooses rounds, meeting length, finding time, prompts, auto-advance, and sound. Start session opens a temporary QR room and begins a three-minute signup window. The host sees the live check-in list and presses Start the meet when ready, with at least two participants. Partner assignments appear immediately, followed by the configured finding countdown before the first conversation. No opening animation is shown.

Participants enter their first name and optionally a surname on their phone. Only the surname initial is sent and displayed. Matching first names without initials become numbered labels such as Alex 1 and Alex 2; matching initials are numbered too. Existing participants' labels update on their phones when another matching name joins.

Participants can optionally enter their team. Pairings prefer people from different teams, comparing team names without case or extra-space differences. Same-team matches are minimized first, then repeated conversations. If attendance makes cross-team matching impossible, everyone is still included and the host sees a warning. Missing teams do not restrict matching.

The host view shows conversation names with a recognizable matching icon and coloured background. Each phone shows only that participant's partners, the same icon, background colour, and shared timer. Icon names and participant names make matching independent of colour.

Odd attendance uses one group of three so nobody sits out. There are no staying or moving group assignments in the interface; everyone sees their next conversation during transition time.

The countdown uses an absolute deadline, so host and phone timers stay aligned across refreshes and backgrounding. Pause, resume, skip, early-advance, and end-session controls are available to the host.

## Organizer settings

Session settings are chosen before opening the QR room. The saved default is eight three-minute conversations, each preceded by thirty seconds to find a partner. The meetup estimate excludes the separate three-minute QR signup window. The host can change the timings for each meetup.

Custom icebreaker prompts and organizer preferences are saved locally in the versioned `pixel-pairs.app.v1` browser key. Temporary attendee names and pairings are not added to the saved master team data.

Change the visible app name in `src/domain.ts` (`APP_NAME`) and the browser title in `index.html`.
