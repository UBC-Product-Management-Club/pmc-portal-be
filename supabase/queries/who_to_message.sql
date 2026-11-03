-- Who is due a message now ----------------------------------------------------------
--
-- For the Messages tab while event-email delivery is off: every unsent hook that
-- still applies, by the same rules as the Loops sender. `npm run ops -- messages`
-- writes it into the sheet, and `npm run ops -- mark-sent` marks only the ids
-- that actually went out.
-- -----------------------------------------------------------------------------

select * from messages_due('<event_id>');

-- The same as mark-sent, by hand:
-- update "Notification_Hook" set sent_at = now(), sent_by = '<who sent them>', provider = 'manual'
-- where notification_id = any(array['<id_1>', '<id_2>']::uuid[]) and sent_at is null;
