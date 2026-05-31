import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

class BrandsScreen extends ConsumerWidget {
  const BrandsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final brands = ref.watch(brandsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Brands')),
      body: brands.when(
        loading: () => const LoadingBox(),
        error: (_, __) => ErrorBox(onRetry: () => ref.invalidate(brandsProvider)),
        data: (list) => list.isEmpty
            ? const EmptyBox('No brands yet.')
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final b = list[i];
                  return InkWell(
                    onTap: () => context.push('/brand/${b['slug']}'),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: WeedtipColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: WeedtipColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(b['name'] as String,
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                          if (b['description'] != null) ...[
                            const SizedBox(height: 4),
                            Text(b['description'] as String,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 13, color: WeedtipColors.muted)),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
