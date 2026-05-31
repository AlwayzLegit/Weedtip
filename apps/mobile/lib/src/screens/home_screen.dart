import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final featured = ref.watch(featuredDispensariesProvider);
    final categories = ref.watch(categoriesProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(featuredDispensariesProvider);
            ref.invalidate(categoriesProvider);
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Brand + hero
              const Row(children: [
                Icon(Icons.eco_rounded, color: WeedtipColors.primary),
                SizedBox(width: 6),
                Text('Weedtip', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                Spacer(),
                NotificationBell(),
                CartIconButton(),
              ]),
              const SizedBox(height: 20),
              RichText(
                text: const TextSpan(
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, height: 1.15),
                  children: [
                    TextSpan(text: 'The Google Maps of\n'),
                    TextSpan(text: 'cannabis', style: TextStyle(color: WeedtipColors.primary)),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Discover dispensaries, browse menus, and order for pickup or delivery.',
                style: TextStyle(color: WeedtipColors.muted),
              ),
              const SizedBox(height: 16),
              // Search → Explore
              TextField(
                readOnly: true,
                onTap: () => context.go('/explore'),
                decoration: const InputDecoration(
                  hintText: 'Search dispensaries by name or city',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
              const SizedBox(height: 24),
              Row(children: [
                Expanded(
                  child: _QuickLink(
                    icon: Icons.eco_rounded,
                    label: 'Strains',
                    onTap: () => context.push('/strains'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _QuickLink(
                    icon: Icons.local_offer_outlined,
                    label: 'Deals',
                    onTap: () => context.push('/deals'),
                  ),
                ),
              ]),
              const SizedBox(height: 28),

              const _SectionTitle('Browse by category'),
              const SizedBox(height: 12),
              categories.when(
                loading: () => const SizedBox(height: 36, child: LoadingBox()),
                error: (_, __) => const SizedBox.shrink(),
                data: (cats) => Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final c in cats)
                      ActionChip(
                        label: Text(c.name),
                        onPressed: () => context.go('/products?category=${c.slug}'),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const _SectionTitle('Featured dispensaries'),
                  TextButton(onPressed: () => context.go('/explore'), child: const Text('View all')),
                ],
              ),
              const SizedBox(height: 8),
              featured.when(
                loading: () => const LoadingBox(),
                error: (_, __) => ErrorBox(
                    onRetry: () => ref.invalidate(featuredDispensariesProvider)),
                data: (shops) => shops.isEmpty
                    ? const EmptyBox('No dispensaries yet.')
                    : Column(
                        children: [
                          for (final d in shops)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: DispensaryCard(d),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;
  @override
  Widget build(BuildContext context) =>
      Text(text, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold));
}

class _QuickLink extends StatelessWidget {
  const _QuickLink({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: WeedtipColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: WeedtipColors.border),
        ),
        child: Row(children: [
          Icon(icon, color: WeedtipColors.primary, size: 20),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}
