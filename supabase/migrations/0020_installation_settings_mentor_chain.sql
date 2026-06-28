-- Issue #330: auto-assign mentor chain toggle.

alter table installation_settings
  add column if not exists auto_assign_mentor_chain boolean not null default false;
