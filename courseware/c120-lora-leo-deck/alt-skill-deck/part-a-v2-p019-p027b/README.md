# P019–P027b writer lane

This directory owns the P019–P027b source, builder, and QA artifacts. The
latest-routed deliverable is:

`../latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P019-P027B-REVIEW.pptx`

Construction uses the exact template at
`/home/u24/pptx-wrap/assets/templates/educate.pptx`, source slide 2 only, with
`slideLayout2.xml` relationships on every authored slide. The template digest
is `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`.

The content source is the P019–P027b subset of
`../part-a/slides.json`. The exact policy source is read-only from
`/home/u24/lora-energy-lab/student_policy.py`; other package facts used for
the launchers, engine, replay writer, and fixed scenario remain read-only
reference material from `/home/sat/lora-energy-lab-reference/`.

Build with the managed environment that provides `python-pptx`:

```text
/home/sat/modqn-paired-action-temporal-alignment-checkout-20260723/.venv/bin/python build_section.py
```

The builder emits formal speaker notes, a source snapshot, and an editable
15-slide PPTX. It preserves the template background, logo, divider, footer,
and slide-number system.

The lane does not modify other writer directories, shared course source, or
any package reference files. No commit or push is part of this handoff.
