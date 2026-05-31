import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../models.dart';
import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Orders')),
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Sign in to view your orders.'),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => context.go('/profile'), child: const Text('Sign in')),
          ]),
        ),
      );
    }

    final orders = ref.watch(myOrdersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: orders.when(
        loading: () => const LoadingBox(),
        error: (_, __) => ErrorBox(onRetry: () => ref.invalidate(myOrdersProvider)),
        data: (list) => list.isEmpty
            ? const EmptyBox('No orders yet.')
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(myOrdersProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _OrderTile(list[i]),
                ),
              ),
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile(this.order);
  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    final dispensary = order['dispensary'] as Map<String, dynamic>?;
    final items = (order['items'] as List?) ?? const [];
    final status = order['status'] as String? ?? 'pending';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: WeedtipColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: WeedtipColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(dispensary?['name'] as String? ?? 'Dispensary',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  '${items.length} item${items.length == 1 ? '' : 's'} · ${order['order_type']}',
                  style: const TextStyle(fontSize: 12, color: WeedtipColors.muted),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(formatPrice((order['total_cents'] as num?)?.toInt() ?? 0),
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              TagChip(status, filled: status == 'confirmed' || status == 'ready'),
            ],
          ),
        ],
      ),
    );
  }
}
