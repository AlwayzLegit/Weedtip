import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'models.dart';
import 'repository.dart';
import 'supabase.dart';

final repositoryProvider = Provider<WeedtipRepository>((ref) => WeedtipRepository(supabase));

/// Auth state stream → drives router redirects and the profile screen.
final authStateProvider = StreamProvider<AuthState>((ref) {
  return supabase.auth.onAuthStateChange;
});

final currentUserProvider = Provider<User?>((ref) {
  ref.watch(authStateProvider);
  return supabase.auth.currentUser;
});

final featuredDispensariesProvider = FutureProvider<List<Dispensary>>((ref) {
  return ref.watch(repositoryProvider).featuredDispensaries();
});

final categoriesProvider = FutureProvider<List<Category>>((ref) {
  return ref.watch(repositoryProvider).categories();
});

/// Parameters for a dispensary search (used as a FutureProvider family key).
class DispensaryQuery {
  const DispensaryQuery({this.query, this.openNow = false, this.categorySlug});
  final String? query;
  final bool openNow;
  final String? categorySlug;

  @override
  bool operator ==(Object other) =>
      other is DispensaryQuery &&
      other.query == query &&
      other.openNow == openNow &&
      other.categorySlug == categorySlug;

  @override
  int get hashCode => Object.hash(query, openNow, categorySlug);
}

final dispensarySearchProvider =
    FutureProvider.family<List<Dispensary>, DispensaryQuery>((ref, q) {
  return ref.watch(repositoryProvider).searchDispensaries(
        query: q.query,
        openNow: q.openNow,
        categorySlug: q.categorySlug,
      );
});

final dispensaryBySlugProvider =
    FutureProvider.family<Dispensary?, String>((ref, slug) {
  return ref.watch(repositoryProvider).dispensaryBySlug(slug);
});

final dispensaryProductsProvider =
    FutureProvider.family<List<Product>, String>((ref, dispensaryId) {
  return ref.watch(repositoryProvider).productsForDispensary(dispensaryId);
});

final dispensaryReviewsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, dispensaryId) {
  return ref.watch(repositoryProvider).reviewsForDispensary(dispensaryId);
});

final productSearchProvider =
    FutureProvider.family<List<Product>, String?>((ref, categorySlug) {
  return ref.watch(repositoryProvider).searchProducts(categorySlug: categorySlug);
});

/// Current user's orders (re-fetches when auth changes).
final myOrdersProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(repositoryProvider).myOrders();
});

final favoritesProvider = FutureProvider<List<Dispensary>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(repositoryProvider).favorites();
});

final isFavoriteProvider = FutureProvider.family<bool, String>((ref, dispensaryId) {
  ref.watch(authStateProvider);
  return ref.watch(repositoryProvider).isFavorite(dispensaryId);
});

final myProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(repositoryProvider).myProfile();
});
