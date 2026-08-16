# 11 — Rider security and privacy

Server-side role checks are the security boundary. Admin writes require
`ADMIN` or `SUPER_ADMIN`; shop staff can perform package handover but cannot
approve, suspend, change trust, override exposure, close proof exceptions, or
review private management notes.

Riders receive only their active delivery. Before acceptance, recipient name,
phone, exact address, and directions are masked. After acceptance, only the
operational delivery fields are returned. A delivery ID is always scoped to
the authenticated rider before any action.

Customers see only public rider number, display name, profile photo, verified
state, and vehicle-identification details on an order they are already allowed
to view. Internal UUIDs, contact data, exposure/trust, documents, and notes are
never returned.

New rider-domain tables have row-level security enabled. No direct client
policies are granted: trusted server services use the pooled database role and
apply application authorization. Custody, status, exposure, OTP-attempt, and
earning histories are append-only at the database layer.

Before public launch: turn off Supabase development auto-confirm, define and
test explicit RLS policies for any future direct client access, select an OTP
recipient notification channel, reset verification data, and complete a role
and privacy review.
