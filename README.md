# Speed Meets

Speed Meets runs short, structured team conversations. The organizer opens a temporary room, participants join by QR code, and the host starts a timed session when everyone is ready.

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

The Peach Disco theme combines warm cream, bold peach and plum panels, raspberry pill buttons, and lilac highlights, with chunky sans-serif headings, strong plum outlines, and character-led illustrations. Outlined timing and options cards sit alongside a lilac session summary on desktop. Phone layouts remain vertically stacked, and colour transitions respect reduced-motion preferences. Conversation matching retains its distinct shared phone and room colours.

The welcome screen uses "A simple way to network" and a full-page light sand background without a surrounding card. On desktop, the characters sit directly on the background with generous space before the headline and actions; on phones, the actions come before the illustration. The signup lobby prioritizes a large black-on-white QR code in an outlined panel, with check-ins, signup timing, meeting count, and start controls alongside it. Manual entry is available under "Add someone without a phone", with unboxed fields, strong input outlines, and a compact add button. On phones the QR code stays full-width above the host controls.

Session setup uses an unboxed heading, timing and options on the left, and a compact summary with a larger dancing character and start action on the right. Theme choices use large native checkboxes with plain labels. Back controls pair their text with a gently moving pixel character pointing left; reduced-motion preferences disable that movement. On smaller screens the settings and summary stack in reading order.

The live host screen aligns the timer, current instruction or icebreaker, and finding-time action in a compact outlined row. Conversation names follow immediately in a responsive grid of rounded matching-colour cards. Focus view enlarges the names without enlarging the timer panel; mobile layouts stack the cards and keep the countdown beside the instruction.

Saved sessions reopen on an unboxed recovery screen with the participant count and current round, a primary "Return to session" action, and a secondary "Start fresh" action. Returning keeps the timer paused.

The homepage has one action: Set up session. The host chooses meeting length, finding time, prompts, auto-advance, and sound. Start session opens a temporary QR room and begins a three-minute signup window. The host sees the live check-in list, chooses from the calculated available rounds, and presses Start the meet when ready, with at least three participants. Partner assignments appear immediately, followed by the configured finding countdown before the first conversation. No opening animation is shown. Starting fresh or setting up another session returns to the same compact setup screen.

Participants enter their first name and optionally a surname on their phone. Only the surname initial is sent and displayed. Matching first names without initials become numbered labels such as Alex 1 and Alex 2; matching initials are numbered too. Existing participants' labels update on their phones when another matching name joins.

Participants select their team and role from dropdowns on their phone; the host uses the same dropdowns when adding someone manually. Teams are AI talk team, Design system team, Web purchase team, Web inLife team, App team, Hive, Solver team, and UX research and Service design. Roles are Product designer, Lead designer, Senior designer, and Director of design.

New QR sessions use strictly cross-team pairings: no same-team fallback, repeated conversations, or director–lead matches. Team comparisons ignore case and extra spaces; older participants without team or role information remain supported. Each round includes everyone, with one rotating break for odd attendance. A participant does not take a second break before everyone else has had one.

The lobby offers 1–40 rounds within a verified schedule calculated from the actual teams and roles, not just headcount. Four unrestricted people can have three rounds, two teams of two can have two, and five unrestricted people can have five rounds including rotating breaks. If no complete eligible round is possible, starting is disabled with an explanation. The planner uses round-robin scheduling for unrestricted rooms and maximum-cardinality graph matching with alternative schedule attempts for constrained rooms. Its offered cap is a verified safe schedule, not a guarantee of the globally optimal number of rounds for every constrained graph. The backend independently validates the complete submitted schedule, so stale or manually altered requests cannot bypass these rules. Existing saved/live schedules are not rewritten.

The host view shows conversation names with an icon and coloured background. Each phone shows only that participant's partners, the same background colour, and shared timer, without a matching symbol. Participant names make matching independent of colour.

Dancing pixel characters appear in the host lobby and on phone waiting, matching, break, and completion screens. Each character has an individual tempo and routine, from relaxed shuffles and disco pointing to shoulder dips and energetic arm pumps. Their timing follows the character across solo, pair, and group illustrations; wheelchair wheels remain grounded during upper-body moves. Live phone screens use a single vertical stack: dancers above the round heading, the participant's first name in bold above "you are meeting", partner's full display name, icebreaker, then an unboxed timer. Phone pairs change with the round and finding/conversation phase. Characters stay still when the device requests reduced motion.

Odd attendance gives one person a break rather than creating a group of three. Breaks rotate, prioritizing people who have had fewer breaks while respecting matching restrictions. The host sees a BREAK card; the participant sees "Take a short break" and a countdown instead of partner names or an icebreaker. There are no staying or moving group assignments in the interface; everyone sees their next conversation or break during transition time.

The countdown uses an absolute deadline, so host and phone timers stay aligned across refreshes and backgrounding. Pause, resume, skip, early-advance, and end-session controls are available to the host.

## Organizer settings

Session settings are chosen before opening the QR room. The saved default is eight three-minute conversations, each preceded by thirty seconds to find a partner. The meetup estimate excludes the separate three-minute QR signup window. The host can change the timings for each meetup.

Custom icebreaker prompts and organizer preferences are saved locally in the versioned `meetup.app.v1` browser key. Existing storage identifiers are retained across app renames to preserve saved preferences and active rooms. Temporary attendee names and pairings are not added to the saved master team data.

The built-in library contains 60 simple, light-hearted questions about favourites such as sandwiches, colours, holidays, films, and songs. Questions are shuffled for each session without repeats. Existing unchanged built-in questions are refreshed automatically on reload, preserving disabled choices, edited questions, and custom prompts. Active sessions keep their existing questions until a new session starts.

Change the visible app name in `src/domain.ts` (`APP_NAME`) and the browser title in `index.html`.
