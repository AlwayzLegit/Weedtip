import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../cart.dart';
import '../models.dart';
import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

const _strainLabels = {'indica': 'Indica', 'sativa': 'Sativa', 'hybrid': 'Hybrid', 'cbd': 'CBD'};

class ProductScreen extends ConsumerWidget {
  const ProductScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = ref.watch(productByIdProvider(id));
    return Scaffold(
      appBar: AppBar(actions: const [CartIconButton()]),
      body: product.when(
        loading: () => const LoadingBox(),
        error: (_, __) => ErrorBox(onRetry: () => ref.invalidate(productByIdProvider(id))),
        data: (p) => p == null ? const EmptyBox('Product not found.') : _Body(p),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body(this.p);
  final Map<String, dynamic> p;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dispensary = p['dispensary'] as Map<String, dynamic>?;
    final strain = p['strain'] as Map<String, dynamic>?;
    final brand = p['brand'] as Map<String, dynamic>?;
    final reviews = ref.watch(productReviewsProvider(p['id'] as String));
    final user = ref.watch(currentUserProvider);
    final inStock = p['in_stock'] as bool? ?? true;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          height: 200,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: const LinearGradient(
              colors: [Color(0x4D10B981), WeedtipColors.surface2],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            image: ((p['image_urls'] as List?)?.isNotEmpty ?? false)
                ? DecorationImage(
                    image: NetworkImage((p['image_urls'] as List).first as String),
                    fit: BoxFit.cover)
                : null,
          ),
        ),
        const SizedBox(height: 16),
        if (brand != null || p['brand'] != null)
          GestureDetector(
            onTap: brand == null ? null : () => context.push('/brand/${brand['slug']}'),
            child: Text(brand?['name'] as String? ?? p['brand'] as String,
                style: const TextStyle(color: WeedtipColors.muted)),
          ),
        Text(p['name'] as String,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(formatPrice((p['price_cents'] as num).toInt()),
            style: const TextStyle(
                fontSize: 20, color: WeedtipColors.primary, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if ((p['rating_count'] as num?) != null && (p['rating_count'] as num) > 0)
          RatingStars((p['rating_avg'] as num?) ?? 0, count: (p['rating_count'] as num).toInt()),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          if (p['strain_type'] != null)
            TagChip(_strainLabels[p['strain_type']] ?? p['strain_type'] as String, filled: true),
          if (p['thc_percentage'] != null) TagChip('${p['thc_percentage']}% THC'),
          if (p['cbd_percentage'] != null) TagChip('${p['cbd_percentage']}% CBD'),
          if (!inStock) const TagChip('Out of stock'),
        ]),
        if (strain != null) ...[
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => context.push('/strain/${strain['slug']}'),
            child: Text('${strain['name']} strain',
                style: const TextStyle(color: WeedtipColors.primary)),
          ),
        ],
        if (dispensary != null) ...[
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => context.push('/dispensary/${dispensary['slug']}'),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.store_outlined, size: 16, color: WeedtipColors.muted),
              const SizedBox(width: 6),
              Text('Sold at ${dispensary['name']}',
                  style: const TextStyle(color: WeedtipColors.muted)),
            ]),
          ),
        ],
        if (inStock && dispensary != null) ...[
          const SizedBox(height: 16),
          AddToCartButton(
            shop: DispensaryRef(
              id: dispensary['id'] as String,
              slug: dispensary['slug'] as String,
              name: dispensary['name'] as String,
            ),
            product: Product.fromJson(p),
          ),
        ],
        if (p['description'] != null) ...[
          const SizedBox(height: 20),
          const Text('Description', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(p['description'] as String, style: const TextStyle(color: WeedtipColors.muted)),
        ],
        const SizedBox(height: 24),
        const Text('Reviews', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        if (user != null) ...[
          _ProductReviewComposer(productId: p['id'] as String),
          const SizedBox(height: 12),
        ],
        reviews.when(
          loading: () => const LoadingBox(),
          error: (_, __) => const ErrorBox(),
          data: (list) => list.isEmpty
              ? const Text('No reviews yet.', style: TextStyle(color: WeedtipColors.muted))
              : Column(
                  children: [
                    for (final r in list)
                      Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: WeedtipColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: WeedtipColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            RatingStars((r['rating'] as num?) ?? 0),
                            if (r['body'] != null) ...[
                              const SizedBox(height: 6),
                              Text(r['body'] as String,
                                  style: const TextStyle(color: WeedtipColors.muted)),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _ProductReviewComposer extends ConsumerStatefulWidget {
  const _ProductReviewComposer({required this.productId});
  final String productId;
  @override
  ConsumerState<_ProductReviewComposer> createState() => _ProductReviewComposerState();
}

class _ProductReviewComposerState extends ConsumerState<_ProductReviewComposer> {
  int _rating = 0;
  bool _busy = false;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) return;
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final body = _controller.text.trim();
      await ref
          .read(repositoryProvider)
          .submitProductReview(widget.productId, _rating, body.isEmpty ? null : body);
      ref.invalidate(productReviewsProvider(widget.productId));
      ref.invalidate(productByIdProvider(widget.productId));
      _controller.clear();
      setState(() => _rating = 0);
      messenger.showSnackBar(const SnackBar(content: Text('Thanks for your review!')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Could not submit: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: WeedtipColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: WeedtipColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Review this product', style: TextStyle(fontWeight: FontWeight.w600)),
          Row(
            children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: () => setState(() => _rating = i),
                  icon: Icon(i <= _rating ? Icons.star_rounded : Icons.star_border_rounded,
                      color: WeedtipColors.primary),
                ),
            ],
          ),
          TextField(
            controller: _controller,
            maxLines: 2,
            decoration: const InputDecoration(hintText: 'How was it? (optional)'),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: _busy || _rating == 0 ? null : _submit,
              child: _busy
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Submit'),
            ),
          ),
        ],
      ),
    );
  }
}
