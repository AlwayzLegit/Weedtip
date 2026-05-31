import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

String _discountLabel(String type, num value) {
  if (type == 'percentage') return '$value% off';
  if (type == 'fixed') return '\$$value off';
  return 'BOGO';
}

class DealsScreen extends ConsumerWidget {
  const DealsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deals = ref.watch(dealsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Deals')),
      body: deals.when(
        loading: () => const LoadingBox(),
        error: (_, __) => ErrorBox(onRetry: () => ref.invalidate(dealsProvider)),
        data: (list) => list.isEmpty
            ? const EmptyBox('No active deals right now.\nCheck back soon.')
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(dealsProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final d = list[i];
                    final dispensary = d['dispensary'] as Map<String, dynamic>?;
                    return InkWell(
                      onTap: dispensary == null
                          ? null
                          : () => context.push('/dispensary/${dispensary['slug']}'),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0x1410B981),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0x4D10B981)),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(d['title'] as String,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: WeedtipColors.primary)),
                                  if (d['description'] != null) ...[
                                    const SizedBox(height: 4),
                                    Text(d['description'] as String,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontSize: 13, color: WeedtipColors.muted)),
                                  ],
                                  if (dispensary != null) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      '${dispensary['name']} · ${dispensary['city']}, ${dispensary['state']}',
                                      style: const TextStyle(
                                          fontSize: 12, color: WeedtipColors.muted),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            TagChip(
                                _discountLabel(d['discount_type'] as String,
                                    (d['discount_value'] as num)),
                                filled: true),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
