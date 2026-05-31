import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

class BrandScreen extends ConsumerWidget {
  const BrandScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final brand = ref.watch(brandBySlugProvider(slug));
    return Scaffold(
      appBar: AppBar(),
      body: brand.when(
        loading: () => const LoadingBox(),
        error: (_, __) => ErrorBox(onRetry: () => ref.invalidate(brandBySlugProvider(slug))),
        data: (b) => b == null ? const EmptyBox('Brand not found.') : _Body(b),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body(this.b);
  final Map<String, dynamic> b;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(brandProductsProvider(b['id'] as String));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(b['name'] as String, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
        if (b['description'] != null) ...[
          const SizedBox(height: 8),
          Text(b['description'] as String, style: const TextStyle(color: WeedtipColors.muted)),
        ],
        const SizedBox(height: 20),
        const Text('Products', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        products.when(
          loading: () => const LoadingBox(),
          error: (_, __) => const ErrorBox(),
          data: (list) => list.isEmpty
              ? const Text('No products from this brand are listed yet.',
                  style: TextStyle(color: WeedtipColors.muted))
              : GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 200,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.7,
                  ),
                  itemCount: list.length,
                  itemBuilder: (_, i) => ProductCard(Product.fromJson(list[i])),
                ),
        ),
      ],
    );
  }
}
