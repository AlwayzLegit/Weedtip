import 'package:supabase_flutter/supabase_flutter.dart';

/// Global Supabase client accessor (initialized in main()).
SupabaseClient get supabase => Supabase.instance.client;
