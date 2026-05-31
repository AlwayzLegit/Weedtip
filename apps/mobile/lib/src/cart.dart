import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A single cart line.
class CartItem {
  CartItem({required this.productId, required this.name, required this.priceCents, this.quantity = 1});
  final String productId;
  final String name;
  final int priceCents;
  final int quantity;

  CartItem copyWith({int? quantity}) =>
      CartItem(productId: productId, name: name, priceCents: priceCents, quantity: quantity ?? this.quantity);

  Map<String, dynamic> toJson() =>
      {'productId': productId, 'name': name, 'priceCents': priceCents, 'quantity': quantity};

  factory CartItem.fromJson(Map<String, dynamic> j) => CartItem(
        productId: j['productId'] as String,
        name: j['name'] as String,
        priceCents: (j['priceCents'] as num).toInt(),
        quantity: (j['quantity'] as num?)?.toInt() ?? 1,
      );
}

/// A single-dispensary cart (matches the web cart model).
class Cart {
  Cart({
    required this.dispensaryId,
    required this.dispensarySlug,
    required this.dispensaryName,
    required this.items,
  });
  final String dispensaryId;
  final String dispensarySlug;
  final String dispensaryName;
  final List<CartItem> items;

  int get count => items.fold(0, (n, i) => n + i.quantity);
  int get subtotalCents => items.fold(0, (s, i) => s + i.priceCents * i.quantity);

  Cart copyWith({List<CartItem>? items}) => Cart(
        dispensaryId: dispensaryId,
        dispensarySlug: dispensarySlug,
        dispensaryName: dispensaryName,
        items: items ?? this.items,
      );

  Map<String, dynamic> toJson() => {
        'dispensaryId': dispensaryId,
        'dispensarySlug': dispensarySlug,
        'dispensaryName': dispensaryName,
        'items': items.map((i) => i.toJson()).toList(),
      };

  factory Cart.fromJson(Map<String, dynamic> j) => Cart(
        dispensaryId: j['dispensaryId'] as String,
        dispensarySlug: j['dispensarySlug'] as String,
        dispensaryName: j['dispensaryName'] as String,
        items: (j['items'] as List? ?? [])
            .map((e) => CartItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class DispensaryRef {
  const DispensaryRef({required this.id, required this.slug, required this.name});
  final String id;
  final String slug;
  final String name;
}

/// Persistence boundary for the cart. Optional so the notifier stays unit-testable
/// (tests construct `CartNotifier()` with no store → pure in-memory).
abstract class CartStore {
  Future<Cart?> load();
  Future<void> save(Cart? cart);
}

class PrefsCartStore implements CartStore {
  static const _key = 'weedtip:cart';

  @override
  Future<Cart?> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null) return null;
      return Cart.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> save(Cart? cart) async {
    final prefs = await SharedPreferences.getInstance();
    if (cart == null) {
      await prefs.remove(_key);
    } else {
      await prefs.setString(_key, jsonEncode(cart.toJson()));
    }
  }
}

class CartNotifier extends StateNotifier<Cart?> {
  CartNotifier([this._store]) : super(null) {
    // Rehydrate from storage (no-op when no store / in tests).
    _store?.load().then((c) {
      if (c != null && state == null) state = c;
    });
  }
  final CartStore? _store;

  void _commit(Cart? next) {
    state = next;
    _store?.save(next);
  }

  /// Adds an item. Switching dispensaries replaces the cart (single-shop carts).
  void add(DispensaryRef shop, CartItem item) {
    final cart = state;
    if (cart == null || cart.dispensaryId != shop.id) {
      _commit(Cart(
        dispensaryId: shop.id,
        dispensarySlug: shop.slug,
        dispensaryName: shop.name,
        items: [item],
      ));
      return;
    }
    final idx = cart.items.indexWhere((i) => i.productId == item.productId);
    if (idx >= 0) {
      final updated = [...cart.items];
      updated[idx] = updated[idx].copyWith(quantity: updated[idx].quantity + item.quantity);
      _commit(cart.copyWith(items: updated));
    } else {
      _commit(cart.copyWith(items: [...cart.items, item]));
    }
  }

  void setQuantity(String productId, int quantity) {
    final cart = state;
    if (cart == null) return;
    final items = quantity <= 0
        ? cart.items.where((i) => i.productId != productId).toList()
        : cart.items.map((i) => i.productId == productId ? i.copyWith(quantity: quantity) : i).toList();
    _commit(items.isEmpty ? null : cart.copyWith(items: items));
  }

  void clear() => _commit(null);
}

final cartProvider =
    StateNotifierProvider<CartNotifier, Cart?>((ref) => CartNotifier(PrefsCartStore()));

final cartCountProvider = Provider<int>((ref) => ref.watch(cartProvider)?.count ?? 0);
