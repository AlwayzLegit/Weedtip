import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../cart.dart';
import '../models.dart';
import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

class DispensaryScreen extends ConsumerWidget {
  const DispensaryScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dispensary = ref.watch(dispensaryBySlugProvider(slug));

    return Scaffold(
      appBar: AppBar(actions: const [CartIconButton()]),
      body: dispensary.when(
        loading: () => const LoadingBox(),
        error: (_, __) => ErrorBox(onRetry: () => ref.invalidate(dispensaryBySlugProvider(slug))),
        data: (d) => d == null
            ? const EmptyBox('Dispensary not found.')
            : _DispensaryBody(d),
      ),
    );
  }
}

class _DispensaryBody extends ConsumerWidget {
  const _DispensaryBody(this.d);
  final Dispensary d;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(dispensaryProductsProvider(d.id));
    final reviews = ref.watch(dispensaryReviewsProvider(d.id));
    final updates = ref.watch(dispensaryUpdatesProvider(d.id));
    final promos = ref.watch(dispensaryPromosProvider(d.id));

    return ListView(
      children: [
        Container(
          height: 140,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0x4D10B981), WeedtipColors.surface2],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            image: (d.coverImageUrl != null && d.coverImageUrl!.isNotEmpty)
                ? DecorationImage(image: NetworkImage(d.coverImageUrl!), fit: BoxFit.cover)
                : null,
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(d.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              if (d.address != null)
                Text('${d.address}, ${d.city}, ${d.state}',
                    style: const TextStyle(color: WeedtipColors.muted)),
              const SizedBox(height: 10),
              Row(children: [
                if (d.ratingCount > 0) RatingStars(d.ratingAvg, count: d.ratingCount),
                const Spacer(),
                if (ref.watch(currentUserProvider) != null) _FavoriteButton(dispensaryId: d.id),
              ]),
              const SizedBox(height: 10),
              Wrap(spacing: 6, runSpacing: 6, children: [
                if (d.isPickup) const TagChip('Pickup'),
                if (d.isDelivery) const TagChip('Delivery'),
                if (d.isMedical) const TagChip('Medical'),
                if (d.isRecreational) const TagChip('Recreational'),
              ]),
              if (d.description != null) ...[
                const SizedBox(height: 20),
                const _Heading('About'),
                const SizedBox(height: 6),
                Text(d.description!, style: const TextStyle(color: WeedtipColors.muted)),
              ],
              ...updates.maybeWhen(
                orElse: () => const <Widget>[],
                data: (list) => list.isEmpty
                    ? const <Widget>[]
                    : <Widget>[
                        const SizedBox(height: 20),
                        const _Heading('Updates'),
                        const SizedBox(height: 8),
                        for (final u in list)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(u['title'] as String,
                                    style: const TextStyle(fontWeight: FontWeight.w600)),
                                if (u['body'] != null)
                                  Text(u['body'] as String,
                                      style: const TextStyle(color: WeedtipColors.muted)),
                              ],
                            ),
                          ),
                      ],
              ),
              ...promos.maybeWhen(
                orElse: () => const <Widget>[],
                data: (list) => list.isEmpty
                    ? const <Widget>[]
                    : <Widget>[
                        const SizedBox(height: 20),
                        const _Heading('In-store offers'),
                        const SizedBox(height: 8),
                        for (final p in list)
                          Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              title: Text(p['title'] as String),
                              subtitle: p['description'] != null
                                  ? Text(p['description'] as String)
                                  : const Text('Claim in-store',
                                      style: TextStyle(color: WeedtipColors.muted)),
                            ),
                          ),
                      ],
              ),
              const SizedBox(height: 20),
              const _Heading('Menu'),
              const SizedBox(height: 10),
              products.when(
                loading: () => const LoadingBox(),
                error: (_, __) => const ErrorBox(),
                data: (items) => items.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Text('No products listed yet.',
                            style: TextStyle(color: WeedtipColors.muted)))
                    : GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 200,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.58,
                        ),
                        itemCount: items.length,
                        itemBuilder: (_, i) {
                          final p = items[i];
                          return Column(
                            children: [
                              Expanded(child: ProductCard(p)),
                              if (p.inStock)
                                Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: AddToCartButton(
                                    shop: DispensaryRef(id: d.id, slug: d.slug, name: d.name),
                                    product: p,
                                  ),
                                ),
                            ],
                          );
                        },
                      ),
              ),
              const SizedBox(height: 20),
              const _Heading('Reviews'),
              const SizedBox(height: 10),
              if (ref.watch(currentUserProvider) != null) ...[
                _ReviewComposer(dispensaryId: d.id, slug: d.slug),
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
                                  Row(
                                    children: [
                                      RatingStars((r['rating'] as num?) ?? 0),
                                      if (r['verified'] == true) ...[
                                        const SizedBox(width: 6),
                                        const Icon(Icons.verified_rounded,
                                            size: 14, color: WeedtipColors.primary),
                                        const SizedBox(width: 2),
                                        const Text('Verified',
                                            style: TextStyle(
                                                fontSize: 11, color: WeedtipColors.primary)),
                                      ],
                                    ],
                                  ),
                                  if (r['quality'] != null ||
                                      r['service'] != null ||
                                      r['atmosphere'] != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      [
                                        if (r['quality'] != null) 'Quality ${r['quality']}',
                                        if (r['service'] != null) 'Service ${r['service']}',
                                        if (r['atmosphere'] != null) 'Atmosphere ${r['atmosphere']}',
                                      ].join('  ·  '),
                                      style: const TextStyle(
                                          fontSize: 12, color: WeedtipColors.muted),
                                    ),
                                  ],
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
          ),
        ),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;
  @override
  Widget build(BuildContext context) =>
      Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold));
}

class _FavoriteButton extends ConsumerWidget {
  const _FavoriteButton({required this.dispensaryId});
  final String dispensaryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fav = ref.watch(isFavoriteProvider(dispensaryId));
    final isFav = fav.value ?? false;
    return IconButton(
      tooltip: isFav ? 'Saved' : 'Save',
      icon: Icon(isFav ? Icons.favorite : Icons.favorite_border,
          color: isFav ? WeedtipColors.primary : null),
      onPressed: () async {
        await ref.read(repositoryProvider).toggleFavorite(dispensaryId);
        ref.invalidate(isFavoriteProvider(dispensaryId));
        ref.invalidate(favoritesProvider);
      },
    );
  }
}

class _ReviewComposer extends ConsumerStatefulWidget {
  const _ReviewComposer({required this.dispensaryId, required this.slug});
  final String dispensaryId;
  final String slug;

  @override
  ConsumerState<_ReviewComposer> createState() => _ReviewComposerState();
}

class _ReviewComposerState extends ConsumerState<_ReviewComposer> {
  int _quality = 0;
  int _service = 0;
  int _atmosphere = 0;
  bool _busy = false;
  final _controller = TextEditingController();

  bool get _complete => _quality > 0 && _service > 0 && _atmosphere > 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_complete) return;
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final body = _controller.text.trim();
      await ref.read(repositoryProvider).submitReview(
            widget.dispensaryId,
            quality: _quality,
            service: _service,
            atmosphere: _atmosphere,
            body: body.isEmpty ? null : body,
          );
      ref.invalidate(dispensaryReviewsProvider(widget.dispensaryId));
      ref.invalidate(dispensaryBySlugProvider(widget.slug));
      _controller.clear();
      setState(() {
        _quality = 0;
        _service = 0;
        _atmosphere = 0;
      });
      messenger.showSnackBar(const SnackBar(content: Text('Thanks for your review!')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Could not submit: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _starRow(String label, int value, ValueChanged<int> onSet) {
    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(label, style: const TextStyle(color: WeedtipColors.muted)),
        ),
        for (var i = 1; i <= 5; i++)
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: () => onSet(i),
            icon: Icon(
              i <= value ? Icons.star_rounded : Icons.star_border_rounded,
              color: WeedtipColors.primary,
            ),
          ),
      ],
    );
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
          const Text('Leave a review', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          _starRow('Quality', _quality, (v) => setState(() => _quality = v)),
          _starRow('Service', _service, (v) => setState(() => _service = v)),
          _starRow('Atmosphere', _atmosphere, (v) => setState(() => _atmosphere = v)),
          const SizedBox(height: 8),
          TextField(
            controller: _controller,
            maxLines: 2,
            decoration: const InputDecoration(hintText: 'Share your experience (optional)'),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: _busy || !_complete ? null : _submit,
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
