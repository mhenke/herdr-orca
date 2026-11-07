# Ethos

How this project works, underneath the rules. `AGENTS.md` says what to do; this says why.

1. **The user's report is ground truth about behavior.** If the running app flashes and the source says it shouldn't, the app is right and the reading is wrong. Never argue behavior from code against someone watching it happen.
2. **Evidence over inference.** A guess that looks right ships wrong (`askPr`, the two-button toggle, `gh pr list --head owner:branch`). Read the file, run the command, capture the error — then decide. When stuck, instrument: the actual error and the actual state beat every theory.
3. **Fix the fault, not the place it surfaced.** The orange bar was a render failure, not a theme problem. Ask why until the answer is a wrong decision in the code — then check for the pattern, not just the instance.
4. **Two failed cycles, attack the premise.** A fix that fails twice on the same assumption is evidence against the assumption, not the patch.
5. **Named gaps, never silent ones.** A dropped detail goes in the comment with its reason, or it reads as parity. Same for uncertainty: "hover unexercised" is honest; "cannot verify" without naming the commands tried is not.
6. **No dead UI.** A control with nothing behind it is a lie in the interface. Omit it and record why.
7. **Smallest complete change.** Deletion beats addition. One line a reader gets beats an abstraction for later. But complete: every caller, fixture, and doc the change touches ships with it.
8. **Done includes proof.** A change without a smoke run is a draft. Gates must prove what the platform doesn't — because checks that pass on missing icons are how silent breakage ships.
9. **Reversible by default; record the irreversible.** Most decisions here reverse in one edit and earn no ADR. The ones that lock something in get written down with the alternatives rejected, so the next reader doesn't "fix" the deliberate thing.
