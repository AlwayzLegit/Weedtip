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

final dispensaryUpdatesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, dispensaryId) {
  return ref.watch(repositoryProvider).dispensaryUpdates(dispensaryId);
});

final dispensaryPromosProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, dispensaryId) {
  return ref.watch(repositoryProvider).dispensaryPromos(dispensaryId);
});

final isStrainSavedProvider = FutureProvider.family<bool, String>((ref, strainId) {
  ref.watch(authStateProvider);
  return ref.watch(repositoryProvider).isStrainSaved(strainId);
});

final globalSearchProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, query) {
  return ref.watch(repositoryProvider).searchGlobal(query);
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

/// Live notifications for the signed-in user (Supabase Realtime).
final notificationsStreamProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(repositoryProvider).notificationsStream();
});

final unreadCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsStreamProvider).maybeWhen(
        data: (list) => list.where((n) => n['read'] != true).length,
        orElse: () => 0,
      );
});

final strainsProvider = FutureProvider.family<List<Map<String, dynamic>>, String?>((ref, type) {
  return ref.watch(repositoryProvider).strains(type: type);
});

final strainBySlugProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, slug) {
  return ref.watch(repositoryProvider).strainBySlug(slug);
});

final strainProductsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, strainId) {
  return ref.watch(repositoryProvider).productsForStrain(strainId);
});

final dealsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(repositoryProvider).deals();
});

final productByIdProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, id) {
  return ref.watch(repositoryProvider).productById(id);
});

final productReviewsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, id) {
  return ref.watch(repositoryProvider).productReviews(id);
});

final brandsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(repositoryProvider).brands();
});

final brandBySlugProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, slug) {
  return ref.watch(repositoryProvider).brandBySlug(slug);
});

final brandProductsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, brandId) {
  return ref.watch(repositoryProvider).brandProducts(brandId);
});
