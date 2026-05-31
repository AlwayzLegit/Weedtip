import 'package:flutter/material.dart';

/// Weedtip brand theme — mirrors the web Tailwind tokens (dark, green accent).
/// Keep these values in sync with apps/web/tailwind.config.ts.
class WeedtipColors {
  static const background = Color(0xFF0F1117);
  static const surface = Color(0xFF1A1D26);
  static const surface2 = Color(0xFF222633);
  static const border = Color(0xFF2A2F3C);
  static const primary = Color(0xFF10B981);
  static const foreground = Color(0xFFF4F6F8);
  static const muted = Color(0xFF9CA3AF);
  static const danger = Color(0xFFEF4444);
}

ThemeData buildWeedtipTheme() {
  const seed = WeedtipColors.primary;
  final scheme = ColorScheme.fromSeed(
    seedColor: seed,
    brightness: Brightness.dark,
    surface: WeedtipColors.surface,
  ).copyWith(
    primary: WeedtipColors.primary,
    surface: WeedtipColors.surface,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: WeedtipColors.background,
    fontFamily: 'Inter',
  );
}
