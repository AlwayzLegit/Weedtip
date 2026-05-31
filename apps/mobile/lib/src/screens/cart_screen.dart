import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../cart.dart';
import '../models.dart';
import '../providers.dart';
import '../../theme.dart';

// Keep in sync with @weedtip/shared ESTIMATED_TAX_RATE and the create_order RPC.
const _taxRate = 0.15;

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});
  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  String _orderType = 'pickup';
  bool _busy = false;

  Future<void> _checkout(Cart cart) async {
    final user = ref.read(currentUserProvider);
    final messenger = ScaffoldMessenger.of(context);
    if (user == null) {
      context.go('/profile');
      messenger.showSnackBar(const SnackBar(content: Text('Please sign in to check out.')));
      return;
    }
    setState(() => _busy = true);
    try {
      final orderId = await ref.read(repositoryProvider).createOrder(
            dispensaryId: cart.dispensaryId,
            orderType: _orderType,
            items: cart.items
                .map((i) => {'product_id': i.productId, 'quantity': i.quantity})
                .toList(),
          );
      ref.read(cartProvider.notifier).clear();
      ref.invalidate(myOrdersProvider);
      if (mounted) {
        context.go('/orders');
        messenger.showSnackBar(SnackBar(content: Text('Order placed! #${orderId.substring(0, 8)}')));
      }
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Checkout failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: cart == null || cart.items.isEmpty
          ? _empty(context)
          : _body(cart),
    );
  }

  Widget _empty(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.shopping_cart_outlined, size: 48, color: WeedtipColors.muted),
          const SizedBox(height: 12),
          const Text('Your cart is empty', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          FilledButton(onPressed: () => context.go('/explore'), child: const Text('Find dispensaries')),
        ]),
      );

  Widget _body(Cart cart) {
    final tax = (cart.subtotalCents * _taxRate).round();
    final total = cart.subtotalCents + tax;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Order from ${cart.dispensaryName}',
                  style: const TextStyle(color: WeedtipColors.muted)),
              const SizedBox(height: 12),
              for (final item in cart.items)
                Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text('${formatPrice(item.priceCents)} each',
                                style: const TextStyle(fontSize: 12, color: WeedtipColors.muted)),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => ref
                            .read(cartProvider.notifier)
                            .setQuantity(item.productId, item.quantity - 1),
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      Text('${item.quantity}'),
                      IconButton(
                        onPressed: () => ref
                            .read(cartProvider.notifier)
                            .setQuantity(item.productId, item.quantity + 1),
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                    ]),
                  ),
                ),
            ],
          ),
        ),
        SafeArea(
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: WeedtipColors.border)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _row('Subtotal', formatPrice(cart.subtotalCents)),
                _row('Estimated tax', formatPrice(tax)),
                const Divider(),
                _row('Total', formatPrice(total), bold: true),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'pickup', label: Text('Pickup')),
                    ButtonSegment(value: 'delivery', label: Text('Delivery')),
                  ],
                  selected: {_orderType},
                  onSelectionChanged: (s) => setState(() => _orderType = s.first),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _busy ? null : () => _checkout(cart),
                    child: _busy
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text('Place order · ${formatPrice(total)}'),
                  ),
                ),
                const SizedBox(height: 6),
                const Text('Payment is collected at the dispensary.',
                    style: TextStyle(fontSize: 11, color: WeedtipColors.muted)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    color: bold ? null : WeedtipColors.muted,
                    fontWeight: bold ? FontWeight.bold : null)),
            Text(value, style: TextStyle(fontWeight: bold ? FontWeight.bold : null)),
          ],
        ),
      );
}
