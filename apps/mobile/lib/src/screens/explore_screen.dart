import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});
  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  String _query = '';
  bool _openNow = false;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(
      dispensarySearchProvider(DispensaryQuery(query: _query.isEmpty ? null : _query, openNow: _openNow)),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Dispensaries'), actions: const [CartIconButton()]),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _controller,
              textInputAction: TextInputAction.search,
              onSubmitted: (v) => setState(() => _query = v.trim()),
              decoration: InputDecoration(
                hintText: 'Search by name or city',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _controller.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _controller.clear();
                          setState(() => _query = '');
                        },
                      ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: FilterChip(
                label: const Text('Open now'),
                selected: _openNow,
                onSelected: (v) => setState(() => _openNow = v),
              ),
            ),
          ),
          Expanded(
            child: results.when(
              loading: () => const LoadingBox(),
              error: (_, __) => ErrorBox(
                  onRetry: () => ref.invalidate(dispensarySearchProvider)),
              data: (shops) => shops.isEmpty
                  ? const EmptyBox('No dispensaries found.\nTry a different search.')
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: shops.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (_, i) => DispensaryCard(shops[i]),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
