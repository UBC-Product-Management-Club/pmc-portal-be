import { supabase } from "../config/supabase";

// What Home reads (20261101000000_home.sql). Both decide by database time.
export const HomeRepository = {
    activeAnnouncements: (isMember: boolean) =>
        supabase.rpc("active_announcements", { p_is_member: isMember }).select("announcement_id, title, body, audience"),
    eventStatuses: (userId: string) => supabase.rpc("event_statuses", { p_user_id: userId }),
};
