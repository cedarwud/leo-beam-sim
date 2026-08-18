# Core speaker-notes source

core-speaker-notes.json is the authoritative UTF-8 source for the current
43-slide core. Each entry uses a semantic key, the visible title, and a
signature of the complete ordered visible-text run list. The semantic key is
the durable identity; presentation order and slide-part numbering are only
read from the current PPTX.

Apply the source to the fixed core filename:

    python courseware/c120-lora-leo-deck/alt-skill-deck/core-classroom/apply_core_notes.py

Run the repeatable gate after every root merge:

    python courseware/c120-lora-leo-deck/alt-skill-deck/core-classroom/audit_core_notes.py

The apply process stages a temporary same-directory PPTX, replaces only
ppt/notesSlides/notesSlide*.xml, verifies the visible slide XML, layouts,
masters, media, theme, and presentation-order parts byte-for-byte, then
atomically replaces the fixed core. The audit fails closed for unmatched
visible slides, missing notes relationships, stale embedded notes, short notes,
forbidden language, duplicate semantic keys, duplicate visible signatures, or
orphan notes parts. Signature values are metadata only and are never embedded
in speaker notes or visible slide text.
