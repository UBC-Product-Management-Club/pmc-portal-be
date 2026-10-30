-- Review sheet export ------------------------------------------------------------
--
-- One row per applicant, oldest first. `npm run ops -- sync` writes this into the
-- review sheet (with resume_path swapped for a 7-day signed link and times in
-- Pacific); run it here only to look. The *_sent_at columns come from
-- Notification_Hook (blank = not sent yet).
-- -----------------------------------------------------------------------------

select * from review_sheet_rows('<event_id>');
