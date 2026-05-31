import 'package:flutter_test/flutter_test.dart';
import 'package:weedtip/src/cart.dart';

const _shopA = DispensaryRef(id: 'a', slug: 'shop-a', name: 'Shop A');
const _shopB = DispensaryRef(id: 'b', slug: 'shop-b', name: 'Shop B');
CartItem _item(String id, int price) =>
    CartItem(productId: id, name: 'Item $id', priceCents: price);

void main() {
  test('adding the same product increments quantity and subtotal', () {
    final n = CartNotifier();
    n.add(_shopA, _item('p1', 1000));
    n.add(_shopA, _item('p1', 1000));
    expect(n.state!.count, 2);
    expect(n.state!.subtotalCents, 2000);
    expect(n.state!.items.length, 1);
  });

  test('adding from a different dispensary replaces the cart', () {
    final n = CartNotifier();
    n.add(_shopA, _item('p1', 1000));
    n.add(_shopB, _item('p2', 500));
    expect(n.state!.dispensaryId, 'b');
    expect(n.state!.items.length, 1);
    expect(n.state!.subtotalCents, 500);
  });

  test('setQuantity to 0 removes the line; emptying the cart clears it', () {
    final n = CartNotifier();
    n.add(_shopA, _item('p1', 1000));
    n.add(_shopA, _item('p2', 500));
    n.setQuantity('p1', 0);
    expect(n.state!.items.length, 1);
    n.setQuantity('p2', 0);
    expect(n.state, isNull);
  });

  test('clear empties the cart', () {
    final n = CartNotifier();
    n.add(_shopA, _item('p1', 1000));
    n.clear();
    expect(n.state, isNull);
  });

  test('cart survives JSON round-trip (persistence)', () {
    final n = CartNotifier();
    n.add(_shopA, _item('p1', 1000));
    n.add(_shopA, _item('p2', 250));
    final restored = Cart.fromJson(n.state!.toJson());
    expect(restored.dispensaryId, 'a');
    expect(restored.items.length, 2);
    expect(restored.count, 2);
    expect(restored.subtotalCents, 1250);
  });
}
