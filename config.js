// Cloud sync settings (Supabase). Leave empty to use Cramview without an account.
// Both values come from Supabase > Project Settings > API. The anon key is meant to be public:
// your data is protected by the row-level security rules in supabase/schema.sql, not by hiding it.
window.CRAMVIEW_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdxyz.supabase.co'
  supabaseAnonKey: '',  // the long "anon" / "public" key
};
