import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A single cart line.
class CartItem {
  CartItem({required this.productId, required this.name, required this.priceCents, this.quantity = 1});
  final String productId;
  final String name;
  final int priceCents;
  final int quantity;

  CartItem copyWith({int? quantity}) =>
      CartItem(productId: productId, name: name, priceCents: priceCents, quantity: quantity ?? this.quantity);
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
}

class DispensaryRef {
  const DispensaryRef({required this.id, required this.slug, required this.name});
  final String id;
  final String slug;
  final String name;
}

class CartNotifier extends StateNotifier<Cart?> {
  CartNotifier() : super(null);

  /// Adds an item. Switching dispensaries replaces the cart (single-shop carts).
  void add(DispensaryRef shop, CartItem item) {
    final cart = state;
    if (cart == null || cart.dispensaryId != shop.id) {
      state = Cart(
        dispensaryId: shop.id,
        dispensarySlug: shop.slug,
        dispensaryName: shop.name,
        items: [item],
      );
      return;
    }
    final idx = cart.items.indexWhere((i) => i.productId == item.productId);
    if (idx >= 0) {
      final updated = [...cart.items];
      updated[idx] = updated[idx].copyWith(quantity: updated[idx].quantity + item.quantity);
      state = cart.copyWith(items: updated);
    } else {
      state = cart.copyWith(items: [...cart.items, item]);
    }
  }

  void setQuantity(String productId, int quantity) {
    final cart = state;
    if (cart == null) return;
    final items = quantity <= 0
        ? cart.items.where((i) => i.productId != productId).toList()
        : cart.items.map((i) => i.productId == productId ? i.copyWith(quantity: quantity) : i).toList();
    state = items.isEmpty ? null : cart.copyWith(items: items);
  }

  void clear() => state = null;
}

final cartProvider = StateNotifierProvider<CartNotifier, Cart?>((ref) => CartNotifier());

final cartCountProvider = Provider<int>((ref) => ref.watch(cartProvider)?.count ?? 0);
