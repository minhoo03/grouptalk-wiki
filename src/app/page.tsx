import { HomeScreen } from "@/screens/home/HomeScreen";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function HomePage() {
  return <HomeScreen isSupabaseConfigured={isSupabaseConfigured()} />;
}
