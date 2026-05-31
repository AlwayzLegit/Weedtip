import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'screens/cart_screen.dart';
import 'screens/deals_screen.dart';
import 'screens/dispensary_screen.dart';
import 'screens/explore_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/home_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/products_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/strain_screen.dart';
import 'screens/strains_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) => _ScaffoldWithNav(navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [GoRoute(path: '/', builder: (_, __) => const HomeScreen())],
        ),
        StatefulShellBranch(
          routes: [GoRoute(path: '/explore', builder: (_, __) => const ExploreScreen())],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/products',
              builder: (_, state) =>
                  ProductsScreen(initialCategory: state.uri.queryParameters['category']),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen())],
        ),
      ],
    ),
    GoRoute(
      path: '/dispensary/:slug',
      builder: (_, state) => DispensaryScreen(slug: state.pathParameters['slug']!),
    ),
    GoRoute(path: '/cart', builder: (_, __) => const CartScreen()),
    GoRoute(path: '/orders', builder: (_, __) => const OrdersScreen()),
    GoRoute(path: '/favorites', builder: (_, __) => const FavoritesScreen()),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
    GoRoute(path: '/strains', builder: (_, __) => const StrainsScreen()),
    GoRoute(
      path: '/strain/:slug',
      builder: (_, state) => StrainScreen(slug: state.pathParameters['slug']!),
    ),
    GoRoute(path: '/deals', builder: (_, __) => const DealsScreen()),
  ],
);

class _ScaffoldWithNav extends StatelessWidget {
  const _ScaffoldWithNav(this.shell);
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view), label: 'Products'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
