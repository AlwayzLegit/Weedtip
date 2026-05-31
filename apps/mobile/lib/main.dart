import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'src/router.dart';
import 'theme.dart';

/// Entry point. Loads env, initializes Supabase (same project as web), and runs
/// the app inside a Riverpod scope with a GoRouter bottom-nav shell.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: 'assets/config.env');

  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL']!,
    anonKey: dotenv.env['SUPABASE_ANON_KEY']!,
  );

  runApp(const ProviderScope(child: WeedtipApp()));
}

class WeedtipApp extends StatelessWidget {
  const WeedtipApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Weedtip',
      debugShowCheckedModeBanner: false,
      theme: buildWeedtipTheme(),
      routerConfig: appRouter,
    );
  }
}
