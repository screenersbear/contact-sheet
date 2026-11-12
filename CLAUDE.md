# This folder is a copy

Contact Sheet is made in the Documenting Fictions suite, in `../Documenting Fictions/contact-sheet/`. This folder is copied out from there by `python3 tools/sync.py export contact-sheet`, run in `../Documenting Fictions`.

- Don't change the app's files here. Make the change in `../Documenting Fictions/contact-sheet/` (bump CACHE_NAME there), commit and push the suite, then export, and commit and push here.
- Only CLAUDE.md, README.md and .gitignore, and contact-sheet-spec.md (the living spec, not in git) are this folder's own.
- A commit here of app files that the last export didn't write is refused, and an export won't write over files changed here: it lists them, so they can be moved into the suite first.
