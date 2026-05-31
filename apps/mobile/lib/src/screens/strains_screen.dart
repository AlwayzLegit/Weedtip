import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

const _types = ['indica', 'sativa', 'hybrid', 'cbd'];
const _typeLabels = {'indica': 'Indica', 'sativa': 'Sativa', 'hybrid': 'Hybrid', 'cbd': 'CBD'};

class StrainsScreen extends ConsumerStatefulWidget {
  const StrainsScreen({super.key});
  @override
  ConsumerState<StrainsScreen> createState() => _StrainsScreenState();
}

class _StrainsScreenState extends ConsumerState<StrainsScreen> {
  String? _type;

  @override
  Widget build(BuildContext context) {
    final strains = ref.watch(strainsProvider(_type));
    return Scaffold(
      appBar: AppBar(title: const Text('Strains')),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: const Text('All'),
                    selected: _type == null,
                    onSelected: (_) => setState(() => _type = null),
                  ),
                ),
                for (final t in _types)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(_typeLabels[t]!),
                      selected: _type == t,
                      onSelected: (_) => setState(() => _type = t),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: strains.when(
              loading: () => const LoadingBox(),
              error: (_, __) => ErrorBox(onRetry: () => ref.invalidate(strainsProvider)),
              data: (list) => list.isEmpty
                  ? const EmptyBox('No strains found.')
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, i) {
                        final s = list[i];
                        final effects = (s['effects'] as List?)?.cast<String>() ?? const [];
                        return InkWell(
                          onTap: () => context.push('/strain/${s['slug']}'),
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
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(s['name'] as String,
                                          style: const TextStyle(fontWeight: FontWeight.w600)),
                                    ),
                                    TagChip(_typeLabels[s['type']] ?? s['type'] as String,
                                        filled: true),
                                  ],
                                ),
                                if (effects.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children:
                                        [for (final e in effects.take(3)) TagChip(e)],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
