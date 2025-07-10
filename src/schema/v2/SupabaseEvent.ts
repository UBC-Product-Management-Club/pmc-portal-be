type SupabaseEvent = {
  event_id: string;
  requires_application: boolean;
  event_form_questions: string;
  max_attendees: number; 
  name: string;
  description: string;
  start_time: string; // ISO date string (YYYY-MM-DD)
  end_time: string;   // ISO date string (YYYY-MM-DD)
  date: string;       // ISO date string (YYYY-MM-DD)
  location: string;
  thumbnail: string;  // URL string
  media: string[];    // Array of URL strings
  early_bird_member_price: number;   
  early_bird_non_member_price: number;    
  general_member_price: number;
  general_non_member_price: number;
};

export {SupabaseEvent}