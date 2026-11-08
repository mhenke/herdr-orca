# Querying the graphs

Used by AGENTS.md rule 2. Each repo has a built graph at `graphify-out/graph.json`.

## Orca (`~/Projects/orca`, 237,654 nodes, 332 MB)

- Query with `graphify query "<question>"`, or `graphify path` / `graphify explain`.
- A broad question truncates. Narrow it with `--budget N` or `context_filter=['call']`; a partial answer is not the whole answer.
- The earlier build over ~37,570 files died after AST extraction without writing `graph.json`. The current `graphify-out/` is the build that succeeded.
- The graph finds the owner file. Read the source to confirm the value.

## herdr-t3 (`~/Projects/herdr-t3`)

The reference Herdr layout this package follows (`layouts/ mods/ keys.json extras/themes/ scripts/sync.sh README.md RECIPE.md preview.png`). Use it for packaging, sync, keys, and mod structure. Use the Orca graph for UI behavior.

## herdr-app and herdr-core

- `~/Projects/herdr-app`: the host, its mods API, and `vendor/gpui-kit` (`gpui-base`, `gpui-kit`, `herdr`). The only authority for what a builder method does.
- `~/Projects/herdr-core`: `hc`, files, processes, and the core protocol.

## Query from the project folder and check the graph line

A bare `graphify query` answers from `./graphify-out/`. `cd` to the repo first. The first output line names the graph and its node count. If it is not the project you meant, the answer is about the wrong codebase.

Known trap: `~/.zshrc` once exported `GRAPHIFY_OUT="$HOME/.graphify/oh-my-opencode-slim"`, which overrides cwd. A query in herdr-t3 answered from 7348 nodes of another project (its own has 874), and `sync.sh` lookups returned `src/cli/install.ts`, with no warning. The export is removed. `--graph <path>` beats any variable.

Also: `extract` has no `--graph` and writes wherever `GRAPHIFY_OUT` points. One run pruned 9097 nodes from a store it did not own. An interrupted extract leaves only `.graphify_build.json`, so a missing `graph.json` means rebuild, not query.
