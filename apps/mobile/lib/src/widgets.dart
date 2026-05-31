import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'cart.dart';
import 'models.dart';
import 'providers.dart';
import '../theme.dart';

/// AppBar cart action with an item-count badge.
class CartIconButton extends ConsumerWidget {
  const CartIconButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartCountProvider);
    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          icon: const Icon(Icons.shopping_cart_outlined),
          tooltip: 'Cart',
          onPressed: () => context.push('/cart'),
        ),
        if (count > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: WeedtipColors.primary,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('$count',
                  style: const TextStyle(
                      fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF04140D))),
            ),
          ),
      ],
    );
  }
}

/// AppBar bell with an unread-notifications badge (live via Realtime).
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadCountProvider);
    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          icon: const Icon(Icons.notifications_outlined),
          tooltip: 'Notifications',
          onPressed: () => context.push('/notifications'),
        ),
        if (unread > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: WeedtipColors.danger,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('$unread',
                  style: const TextStyle(
                      fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ),
      ],
    );
  }
}

/// "Add to cart" button for a product within a dispensary's menu.
class AddToCartButton extends ConsumerWidget {
  const AddToCartButton({super.key, required this.shop, required this.product});
  final DispensaryRef shop;
  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        icon: const Icon(Icons.add, size: 16),
        label: const Text('Add'),
        onPressed: () {
          ref.read(cartProvider.notifier).add(
                shop,
                CartItem(productId: product.id, name: product.name, priceCents: product.priceCents),
              );
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Added ${product.name}'), duration: const Duration(milliseconds: 900)),
          );
        },
      ),
    );
  }
}

/// Small pill/chip used for offering badges (Pickup, Delivery, etc.).
class TagChip extends StatelessWidget {
  const TagChip(this.label, {super.key, this.filled = false});
  final String label;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: filled ? const Color(0x2210B981) : WeedtipColors.surface2,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: WeedtipColors.border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: filled ? WeedtipColors.primary : WeedtipColors.muted,
        ),
      ),
    );
  }
}

class RatingStars extends StatelessWidget {
  const RatingStars(this.rating, {super.key, this.count, this.size = 14});
  final num rating;
  final int? count;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 1; i <= 5; i++)
          Icon(
            Icons.star_rounded,
            size: size,
            color: i <= rating.round() ? WeedtipColors.primary : WeedtipColors.border,
          ),
        if (count != null) ...[
          const SizedBox(width: 4),
          Text('${rating.toStringAsFixed(1)} ($count)',
              style: const TextStyle(fontSize: 11, color: WeedtipColors.muted)),
        ],
      ],
    );
  }
}

class _CoverBox extends StatelessWidget {
  const _CoverBox({this.imageUrl, this.height = 120, this.child});
  final String? imageUrl;
  final double height;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0x4D10B981), WeedtipColors.surface2],
        ),
        image: (imageUrl != null && imageUrl!.isNotEmpty)
            ? DecorationImage(image: NetworkImage(imageUrl!), fit: BoxFit.cover)
            : null,
      ),
      child: child,
    );
  }
}

class DispensaryCard extends StatelessWidget {
  const DispensaryCard(this.d, {super.key});
  final Dispensary d;

  @override
  Widget build(BuildContext context) {
    final distance = formatDistance(d.distanceMeters);
    return InkWell(
      onTap: () => context.push('/dispensary/${d.slug}'),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          color: WeedtipColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: WeedtipColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _CoverBox(
              imageUrl: d.coverImageUrl,
              child: distance == null
                  ? null
                  : Align(
                      alignment: Alignment.topRight,
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: TagChip(distance),
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(d.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text('${d.city}, ${d.state}',
                      style: const TextStyle(fontSize: 13, color: WeedtipColors.muted)),
                  if (d.ratingCount > 0) ...[
                    const SizedBox(height: 6),
                    RatingStars(d.ratingAvg, count: d.ratingCount),
                  ],
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    if (d.isPickup) const TagChip('Pickup'),
                    if (d.isDelivery) const TagChip('Delivery'),
                    if (d.isMedical) const TagChip('Medical'),
                    if (d.isRecreational) const TagChip('Rec'),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard(this.p, {super.key});
  final Product p;

  static const _strainLabels = {
    'indica': 'Indica',
    'sativa': 'Sativa',
    'hybrid': 'Hybrid',
    'cbd': 'CBD',
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: WeedtipColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: WeedtipColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CoverBox(
            imageUrl: p.firstImage,
            height: 96,
            child: p.strainType == null
                ? null
                : Align(
                    alignment: Alignment.topRight,
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: TagChip(_strainLabels[p.strainType] ?? p.strainType!, filled: true),
                    ),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (p.brand != null)
                  Text(p.brand!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: WeedtipColors.muted)),
                Text(p.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(formatPrice(p.priceCents),
                        style: const TextStyle(
                            color: WeedtipColors.primary, fontWeight: FontWeight.w600)),
                    if (p.thcPercentage != null)
                      Text('${p.thcPercentage!.toStringAsFixed(0)}% THC',
                          style: const TextStyle(fontSize: 11, color: WeedtipColors.muted)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Centered loading spinner for async sections.
class LoadingBox extends StatelessWidget {
  const LoadingBox({super.key});
  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
            padding: EdgeInsets.all(40), child: CircularProgressIndicator(strokeWidth: 2)),
      );
}

/// Error placeholder with optional retry.
class ErrorBox extends StatelessWidget {
  const ErrorBox({super.key, this.onRetry, this.message = 'Something went wrong'});
  final VoidCallback? onRetry;
  final String message;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
            if (onRetry != null) ...[
              const SizedBox(height: 8),
              OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
            ],
          ]),
        ),
      );
}

/// Empty-state placeholder.
class EmptyBox extends StatelessWidget {
  const EmptyBox(this.message, {super.key});
  final String message;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Text(message,
              textAlign: TextAlign.center, style: const TextStyle(color: WeedtipColors.muted)),
        ),
      );
}
