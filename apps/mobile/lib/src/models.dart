// Domain models mirroring the Supabase schema (and the @weedtip/shared TS types).
// Parsing is null-tolerant so the same models work for table selects and the
// search RPCs (which add distance_meters, is_open_now, rating, etc.).

double? _toDouble(dynamic v) => v == null ? null : (v as num).toDouble();
int _toInt(dynamic v) => v == null ? 0 : (v as num).toInt();

class Dispensary {
  Dispensary({
    required this.id,
    required this.name,
    required this.slug,
    required this.city,
    required this.state,
    this.description,
    this.address,
    this.zip,
    this.coverImageUrl,
    this.logoUrl,
    this.phone,
    this.email,
    this.website,
    this.isMedical = false,
    this.isRecreational = true,
    this.isDelivery = false,
    this.isPickup = true,
    this.latitude,
    this.longitude,
    this.distanceMeters,
    this.isOpenNow,
    this.ratingAvg = 0,
    this.ratingCount = 0,
    this.hours,
  });

  final String id;
  final String name;
  final String slug;
  final String city;
  final String state;
  final String? description;
  final String? address;
  final String? zip;
  final String? coverImageUrl;
  final String? logoUrl;
  final String? phone;
  final String? email;
  final String? website;
  final bool isMedical;
  final bool isRecreational;
  final bool isDelivery;
  final bool isPickup;
  final double? latitude;
  final double? longitude;
  final double? distanceMeters;
  final bool? isOpenNow;
  final num ratingAvg;
  final int ratingCount;
  final Map<String, dynamic>? hours;

  factory Dispensary.fromJson(Map<String, dynamic> j) => Dispensary(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
        city: j['city'] as String? ?? '',
        state: j['state'] as String? ?? '',
        description: j['description'] as String?,
        address: j['address'] as String?,
        zip: j['zip'] as String?,
        coverImageUrl: j['cover_image_url'] as String?,
        logoUrl: j['logo_url'] as String?,
        phone: j['phone'] as String?,
        email: j['email'] as String?,
        website: j['website'] as String?,
        isMedical: j['is_medical'] as bool? ?? false,
        isRecreational: j['is_recreational'] as bool? ?? true,
        isDelivery: j['is_delivery'] as bool? ?? false,
        isPickup: j['is_pickup'] as bool? ?? true,
        latitude: _toDouble(j['latitude']),
        longitude: _toDouble(j['longitude']),
        distanceMeters: _toDouble(j['distance_meters']),
        isOpenNow: j['is_open_now'] as bool?,
        ratingAvg: (j['rating_avg'] as num?) ?? 0,
        ratingCount: _toInt(j['rating_count']),
        hours: j['hours'] as Map<String, dynamic>?,
      );
}

class Category {
  Category({required this.id, required this.name, required this.slug, this.icon, this.sortOrder = 0});

  final String id;
  final String name;
  final String slug;
  final String? icon;
  final int sortOrder;

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
        icon: j['icon'] as String?,
        sortOrder: _toInt(j['sort_order']),
      );
}

class Product {
  Product({
    required this.id,
    required this.dispensaryId,
    required this.name,
    required this.priceCents,
    this.categoryId,
    this.brand,
    this.description,
    this.strainType,
    this.thcPercentage,
    this.cbdPercentage,
    this.unit,
    this.imageUrls = const [],
    this.inStock = true,
  });

  final String id;
  final String dispensaryId;
  final String name;
  final int priceCents;
  final String? categoryId;
  final String? brand;
  final String? description;
  final String? strainType;
  final double? thcPercentage;
  final double? cbdPercentage;
  final String? unit;
  final List<String> imageUrls;
  final bool inStock;

  String? get firstImage => imageUrls.isNotEmpty ? imageUrls.first : null;

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: j['id'] as String,
        dispensaryId: j['dispensary_id'] as String,
        name: j['name'] as String,
        priceCents: _toInt(j['price_cents']),
        categoryId: j['category_id'] as String?,
        brand: j['brand'] as String?,
        description: j['description'] as String?,
        strainType: j['strain_type'] as String?,
        thcPercentage: _toDouble(j['thc_percentage']),
        cbdPercentage: _toDouble(j['cbd_percentage']),
        unit: j['unit'] as String?,
        imageUrls: (j['image_urls'] as List?)?.cast<String>() ?? const [],
        inStock: j['in_stock'] as bool? ?? true,
      );
}

String formatPrice(int cents) => '\$${(cents / 100).toStringAsFixed(2)}';

String? formatDistance(double? meters) {
  if (meters == null) return null;
  final miles = meters / 1609.344;
  return miles < 10 ? '${miles.toStringAsFixed(1)} mi' : '${miles.round()} mi';
}
