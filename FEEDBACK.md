# Scaffold Stacks feedback

Notes from building Heirloom with `stacksdapp` 0.2.2 on Ubuntu (Linux x64), Rust 1.98, Node 24, Clarinet 3.24.1.

**Time to ship:** _fill in_ (install → deployed contract → live Vercel app)

## What worked well

- **Deploy is one command.** `stacksdapp deploy --network testnet --yes --wait-confirm` took 35 seconds, wrote `deployments.json`, and regenerated the hooks. `--dry-run` showed the fee (0.127 STX) first, which built confidence.
- **Clarity 6 set up correctly by default.** `stacksdapp add heirloom` wrote the right `clarity_version` and `epoch` into `Clarinet.toml`, and the contract type-checked first try.
- **Generated hooks save a lot of work.** Transaction status polling (pending → success/abort) and explorer links come for free, so my UI only had to render the states.
- **The bundled agent skill was genuinely useful.** `frontend.md` warned about the cvToJSON shape of read-only results before I hit it, and the "testnet first" guidance was right.
- **Mnemonic pre-commit hook.** It's a good safety net, and it was active out of the box.
- **The generated debug UI** was handy for poking at functions before my own UI existed. I kept it at `/debug`.

## Problems, with fixes I'd suggest

1. **`cargo install stacksdapp` fails on a fresh Ubuntu install.** `openssl-sys` needs `pkg-config` and `libssl-dev`, which the prerequisites page doesn't mention. Fix: add `sudo apt install pkg-config libssl-dev` to the prerequisites, or build with `rustls` so no system OpenSSL is needed.
2. **No Linux install steps for Clarinet.** The prerequisites page only shows `brew install clarinet`. I had to find the binary on the `stx-labs/clarinet` GitHub releases page.
3. **Read-only hooks lose `ok`/`err`.** `cvToValue` unwraps responses, so `(ok {tuple})` and `(err u100)` both come back as bare `{ type, value }` objects. I had to detect "no vault" by checking the shape. Suggest returning `{ success, value }` or the raw `ClarityValue` alongside `data`.
4. **Hooks can't take post-conditions.** `call(args)` always passes `[]`, and `contracts.ts` hardcodes `postConditionMode: 'allow'` even when post-conditions are given. For an app that moves funds, I'd want `call(args, postConditions)` and `deny` mode whenever post-conditions are present.
5. **Vercel builds default to devnet.** `.env.local` is gitignored and `scaffold.config.ts` falls back to `devnet`, so a Vercel build without `NEXT_PUBLIC_NETWORK` points at `localhost:3999`. I added a committed `frontend/.env.production` with `NEXT_PUBLIC_NETWORK=testnet`. The deploy command could write this file, or the docs could call it out.
6. **The skill's Clarity cheat sheet is out of date for Clarity 6.** `clarity-language.md` lists `as-contract` as a built-in, but it was deprecated in Clarity 4. Sending STX from a contract now needs `(as-contract? ((with-stx amount)) …)`. An `as-contract?` example would save people time.
7. **The skill is only auto-discovered by Cursor.** It lives in `.cursor/skills/`. Claude Code only finds it if the agent reads `AGENTS.md` first. Shipping a `CLAUDE.md` pointer or `.claude/skills/` copy would make it automatic.
8. **No `stacksdapp remove`.** Replacing the template `counter` contract meant manually editing `Clarinet.toml` and deleting the contract and test files.
9. **Smaller items:**
   - `stacksdapp check` printed Clarinet's interactive `Overwrite? [Y/n]` prompt for the simnet plan.
   - `npm run typecheck` fails on a fresh project (`Cannot find module '@/public/logo.png'`) until `next build` has generated `next-env.d.ts`.
   - `stacksdapp add` removed `requirements = []` from `Clarinet.toml`, which was harmless.
   - `deployments.json` records `block_height: 0` even after `--wait-confirm`.
   - Vitest warns that the clarinet environment uses the deprecated `transformMode`.
