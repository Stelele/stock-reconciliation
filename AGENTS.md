# AGENTS.md — Stock Reconciliation

Node script producing stock-recalculation and POS-draft output for ERPNext.

## Shared conventions

Cross-project decisions, code style, stack choices, testing expectations and workflow live
in the hivemind board. **Read `core/INDEX.md` before coding**, then only the 2-3 core files
it points at for the work in hand.

    git -C ~/Documents/code-projects/hivemind pull   # or: hm pull

Board: https://github.com/Stelele/hivemind — every rule has an ADR recording why and what
it costs. Everything below, and anything else here, is specific to this project.

Three that get violated most: **never commit without being asked** (ADR 0001) · **make the
whole change, then run tests once** (ADR 0002) · **check the real docs before
implementing** (ADR 0011).
