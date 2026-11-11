for ai slop if you wanna vibe updates ig
# How the bot is put together

Read this first if you want to change something. Nothing is registered by hand: `index.ts` looks in the folders below and picks up every file, so a new command, button or task only needs its file.

## Where things are

| Folder | What goes there |
|---|---|
| `assets/commands/` | Slash commands. A single file is one command, a folder is one command with subcommands (see below) |
| `assets/buttons/`, `selectmenus/`, `autocompletes/` | One file per button, select menu or autocomplete, found by its `customId` / `name` |
| `assets/repeating/` | Tasks that run on a timer or at a clock time. The file says when (`data`) and what (`execute`) |
| `events/` | One file per Discord event (a member joins, a message is sent...) |
| `features/` | The logic of one feature that **more than one file uses** (a command and a button, a command and a repeating task...) |
| `utils/` | Small helpers that know nothing about a specific feature: database access, permissions, logging, parsing |
| `db/` | The database tables (`schema.ts`) and the connection |
| `scripts/` | Things you run by hand, not part of the bot |

## Where does new code go?

1. Only one command/button/event/task needs it? **Write it in that file**, above the code that uses it.
2. Several subcommands of the same command need it? `assets/commands/<command>/shared.ts` (like `mod/shared.ts`).
3. A command and a button/event/task need it? `features/<feature>.ts`.
4. Does it have nothing to do with one feature (turn text into a duration, check a permission)? `utils/`.

Don't make a new file for something one file uses. A `features/` file that only one place imports should be moved into that place.

## Adding things

**A command** with no subcommands: a file in `assets/commands/` that default-exports `{ data, execute }` (see `ping.ts`).

**A command with subcommands**: a folder `assets/commands/<name>/` with
- `main.ts`: the command itself. It builds `data` from the subcommands' `builder` and runs `RunSubcommand(import.meta.url, interaction)`
- one file per subcommand that exports `builder` (its options) and a default function (what it does). The file name is the subcommand name
- `shared.ts` for what the subcommands share (this name is never treated as a subcommand)

**A button / select menu**: a file in `assets/buttons/` (`selectmenus/`) with `data: { customId }` and `execute`. Ids with extra info are `name:info:more`, only the part before the first `:` is looked up.

**A repeating task**: a file in `assets/repeating/` with `data: { immediate, repeating, time, clockTime }`. `time` is milliseconds between runs, `clockTime` is a daily time like `"03:30"`. A failing task is logged and recorded, it never stops the bot (`/admin status` shows how each one went).

**A server setting**: add it to `SETTINGS` in `assets/commands/config/settings.ts` and to the table in `db/schema.ts`.

## How the code is written

- **A command file reads like a list of steps.** The default function checks the input and calls named functions (`ChangeExistingBan`, `ShowLeaderboard`...), each one doing one thing. If a function needs a comment to say what each part does, those parts are separate functions waiting to be named. Aim for functions you can read without scrolling.
- **Comments say why, not what.** `// the dm goes first so the case can say if it arrived` is useful, `// send the dm` is not. A short line above a helper is enough, skip `@param` lines that repeat the name.
- **Names:** functions are `PascalCase` (`HasPermission`), variables `camelCase`, constants `UPPER_CASE`. A name should say what the thing is (`purgeDurationMs`, not `d`). The only exception is a formula written with the letters of its source (`GetEaster`).
- **Errors:** a command that can fail catches it, logs it with `console.error` and tells the user something they can act on. Use `ExplainError` for text for the user, and `SafeError` when logging something that may be a database error (those contain the values of the query).
- **Data:** things that must be shared and searched live in the database (`db/schema.ts`). Small state the bot can rebuild (giveaways, game sessions, member history) is a JSON file in `cache/`, via `utils/jsonStore.ts`.
- **Whitespace:** every file keeps the indentation it already has (some use tabs, some 4 spaces) and the project uses CRLF line endings. Match the file you are in.

## Checking your change

- `npm run build` type checks everything (nothing is deployed by it).
- `npm run dev` starts the bot with the files as they are.
- `npm run lint` and `npm run format` run Biome.
