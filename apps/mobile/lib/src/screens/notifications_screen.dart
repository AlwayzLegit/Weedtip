import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets.dart';
import '../../theme.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Sign in to see notifications.'),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => context.go('/profile'), child: const Text('Sign in')),
          ]),
        ),
      );
    }

    final notifications = ref.watch(notificationsStreamProvider);
    final hasUnread = ref.watch(unreadCountProvider) > 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: () => ref.read(repositoryProvider).markAllNotificationsRead(),
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: notifications.when(
        loading: () => const LoadingBox(),
        error: (_, __) => const ErrorBox(),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyBox('No notifications yet.\nOrder updates will appear here.');
          }
          // Stream is ascending by created_at; show newest first.
          final items = [...list.reversed];
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final n = items[i];
              final unread = n['read'] != true;
              return InkWell(
                onTap: unread
                    ? () => ref.read(repositoryProvider).markNotificationRead(n['id'] as String)
                    : null,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: unread ? const Color(0x1410B981) : WeedtipColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: unread ? WeedtipColors.primary : WeedtipColors.border),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        n['type'] == 'order_new'
                            ? Icons.receipt_long
                            : Icons.local_shipping_outlined,
                        size: 20,
                        color: unread ? WeedtipColors.primary : WeedtipColors.muted,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(n['title'] as String? ?? '',
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            if (n['body'] != null) ...[
                              const SizedBox(height: 2),
                              Text(n['body'] as String,
                                  style: const TextStyle(fontSize: 13, color: WeedtipColors.muted)),
                            ],
                          ],
                        ),
                      ),
                      if (unread)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                              color: WeedtipColors.primary, shape: BoxShape.circle),
                        ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
