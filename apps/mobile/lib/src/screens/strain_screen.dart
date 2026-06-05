import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../models.dart';
import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

const _typeLabels = {'indica': 'Indica', 'sativa': 'Sativa', 'hybrid': 'Hybrid', 'cbd': 'CBD'};

class StrainScreen extends ConsumerWidget {
  const StrainScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strain = ref.watch(strainBySlugProvider(slug));
    return Scaffold(
      appBar: AppBar(),
      body: strain.when(
        loading: () => const LoadingBox(),
        error: (_, __) => ErrorBox(onRetry: () => ref.invalidate(strainBySlugProvider(slug))),
        data: (s) => s == null ? const EmptyBox('Strain not found.') : _Body(s),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body(this.s);
  final Map<String, dynamic> s;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final effects = (s['effects'] as List?)?.cast<String>() ?? const [];
    final flavors = (s['flavors'] as List?)?.cast<String>() ?? const [];
    final terpenes = (s['terpenes'] as List?)?.cast<String>() ?? const [];
    final negative = (s['negative_effects'] as List?)?.cast<String>() ?? const [];
    final medical = (s['medical_uses'] as List?)?.cast<String>() ?? const [];
    final parents = (s['parents'] as List?)?.cast<String>() ?? const [];
    final flowerMin = s['flowering_days_min'];
    final flowerMax = s['flowering_days_max'];
    final hasGrow = s['grow_difficulty'] != null ||
        flowerMin != null ||
        flowerMax != null ||
        s['yield_note'] != null ||
        s['grow_notes'] != null;
    final products = ref.watch(strainProductsProvider(s['id'] as String));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          const Icon(Icons.eco_rounded, color: WeedtipColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(s['name'] as String,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          ),
          TagChip(_typeLabels[s['type']] ?? s['type'] as String, filled: true),
          if (ref.watch(currentUserProvider) != null)
            _StrainSaveButton(strainId: s['id'] as String),
        ]),
        if (s['thc_low'] != null && s['thc_high'] != null) ...[
          const SizedBox(height: 6),
          Text('THC ${s['thc_low']}–${s['thc_high']}%',
              style: const TextStyle(color: WeedtipColors.muted)),
        ],
        if (s['cbd_low'] != null && s['cbd_high'] != null) ...[
          const SizedBox(height: 4),
          Text('CBD ${s['cbd_low']}–${s['cbd_high']}%',
              style: const TextStyle(color: WeedtipColors.muted)),
        ],
        if (s['description'] != null) ...[
          const SizedBox(height: 12),
          Text(s['description'] as String, style: const TextStyle(color: WeedtipColors.muted)),
        ],
        if (effects.isNotEmpty) ...[
          const SizedBox(height: 20),
          const Text('Effects', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final e in effects) TagChip(e, filled: true)]),
        ],
        if (flavors.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Flavors', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final f in flavors) TagChip(f)]),
        ],
        if (terpenes.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Terpenes', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final t in terpenes) TagChip(t)]),
        ],
        if (negative.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('May cause', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final n in negative) TagChip(n)]),
        ],
        if (medical.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('May help with', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final m in medical) TagChip(m, filled: true)]),
        ],
        if (parents.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Genetics', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text('A cross of ${parents.join(' × ')}.',
              style: const TextStyle(color: WeedtipColors.muted)),
        ],
        if (hasGrow) ...[
          const SizedBox(height: 16),
          const Text('Grow info', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (s['grow_difficulty'] != null)
            Text('Difficulty: ${s['grow_difficulty']}',
                style: const TextStyle(color: WeedtipColors.muted)),
          if (flowerMin != null || flowerMax != null)
            Text(
              'Flowering: ${flowerMin != null && flowerMax != null ? '$flowerMin–$flowerMax' : (flowerMin ?? flowerMax)} days',
              style: const TextStyle(color: WeedtipColors.muted),
            ),
          if (s['yield_note'] != null)
            Text('Yield: ${s['yield_note']}', style: const TextStyle(color: WeedtipColors.muted)),
          if (s['grow_notes'] != null) ...[
            const SizedBox(height: 4),
            Text(s['grow_notes'] as String, style: const TextStyle(color: WeedtipColors.muted)),
          ],
        ],
        const SizedBox(height: 24),
        const Text('Where to buy', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        products.when(
          loading: () => const LoadingBox(),
          error: (_, __) => const ErrorBox(),
          data: (list) => list.isEmpty
              ? const Text('No dispensaries currently list this strain.',
                  style: TextStyle(color: WeedtipColors.muted))
              : Column(
                  children: [
                    for (final p in list)
                      _ProductRow(p),
                  ],
                ),
        ),
      ],
    );
  }
}

class _StrainSaveButton extends ConsumerWidget {
  const _StrainSaveButton({required this.strainId});
  final String strainId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(isStrainSavedProvider(strainId));
    final isSaved = saved.value ?? false;
    return IconButton(
      tooltip: isSaved ? 'Saved' : 'Save',
      icon: Icon(isSaved ? Icons.favorite : Icons.favorite_border,
          color: isSaved ? WeedtipColors.primary : null),
      onPressed: () async {
        await ref.read(repositoryProvider).toggleStrainSave(strainId);
        ref.invalidate(isStrainSavedProvider(strainId));
      },
    );
  }
}

class _ProductRow extends StatelessWidget {
  const _ProductRow(this.p);
  final Map<String, dynamic> p;

  @override
  Widget build(BuildContext context) {
    final dispensary = p['dispensary'] as Map<String, dynamic>?;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(p['name'] as String),
        subtitle: Text(dispensary?['name'] as String? ?? ''),
        trailing: Text(formatPrice((p['price_cents'] as num).toInt()),
            style: const TextStyle(color: WeedtipColors.primary, fontWeight: FontWeight.w600)),
        onTap: dispensary == null ? null : () => context.push('/dispensary/${dispensary['slug']}'),
      ),
    );
  }
}
