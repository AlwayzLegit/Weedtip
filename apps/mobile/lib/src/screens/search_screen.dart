import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

/// Unified global search across stores, products, brands, and strains
/// (mirrors the web /search page; uses the shared `search_global` RPC).
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  String _query = '';
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _open(Map<String, dynamic> r) {
    final kind = r['kind'] as String?;
    final slug = r['slug'] as String?;
    final id = r['id'] as String?;
    switch (kind) {
      case 'dispensary':
        if (slug != null) context.push('/dispensary/$slug');
        break;
      case 'product':
        if (id != null) context.push('/product/$id');
        break;
      case 'brand':
        if (slug != null) context.push('/brand/$slug');
        break;
      case 'strain':
        if (slug != null) context.push('/strain/$slug');
        break;
    }
  }

  IconData _iconFor(String? kind) {
    switch (kind) {
      case 'dispensary':
        return Icons.storefront_outlined;
      case 'product':
        return Icons.inventory_2_outlined;
      case 'brand':
        return Icons.workspace_premium_outlined;
      case 'strain':
        return Icons.eco_outlined;
      default:
        return Icons.search;
    }
  }

  @override
  Widget build(BuildContext context) {
    final trimmed = _query.trim();
    final results = ref.watch(globalSearchProvider(trimmed));

    return Scaffold(
      appBar: AppBar(title: const Text('Search'), actions: const [CartIconButton()]),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _controller,
              autofocus: true,
              textInputAction: TextInputAction.search,
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Search stores, products, brands, strains',
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
          Expanded(
            child: trimmed.length < 2
                ? const Center(
                    child: Text('Type at least two characters.',
                        style: TextStyle(color: WeedtipColors.muted)),
                  )
                : results.when(
                    loading: () => const LoadingBox(),
                    error: (_, __) => const ErrorBox(),
                    data: (list) => list.isEmpty
                        ? const Center(
                            child: Text('No results.',
                                style: TextStyle(color: WeedtipColors.muted)),
                          )
                        : ListView.separated(
                            itemCount: list.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (_, i) {
                              final r = list[i];
                              return ListTile(
                                leading: Icon(_iconFor(r['kind'] as String?),
                                    color: WeedtipColors.primary),
                                title: Text(r['name'] as String? ?? ''),
                                subtitle: r['subtitle'] != null
                                    ? Text(r['subtitle'] as String)
                                    : null,
                                trailing: Text(r['kind'] as String? ?? '',
                                    style: const TextStyle(
                                        fontSize: 11, color: WeedtipColors.muted)),
                                onTap: () => _open(r),
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
