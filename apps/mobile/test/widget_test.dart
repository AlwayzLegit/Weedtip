import 'package:flutter_test/flutter_test.dart';
import 'package:weedtip/src/models.dart';

void main() {
  group('formatPrice', () {
    test('formats cents as USD', () {
      expect(formatPrice(4500), '\$45.00');
      expect(formatPrice(0), '\$0.00');
      expect(formatPrice(199), '\$1.99');
    });
  });

  group('formatDistance', () {
    test('null when no distance', () {
      expect(formatDistance(null), isNull);
    });
    test('one decimal under 10 miles', () {
      expect(formatDistance(1609.344), '1.0 mi');
    });
    test('rounded at/over 10 miles', () {
      expect(formatDistance(16093.44), '10 mi');
    });
  });

  group('Dispensary.fromJson', () {
    test('parses search-RPC row with ratings and distance', () {
      final d = Dispensary.fromJson({
        'id': '00000000-0000-0000-0000-000000000001',
        'name': 'Green Leaf NYC',
        'slug': 'green-leaf-nyc',
        'city': 'New York',
        'state': 'NY',
        'is_pickup': true,
        'is_delivery': true,
        'rating_avg': 4.5,
        'rating_count': 12,
        'distance_meters': 404.2,
        'latitude': 40.7484,
        'longitude': -73.9857,
      });
      expect(d.name, 'Green Leaf NYC');
      expect(d.ratingAvg, 4.5);
      expect(d.ratingCount, 12);
      expect(formatDistance(d.distanceMeters), '0.3 mi');
      expect(d.isPickup, true);
    });
  });
}
