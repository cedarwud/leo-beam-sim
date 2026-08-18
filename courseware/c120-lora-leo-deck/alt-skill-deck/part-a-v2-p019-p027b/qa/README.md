# QA record

The current reports are generated beside this file:

- `structural-qa.json`: ZIP integrity, recursive XML parsing, relationship
  targets, content types, 15-slide/15-notes count, layout2-only routing,
  authored background absence, creation-ID uniqueness, font floor and font
  family contract, title alignment, and forbidden-language scan.
- `geometry-qa.json`: safe content bounds, protected logo zones, and one
  dominant visual plus authored text on every page.

The final reports are green. `python-pptx` reopened the final package with 15
slides and 15 non-empty notes slides. LibreOffice/PowerPoint rendering is
deferred because no installed renderer was available in this environment; see
`../renders/README.md`.
